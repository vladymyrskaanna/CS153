import express, { type Request } from "express";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, ilike, inArray, or, sql, count } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import {
  distributorGroups,
  branches,
  contacts,
  distributorNotes,
} from "../src/lib/db/schema";
import { requireAuth, type Session } from "./auth";

export const apiRouter = express.Router();
apiRouter.use(requireAuth);

const DISTRIBUTOR_EDITABLE = ["name", "website", "phone", "city", "state", "zip", "addressLine1", "addressLine2"] as const;
const CONTACT_EDITABLE = ["firstName", "lastName", "title", "email", "phone", "linkedin", "note", "seniority"] as const;

function effectiveStates(states: string[] | null | undefined, home: string | null | undefined): string[] {
  const list = (states ?? []).filter(Boolean);
  if (list.length > 0) return list;
  const h = (home ?? "").trim();
  return h ? [h] : [];
}

function username(req: Request): string {
  return (req as Request & { session: Session }).session.username;
}

// GET /api/me
apiRouter.get("/me", (req, res) => {
  res.json((req as Request & { session: Session }).session);
});

// GET /api/distributors
apiRouter.get("/distributors", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  const priority = ([] as string[]).concat(req.query.priority as string | string[] | undefined ?? []);
  const state = ([] as string[]).concat(req.query.state as string | string[] | undefined ?? []);
  const tag = ([] as string[]).concat(req.query.tag as string | string[] | undefined ?? []);
  const owner = (req.query.owner as string | undefined)?.trim();
  const sort = (req.query.sort as string) ?? "name";
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const page = Math.max(1, Number(req.query.page ?? 1));
  const offset = (page - 1) * limit;

  const where = [];
  if (q) {
    const like = `%${q}%`;
    where.push(or(
      ilike(distributorGroups.name, like),
      ilike(distributorGroups.city, like),
      ilike(distributorGroups.state, like),
      ilike(distributorGroups.website, like),
    )!);
  }
  if (priority.length) where.push(inArray(distributorGroups.priority, priority as ("LOW" | "MEDIUM" | "HIGH" | "UNKNOWN")[]));
  if (state.length) where.push(sql`${distributorGroups.states} && ${state}::text[]`);
  // Drizzle's postgres-js driver doesn't auto-cast JS arrays to PG text[] in
  // raw sql templates — use IN with sql.join instead of ANY/array.
  const arr = (vals: string[]) => sql.join(vals.map((v) => sql`${v}`), sql`, `);
  if (tag.length)   where.push(sql`tag IN (${arr(tag)})`);
  if (owner)        where.push(sql`owner_username = ${owner}`);
  // supplier filter (multi)
  const supplier = ([] as string[]).concat(req.query.supplier as string | string[] | undefined ?? []);
  if (supplier.length) where.push(sql`supplier IN (${arr(supplier)})`);
  // AI-processed filter — distributor has at least one completed Regenerate run
  const aiProcessed = String(req.query.aiProcessed ?? "");
  if (aiProcessed === "1" || aiProcessed === "true") {
    where.push(sql`EXISTS (SELECT 1 FROM research.run rr WHERE rr.distributor_id = "DistributorGroup"."id" AND rr.status = 'done')`);
  } else if (aiProcessed === "0" || aiProcessed === "false") {
    where.push(sql`NOT EXISTS (SELECT 1 FROM research.run rr WHERE rr.distributor_id = "DistributorGroup"."id" AND rr.status = 'done')`);
  }

  const orderBy =
    sort === "recent" ? desc(distributorGroups.lastUpdated)
    : sort === "contacts" ? desc(sql`(SELECT count(*) FROM research.person c WHERE c.distributor_id = "DistributorGroup"."id")`)
    : asc(distributorGroups.name);

  const rows = await db.select({
    id: distributorGroups.id,
    name: distributorGroups.name,
    website: distributorGroups.website,
    phone: distributorGroups.phone,
    city: distributorGroups.city,
    state: distributorGroups.state,
    states: distributorGroups.states,
    priority: distributorGroups.priority,
    isPriority: distributorGroups.isPriority,
    lastUpdated: distributorGroups.lastUpdated,
    tag: sql<string>`tag`,
    ownerUsername: sql<string | null>`owner_username`,
    supplier: sql<string | null>`supplier`,
    contactCount: sql<number>`(SELECT count(*) FROM research.person p WHERE p.distributor_id = "DistributorGroup"."id")`,
    branchCount: sql<number>`(SELECT count(*) FROM distributor."Branch" b WHERE b."groupId" = "DistributorGroup"."id")`,
    aiProcessed: sql<boolean>`EXISTS (SELECT 1 FROM research.run rr WHERE rr.distributor_id = "DistributorGroup"."id" AND rr.status = 'done')`,
  }).from(distributorGroups).where(where.length ? and(...where) : undefined).orderBy(orderBy).limit(limit).offset(offset);

  const totalRow = await db.select({ c: count() }).from(distributorGroups).where(where.length ? and(...where) : undefined);

  res.json({
    rows: rows.map((r) => ({ ...r, states: effectiveStates(r.states, r.state), contactCount: Number(r.contactCount), branchCount: Number(r.branchCount) })),
    total: Number(totalRow[0]?.c ?? 0),
    page, limit,
  });
});

// GET /api/distributors/:id
apiRouter.get("/distributors/:id", async (req, res) => {
  const { id } = req.params;
  const contactLimit = Math.min(Number(req.query.contactLimit ?? 100), 500);

  const [row] = await db.select().from(distributorGroups).where(eq(distributorGroups.id, id)).limit(1);
  if (!row) return res.status(404).json({ error: "Not found" });

  // Drizzle doesn't auto-map our 5 new columns yet — pull them with raw SQL.
  type Ext = { pipeline_stage: string; tag: string; owner_username: string | null; supplier: string | null };
  const ext = await db.execute<Ext>(
    sql`SELECT pipeline_stage::text AS pipeline_stage, tag, owner_username, supplier
        FROM distributor."DistributorGroup" WHERE id = ${id} LIMIT 1`
  );
  const extRow = (ext as unknown as { rows: Ext[] }).rows?.[0]
    ?? (Array.isArray(ext) ? (ext as Ext[])[0] : undefined);

  const [b, c, n, contactsTotalRow] = await Promise.all([
    db.select().from(branches).where(eq(branches.groupId, id)),
    db.select().from(contacts).where(eq(contacts.groupId, id)).orderBy(asc(contacts.lastName), asc(contacts.firstName)).limit(contactLimit),
    db.select().from(distributorNotes).where(eq(distributorNotes.distributorId, id)).orderBy(desc(distributorNotes.date)).limit(50),
    // Contacts tab badge — matches the `contacts` (distributor."Contact") list below.
    // The org-chart size lives on the separate "Org Chart" tab (research.person).
    db.select({ c: count() }).from(contacts).where(eq(contacts.groupId, id)),
  ]);

  res.json({
    ...row,
    states: effectiveStates(row.states, row.state),
    actions: row.actions ?? [],
    pipelineStage: extRow?.pipeline_stage ?? "New",
    tag: extRow?.tag ?? "none",
    ownerUsername: extRow?.owner_username ?? null,
    supplier: extRow?.supplier ?? null,
    branches: b,
    contacts: c,
    notes: n,
    contactsTotal: Number(contactsTotalRow[0]?.c ?? 0),
  });
});

// PATCH /api/distributors/:id  body: { field, value }
apiRouter.patch("/distributors/:id", async (req, res) => {
  const { field, value } = req.body as { field?: string; value?: string };
  if (!field || !DISTRIBUTOR_EDITABLE.includes(field as typeof DISTRIBUTOR_EDITABLE[number])) {
    return res.status(400).json({ error: "Field not editable" });
  }
  const trimmed = (value ?? "").trim();
  await db.update(distributorGroups)
    .set({ [field]: trimmed === "" ? null : trimmed, lastUpdated: new Date(), lastUpdatedBy: username(req) } as Record<string, unknown>)
    .where(eq(distributorGroups.id, req.params.id));
  res.json({ ok: true });
});

// PATCH /api/distributors/:id/priority
apiRouter.patch("/distributors/:id/priority", async (req, res) => {
  const priority = req.body?.priority as "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  await db.update(distributorGroups).set({ priority, isPriority: priority === "HIGH", lastUpdated: new Date(), lastUpdatedBy: username(req) }).where(eq(distributorGroups.id, req.params.id));
  res.json({ ok: true });
});

// POST /api/distributors  body: NewDistributor
apiRouter.post("/distributors", async (req, res) => {
  const { name, website, phone, city, state, zip } = req.body as Record<string, string | undefined>;
  if (!name?.trim()) return res.status(400).json({ error: "Name required" });
  const id = randomUUID();
  const home = state?.trim() || null;
  const now = new Date();
  await db.insert(distributorGroups).values({
    id,
    name: name.trim(),
    website: website?.trim() || null,
    phone: phone?.trim() || null,
    city: city?.trim() || null,
    state: home,
    zip: zip?.trim() || null,
    states: home ? [home] : [],
    createdAt: now,
    updatedAt: now,
    lastUpdated: now,
    lastUpdatedBy: username(req),
  } as Parameters<typeof db.insert<typeof distributorGroups>>[0] extends never ? never : Record<string, unknown>);
  res.status(201).json({ id });
});

// POST /api/distributors/:id/notes
apiRouter.post("/distributors/:id/notes", async (req, res) => {
  const text = (req.body?.text as string ?? "").trim();
  if (!text) return res.status(400).json({ error: "Empty note" });
  await db.insert(distributorNotes).values({
    id: randomUUID(),
    distributorId: req.params.id,
    text,
    user: username(req),
  });
  res.status(201).json({ ok: true });
});

// POST /api/distributors/:id/contacts
apiRouter.post("/distributors/:id/contacts", async (req, res) => {
  const { firstName, lastName, title, email, phone, linkedin, seniority } = req.body as Record<string, string | undefined>;
  const cleaned = {
    firstName: firstName?.trim() || null,
    lastName: lastName?.trim() || null,
    title: title?.trim() || null,
    email: email?.trim() || null,
    phone: phone?.trim() || null,
    linkedin: linkedin?.trim() || null,
    seniority: seniority?.trim() || null,
  };
  if (!cleaned.firstName && !cleaned.lastName && !cleaned.email) {
    return res.status(400).json({ error: "Provide first/last name or email" });
  }
  const id = randomUUID();
  await db.insert(contacts).values({
    id,
    ...cleaned,
    groupId: req.params.id,
    lastUpdated: new Date(),
    lastUpdatedBy: username(req),
  });
  res.status(201).json({ id });
});

// PATCH /api/distributors/:distId/contacts/:contactId
apiRouter.patch("/distributors/:distId/contacts/:contactId", async (req, res) => {
  const { field, value } = req.body as { field?: string; value?: string };
  if (!field || !CONTACT_EDITABLE.includes(field as typeof CONTACT_EDITABLE[number])) {
    return res.status(400).json({ error: "Field not editable" });
  }
  const trimmed = (value ?? "").trim();
  await db.update(contacts)
    .set({ [field]: trimmed === "" ? null : trimmed, lastUpdated: new Date(), lastUpdatedBy: username(req) } as Record<string, unknown>)
    .where(eq(contacts.id, req.params.contactId));
  res.json({ ok: true });
});

// PATCH /api/distributors/:distId/contacts/:contactId/status
apiRouter.patch("/distributors/:distId/contacts/:contactId/status", async (req, res) => {
  await db.update(contacts).set({
    status: req.body?.status,
    lastUpdated: new Date(),
    lastUpdatedBy: username(req),
  }).where(eq(contacts.id, req.params.contactId));
  res.json({ ok: true });
});

// POST /api/distributors/:distId/contacts/:contactId/log-call
apiRouter.post("/distributors/:distId/contacts/:contactId/log-call", async (req, res) => {
  const name = (req.body?.contactName as string) || "contact";
  await db.insert(distributorNotes).values({
    id: randomUUID(),
    distributorId: req.params.distId,
    text: `📞 Call logged with ${name}`,
    user: username(req),
  });
  await db.update(contacts).set({ status: "CONTACTED", lastUpdated: new Date(), lastUpdatedBy: username(req) }).where(eq(contacts.id, req.params.contactId));
  res.json({ ok: true });
});

// POST /api/distributors/:distId/contacts/:contactId/mark-emailed
apiRouter.post("/distributors/:distId/contacts/:contactId/mark-emailed", async (req, res) => {
  const name = (req.body?.contactName as string) || "contact";
  await db.insert(distributorNotes).values({
    id: randomUUID(),
    distributorId: req.params.distId,
    text: `✉️ Email sent to ${name}`,
    user: username(req),
  });
  await db.update(contacts).set({ status: "CONTACTED", lastUpdated: new Date(), lastUpdatedBy: username(req) }).where(eq(contacts.id, req.params.contactId));
  res.json({ ok: true });
});

// POST /api/distributors/:id/follow-up
apiRouter.post("/distributors/:id/follow-up", async (req, res) => {
  const when = (req.body?.when as string ?? "").trim();
  const name = (req.body?.contactName as string) || "contact";
  if (!when) return res.status(400).json({ error: "Pick a date" });
  await db.insert(distributorNotes).values({
    id: randomUUID(),
    distributorId: req.params.id,
    text: `⏰ Follow-up scheduled for ${when} (with ${name})`,
    user: username(req),
  });
  res.json({ ok: true });
});

// GET /api/distributors/:id/contacts.csv
apiRouter.get("/distributors/:id/contacts.csv", async (req, res) => {
  const [dist] = await db.select({ id: distributorGroups.id, name: distributorGroups.name })
    .from(distributorGroups).where(eq(distributorGroups.id, req.params.id)).limit(1);
  if (!dist) return res.status(404).send("Not found");

  const rows = await db.select({
    firstName: contacts.firstName, lastName: contacts.lastName, title: contacts.title,
    email: contacts.email, phone: contacts.phone, linkedin: contacts.linkedin,
    status: contacts.status, seniority: contacts.seniority,
  }).from(contacts).where(eq(contacts.groupId, req.params.id)).orderBy(asc(contacts.lastName), asc(contacts.firstName));

  const csvEscape = (s: string | null | undefined) => {
    if (s == null) return "";
    const v = String(s);
    return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const lines = ["First name,Last name,Title,Email,Phone,LinkedIn,Status,Seniority"];
  for (const r of rows) {
    lines.push([r.firstName, r.lastName, r.title, r.email, r.phone, r.linkedin, r.status, r.seniority].map(csvEscape).join(","));
  }
  const safe = dist.name.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 60) || "distributor";
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${safe}_contacts.csv"`);
  res.send(lines.join("\n"));
});

// GET /api/dashboard — research-oriented metrics (contacts = org-chart people)
apiRouter.get("/dashboard", async (_req, res) => {
  const [d] = await db.select({ c: count() }).from(distributorGroups);
  const num = (r: unknown) => Number((r as unknown as { c: string }[])[0]?.c ?? 0);
  const contactsRow = await db.execute<{ c: string }>(sql`SELECT count(*)::text AS c FROM research.person`);
  const withContactsRow = await db.execute<{ c: string }>(
    sql`SELECT count(*)::text AS c FROM distributor."DistributorGroup" g WHERE EXISTS (SELECT 1 FROM research.person p WHERE p.distributor_id = g."id")`
  );
  const researchedRow = await db.execute<{ c: string }>(
    sql`SELECT count(DISTINCT distributor_id)::text AS c FROM research.run WHERE status = 'done'`
  );
  res.json({
    distributors: Number(d?.c ?? 0),
    contacts: num(contactsRow),
    withContacts: num(withContactsRow),
    researched: num(researchedRow),
  });
});

// GET /api/distributors/:id/activity
apiRouter.get("/distributors/:id/activity", async (req, res) => {
  const noteRows = await db.select().from(distributorNotes)
    .where(eq(distributorNotes.distributorId, req.params.id))
    .orderBy(desc(distributorNotes.date)).limit(100);
  const statusRows = await db.execute<{ id: string; oldValue: string | null; newValue: string; user: string; timestamp: Date; firstName: string | null; lastName: string | null }>(sql`
    SELECT h.id, h."oldValue", h."newValue", h.user, h.timestamp, c."firstName", c."lastName"
    FROM distributor."ContactStatusHistory" h
    JOIN distributor."Contact" c ON c.id = h."contactId"
    WHERE c."groupId" = ${req.params.id}
    ORDER BY h.timestamp DESC LIMIT 100
  `);
  const notes = noteRows.map((n) => ({ id: n.id, kind: "note" as const, text: n.text, user: n.user, date: n.date }));
  const statuses = (statusRows as unknown as Array<{ id: string; oldValue: string | null; newValue: string; user: string; timestamp: Date; firstName: string | null; lastName: string | null }>).map((s) => ({
    id: s.id,
    kind: "status_change" as const,
    text: `${[s.firstName, s.lastName].filter(Boolean).join(" ") || "Contact"} status: ${s.oldValue ?? "—"} → ${s.newValue}`,
    user: s.user,
    date: new Date(s.timestamp),
  }));
  res.json([...notes, ...statuses].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 100));
});
