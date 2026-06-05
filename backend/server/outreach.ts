/**
 * Outreach / campaign management API.
 *
 * Two routers are exported:
 * - `outreachWebhookRouter` — PUBLIC `/api/outreach/webhooks/instantly`. Must
 *   be mounted BEFORE `requireAuth` so Instantly can POST to it from outside.
 * - `outreachRouter` — authed `/api/outreach/*` routes used by the CRM UI.
 *
 * All DB access uses `postgres.js` directly (matching the pattern in
 * research.ts / pipeline.ts). The Instantly REST API is wrapped via the
 * `instantly` adapter (instantly.ts).
 */
import { Router, type Request } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import postgres from "postgres";
import { requireAuth, type Session } from "./auth";
import { instantly } from "./instantly";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = postgres(url, { max: 3, idle_timeout: 20 });

function username(req: Request): string {
  return (req as Request & { session: Session }).session.username;
}

// ─── Public webhook router (mounted BEFORE requireAuth) ─────────────────────
export const outreachWebhookRouter = Router();

/** Verify Instantly's `X-Instantly-Signature` HMAC-SHA256 if secret is set. */
function verifySignature(rawBody: Buffer | string, signature: string | undefined): boolean {
  const secret = process.env.INSTANTLY_WEBHOOK_SECRET;
  if (!secret) return true; // Gracefully accept when secret isn't configured
  if (!signature) return false;
  try {
    const expected = createHmac("sha256", secret)
      .update(typeof rawBody === "string" ? rawBody : rawBody.toString("utf8"))
      .digest("hex");
    const a = Buffer.from(signature.replace(/^sha256=/, ""), "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Try to pull a usable {email, kind, payload} record from Instantly's
 * webhook payload. Their schema varies between event types; we read every
 * reasonable field and let unknowns flow into the raw payload.
 */
function normalizeEvent(payload: Record<string, unknown>): {
  kind: string;
  emailAddr: string | null;
  campaignExternalId: string | null;
  leadExternalId: string | null;
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  fromAddr: string | null;
} {
  const pick = (k: string): string | null => {
    const v = (payload as Record<string, unknown>)[k];
    return typeof v === "string" && v.length > 0 ? v : null;
  };
  const data = (payload?.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>) : {}) as Record<string, unknown>;
  const dpick = (k: string): string | null => {
    const v = data[k];
    return typeof v === "string" && v.length > 0 ? v : null;
  };

  const kind = String(
    pick("event") ??
      pick("event_type") ??
      pick("type") ??
      dpick("event") ??
      "",
  );

  const emailAddr =
    pick("lead_email") ??
    pick("email") ??
    pick("recipient") ??
    pick("to") ??
    dpick("lead_email") ??
    dpick("email") ??
    null;

  const campaignExternalId =
    pick("campaign_id") ??
    pick("campaign") ??
    dpick("campaign_id") ??
    dpick("campaign") ??
    null;

  const leadExternalId =
    pick("lead_id") ??
    pick("id") ??
    dpick("lead_id") ??
    dpick("id") ??
    null;

  const subject =
    pick("subject") ??
    pick("reply_subject") ??
    dpick("subject") ??
    null;

  const bodyText =
    pick("body_text") ??
    pick("reply_text") ??
    pick("text") ??
    dpick("body_text") ??
    dpick("text") ??
    null;

  const bodyHtml =
    pick("body_html") ??
    pick("reply_html") ??
    pick("html") ??
    dpick("body_html") ??
    dpick("html") ??
    null;

  const fromAddr =
    pick("from") ??
    pick("from_address") ??
    pick("reply_from") ??
    dpick("from") ??
    null;

  return { kind, emailAddr, campaignExternalId, leadExternalId, subject, bodyText, bodyHtml, fromAddr };
}

outreachWebhookRouter.post("/", async (req, res) => {
  const payload = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
  const rawString = JSON.stringify(payload);
  const signature = req.header("X-Instantly-Signature") ?? req.header("x-instantly-signature") ?? undefined;
  const signed = verifySignature(rawString, signature);

  // Log every inbound webhook regardless of validity — gives ops a trail.
  if (!signed) {
    if (!process.env.INSTANTLY_WEBHOOK_SECRET) {
      console.warn("[instantly webhook] INSTANTLY_WEBHOOK_SECRET not set — accepting unsigned request");
    } else {
      await sql`
        INSERT INTO outreach.webhook_log (provider, event_kind, signature, payload, error)
        VALUES ('instantly', ${null}, ${signature ?? null}, ${sql.json(payload)}, ${'invalid signature'})
      `;
      return res.status(401).json({ error: "invalid signature" });
    }
  }

  const norm = normalizeEvent(payload);
  let logId: number | null = null;
  try {
    const [logRow] = await sql<{ id: number }[]>`
      INSERT INTO outreach.webhook_log (provider, event_kind, signature, payload)
      VALUES ('instantly', ${norm.kind || null}, ${signature ?? null}, ${sql.json(payload)})
      RETURNING id
    `;
    logId = logRow?.id ?? null;
  } catch (e) {
    console.error("[instantly webhook] failed to log", e);
  }

  try {
    // Resolve campaign_lead (and via that, person_id / email_id) using either
    // lead_external_id or (campaign_external_id + lead_email).
    let lead:
      | { id: number; campaign_id: number; person_id: number | null; email_id: number | null; distributor_id: string | null }
      | undefined;
    if (norm.leadExternalId) {
      [lead] = await sql<typeof lead extends infer L ? L extends undefined ? never : L[] : never>`
        SELECT id, campaign_id, person_id, email_id, distributor_id
        FROM outreach.campaign_lead
        WHERE external_lead_id = ${norm.leadExternalId}
        LIMIT 1
      `;
    }
    if (!lead && norm.campaignExternalId && norm.emailAddr) {
      [lead] = await sql<typeof lead extends infer L ? L extends undefined ? never : L[] : never>`
        SELECT cl.id, cl.campaign_id, cl.person_id, cl.email_id, cl.distributor_id
        FROM outreach.campaign_lead cl
        JOIN outreach.campaign c ON c.id = cl.campaign_id
        JOIN research.person p ON p.id = cl.person_id
        WHERE c.external_id = ${norm.campaignExternalId}
          AND lower(coalesce(p.email, '')) = lower(${norm.emailAddr})
        LIMIT 1
      `;
    }
    if (!lead && norm.emailAddr) {
      // Last-ditch: match by email only.
      [lead] = await sql<typeof lead extends infer L ? L extends undefined ? never : L[] : never>`
        SELECT cl.id, cl.campaign_id, cl.person_id, cl.email_id, cl.distributor_id
        FROM outreach.campaign_lead cl
        JOIN research.person p ON p.id = cl.person_id
        WHERE lower(coalesce(p.email, '')) = lower(${norm.emailAddr})
        ORDER BY cl.added_at DESC
        LIMIT 1
      `;
    }

    // Direct-person fallback: when no campaign_lead exists yet (e.g. mock
    // webhook fired before a campaign was created), still try to bind the
    // event to a person + distributor by email match. We just won't have a
    // campaign_lead.id to update.
    let directPerson: { id: number; distributor_id: string } | undefined;
    if (!lead && norm.emailAddr) {
      [directPerson] = await sql<{ id: number; distributor_id: string }[]>`
        SELECT id, distributor_id FROM research.person
        WHERE lower(coalesce(email, '')) = lower(${norm.emailAddr})
        LIMIT 1
      `;
    }

    const eventKind = norm.kind.toLowerCase();
    const personId = lead?.person_id ?? directPerson?.id ?? null;
    const emailId = lead?.email_id ?? null;
    const distributorId = lead?.distributor_id ?? directPerson?.distributor_id ?? null;

    async function recordEvent(kind: "sent" | "open" | "click" | "reply" | "bounce" | "unsubscribe") {
      await sql`
        INSERT INTO research.email_event (email_id, person_id, kind, payload)
        VALUES (${emailId}, ${personId}, ${kind}, ${sql.json(payload)})
      `;
      if (lead) {
        await sql`
          UPDATE outreach.campaign_lead
          SET last_event_kind = ${kind}, last_event_at = now()
          WHERE id = ${lead.id}
        `;
      }
    }

    if (eventKind.includes("sent") || eventKind === "email_sent") {
      await recordEvent("sent");
      if (lead) {
        await sql`UPDATE outreach.campaign_lead SET status = 'sent' WHERE id = ${lead.id}`;
      }
    } else if (eventKind.includes("open")) {
      await recordEvent("open");
      if (personId) {
        await sql`
          UPDATE research.person
          SET outreach_status = 'contacted'::research."OutreachStatus",
              outreach_updated_at = now(),
              outreach_updated_by = ${'instantly-webhook'}
          WHERE id = ${personId} AND outreach_status = 'new'
        `;
      }
    } else if (eventKind.includes("click")) {
      await recordEvent("click");
    } else if (eventKind.includes("repli") || eventKind.includes("reply")) { /* "email_replied" doesn't include "reply" (y vs ied) — match both */
      await recordEvent("reply");
      if (personId) {
        await sql`
          UPDATE research.person
          SET outreach_status = 'replied'::research."OutreachStatus",
              outreach_updated_at = now(),
              outreach_updated_by = ${'instantly-webhook'}
          WHERE id = ${personId}
        `;
      }
      if (distributorId) {
        await sql`
          UPDATE distributor."DistributorGroup"
          SET pipeline_stage = 'Replied'::distributor."PipelineStage"
          WHERE id = ${distributorId}
        `;
      }
      // Record the inbound message in the thread.
      await sql`
        INSERT INTO research.email_thread
          (person_id, distributor_id, email_id, direction, subject, body_text, body_html, from_addr, to_addr, raw_payload)
        VALUES
          (${personId}, ${distributorId}, ${emailId}, 'in',
           ${norm.subject}, ${norm.bodyText}, ${norm.bodyHtml},
           ${norm.fromAddr}, ${norm.emailAddr}, ${sql.json(payload)})
      `;
    } else if (eventKind.includes("bounce")) {
      await recordEvent("bounce");
      if (personId) {
        await sql`
          UPDATE research.person
          SET outreach_status = 'bounced'::research."OutreachStatus",
              outreach_updated_at = now(),
              outreach_updated_by = ${'instantly-webhook'}
          WHERE id = ${personId}
        `;
      }
    } else if (eventKind.includes("unsubscribe")) {
      await recordEvent("unsubscribe");
    } else {
      // Unknown event kind — still logged via webhook_log above, no further action.
    }
    res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[instantly webhook] handler error", msg);
    if (logId != null) {
      try {
        await sql`UPDATE outreach.webhook_log SET error = ${msg} WHERE id = ${logId}`;
      } catch {/* ignore */}
    }
    res.status(500).json({ ok: false, error: msg });
  }
});

// ─── Authed router (mounted under /api/outreach via requireAuth) ────────────
export const outreachRouter = Router();
outreachRouter.use(requireAuth);

type CampaignRow = {
  id: number;
  name: string;
  status: string;
  externalProvider: string;
  externalId: string | null;
  sequenceJson: unknown;
  audienceFilterJson: unknown;
  mailboxIds: number[] | null;
  createdBy: string;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
};

function shapeCampaign(row: CampaignRow, stats?: { leads: number; sent: number; opened: number; replied: number; bounced: number }) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    externalProvider: row.externalProvider,
    externalId: row.externalId,
    sequenceJson: Array.isArray(row.sequenceJson) ? row.sequenceJson : [],
    audienceFilterJson: (row.audienceFilterJson && typeof row.audienceFilterJson === "object") ? row.audienceFilterJson : {},
    mailboxIds: row.mailboxIds ?? [],
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    stats: stats ?? { leads: 0, sent: 0, opened: 0, replied: 0, bounced: 0 },
  };
}

// GET /api/outreach/campaigns — list campaigns with aggregated stats
outreachRouter.get("/campaigns", async (_req, res) => {
  const rows = await sql<CampaignRow[]>`
    SELECT id, name, status, external_provider AS "externalProvider",
           external_id AS "externalId",
           sequence_json AS "sequenceJson",
           audience_filter_json AS "audienceFilterJson",
           mailbox_ids AS "mailboxIds",
           created_by AS "createdBy", created_at AS "createdAt",
           started_at AS "startedAt", ended_at AS "endedAt"
    FROM outreach.campaign
    ORDER BY created_at DESC
  `;
  const ids = rows.map((r) => r.id);
  const statsByCampaign: Record<number, { leads: number; sent: number; opened: number; replied: number; bounced: number }> = {};
  if (ids.length > 0) {
    const statsRows = await sql<{ campaign_id: number; last_event_kind: string | null; n: number }[]>`
      SELECT campaign_id, last_event_kind, COUNT(*)::int AS n
      FROM outreach.campaign_lead
      WHERE campaign_id IN ${sql(ids)}
      GROUP BY campaign_id, last_event_kind
    `;
    for (const id of ids) statsByCampaign[id] = { leads: 0, sent: 0, opened: 0, replied: 0, bounced: 0 };
    for (const r of statsRows) {
      const bucket = statsByCampaign[r.campaign_id]!;
      bucket.leads += r.n;
      const k = (r.last_event_kind ?? "").toLowerCase();
      if (k === "sent") bucket.sent += r.n;
      else if (k === "open") bucket.opened += r.n;
      else if (k === "reply") bucket.replied += r.n;
      else if (k === "bounce") bucket.bounced += r.n;
    }
  }
  res.json(rows.map((r) => shapeCampaign(r, statsByCampaign[r.id])));
});

// GET /api/outreach/campaigns/:id — single campaign + leads
outreachRouter.get("/campaigns/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "bad id" });
  const [row] = await sql<CampaignRow[]>`
    SELECT id, name, status, external_provider AS "externalProvider",
           external_id AS "externalId",
           sequence_json AS "sequenceJson",
           audience_filter_json AS "audienceFilterJson",
           mailbox_ids AS "mailboxIds",
           created_by AS "createdBy", created_at AS "createdAt",
           started_at AS "startedAt", ended_at AS "endedAt"
    FROM outreach.campaign WHERE id = ${id}
  `;
  if (!row) return res.status(404).json({ error: "campaign not found" });
  const leads = await sql`
    SELECT cl.id, cl.person_id AS "personId", cl.email_id AS "emailId",
           cl.distributor_id AS "distributorId", cl.external_lead_id AS "externalLeadId",
           cl.status, cl.last_event_kind AS "lastEventKind", cl.last_event_at AS "lastEventAt",
           cl.added_at AS "addedAt",
           p.full_name AS "fullName", p.email AS "email",
           g.name AS "distributorName"
    FROM outreach.campaign_lead cl
    LEFT JOIN research.person p ON p.id = cl.person_id
    LEFT JOIN distributor."DistributorGroup" g ON g.id = cl.distributor_id
    WHERE cl.campaign_id = ${id}
    ORDER BY cl.added_at DESC
  `;
  // Aggregated stats for this campaign
  const statsRows = await sql<{ last_event_kind: string | null; n: number }[]>`
    SELECT last_event_kind, COUNT(*)::int AS n
    FROM outreach.campaign_lead
    WHERE campaign_id = ${id}
    GROUP BY last_event_kind
  `;
  const stats = { leads: 0, sent: 0, opened: 0, replied: 0, bounced: 0 };
  for (const r of statsRows) {
    stats.leads += r.n;
    const k = (r.last_event_kind ?? "").toLowerCase();
    if (k === "sent") stats.sent += r.n;
    else if (k === "open") stats.opened += r.n;
    else if (k === "reply") stats.replied += r.n;
    else if (k === "bounce") stats.bounced += r.n;
  }
  res.json({ ...shapeCampaign(row, stats), leads });
});

// POST /api/outreach/campaigns — create draft
outreachRouter.post("/campaigns", async (req, res) => {
  const { name, sequence, audienceFilter, mailboxIds } = (req.body ?? {}) as {
    name?: string;
    sequence?: Array<{ subject?: string; body?: string; waitDays?: number }>;
    audienceFilter?: Record<string, unknown>;
    mailboxIds?: number[];
  };
  if (!name?.trim()) return res.status(400).json({ error: "name required" });
  const seq = Array.isArray(sequence)
    ? sequence.map((s) => ({
        subject: String(s?.subject ?? ""),
        body: String(s?.body ?? ""),
        waitDays: Number(s?.waitDays ?? 0),
      }))
    : [];
  const filter = (audienceFilter && typeof audienceFilter === "object") ? audienceFilter : {};
  const boxes = Array.isArray(mailboxIds) ? mailboxIds.map(Number).filter(Number.isFinite) : [];
  const [row] = await sql<CampaignRow[]>`
    INSERT INTO outreach.campaign
      (name, sequence_json, audience_filter_json, mailbox_ids, created_by)
    VALUES
      (${name.trim()}, ${sql.json(seq)}, ${sql.json(filter)}, ${boxes}, ${username(req)})
    RETURNING id, name, status, external_provider AS "externalProvider",
              external_id AS "externalId",
              sequence_json AS "sequenceJson",
              audience_filter_json AS "audienceFilterJson",
              mailbox_ids AS "mailboxIds",
              created_by AS "createdBy", created_at AS "createdAt",
              started_at AS "startedAt", ended_at AS "endedAt"
  `;
  res.status(201).json(shapeCampaign(row));
});

// POST /api/outreach/campaigns/:id/leads — bulk add
outreachRouter.post("/campaigns/:id/leads", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "bad id" });
  const personIds = Array.isArray(req.body?.personIds)
    ? (req.body.personIds as unknown[]).map(Number).filter(Number.isFinite)
    : [];
  if (personIds.length === 0) {
    return res.json({ added: 0, skipped: 0, reasons: { missing_email: 0, draft: 0, no_email_to: 0 } });
  }
  // Resolve each person → email row for their distributor.
  const people = await sql<{
    personId: number;
    fullName: string | null;
    email: string | null;
    distributorId: string | null;
  }[]>`
    SELECT id AS "personId", full_name AS "fullName", email, distributor_id AS "distributorId"
    FROM research.person
    WHERE id IN ${sql(personIds)}
  `;
  const reasons = { missing_email: 0, draft: 0, no_email_to: 0, already_added: 0 } as Record<string, number>;
  let added = 0;
  let skipped = 0;

  for (const p of people) {
    if (!p.email) {
      reasons.missing_email += 1;
      skipped += 1;
      continue;
    }
    if (!p.distributorId || !p.fullName) {
      reasons.no_email_to += 1;
      skipped += 1;
      continue;
    }
    // Find the email row that targets this person (match by to_name OR to_email).
    const [emailRow] = await sql<{
      id: number;
      approvalStatus: string;
      toEmail: string | null;
    }[]>`
      SELECT id, approval_status AS "approvalStatus", to_email AS "toEmail"
      FROM research.email
      WHERE distributor_id = ${p.distributorId}
        AND (
          lower(coalesce(to_name, '')) = lower(${p.fullName})
          OR lower(coalesce(to_email, '')) = lower(${p.email})
        )
      ORDER BY id ASC
      LIMIT 1
    `;
    if (!emailRow) {
      reasons.missing_email += 1;
      skipped += 1;
      continue;
    }
    if (emailRow.approvalStatus === "draft") {
      reasons.draft += 1;
      skipped += 1;
      continue;
    }
    if (!emailRow.toEmail) {
      reasons.no_email_to += 1;
      skipped += 1;
      continue;
    }
    const inserted = await sql`
      INSERT INTO outreach.campaign_lead
        (campaign_id, person_id, email_id, distributor_id, status)
      VALUES
        (${id}, ${p.personId}, ${emailRow.id}, ${p.distributorId}, 'pending')
      ON CONFLICT (campaign_id, person_id) DO NOTHING
      RETURNING id
    `;
    if (inserted.length > 0) {
      added += 1;
    } else {
      reasons.already_added += 1;
      skipped += 1;
    }
  }
  res.json({ added, skipped, reasons });
});

// POST /api/outreach/campaigns/:id/start — push to Instantly
outreachRouter.post("/campaigns/:id/start", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "bad id" });
  const [c] = await sql<CampaignRow[]>`
    SELECT id, name, status, external_provider AS "externalProvider",
           external_id AS "externalId",
           sequence_json AS "sequenceJson",
           audience_filter_json AS "audienceFilterJson",
           mailbox_ids AS "mailboxIds",
           created_by AS "createdBy", created_at AS "createdAt",
           started_at AS "startedAt", ended_at AS "endedAt"
    FROM outreach.campaign WHERE id = ${id}
  `;
  if (!c) return res.status(404).json({ error: "campaign not found" });

  try {
    let externalId = c.externalId;
    if (!externalId) {
      const seq = Array.isArray(c.sequenceJson) ? (c.sequenceJson as Array<{ subject: string; body: string; waitDays: number }>) : [];
      const created = await instantly.createCampaign({ name: c.name, sequence: seq });
      externalId = created.id;
      await sql`UPDATE outreach.campaign SET external_id = ${externalId} WHERE id = ${id}`;
    }
    // Activate on Instantly
    await instantly.activate(externalId);

    // Push every lead that isn't already pushed.
    const leadsToSend = await sql<{
      id: number;
      personId: number | null;
      emailId: number | null;
      externalLeadId: string | null;
      personFullName: string | null;
      personEmail: string | null;
      emailSubject: string | null;
      emailBody: string | null;
      toEmail: string | null;
      distributorName: string | null;
    }[]>`
      SELECT cl.id, cl.person_id AS "personId", cl.email_id AS "emailId",
             cl.external_lead_id AS "externalLeadId",
             p.full_name AS "personFullName", p.email AS "personEmail",
             e.subject AS "emailSubject", e.body AS "emailBody", e.to_email AS "toEmail",
             g.name AS "distributorName"
      FROM outreach.campaign_lead cl
      LEFT JOIN research.person p ON p.id = cl.person_id
      LEFT JOIN research.email e ON e.id = cl.email_id
      LEFT JOIN distributor."DistributorGroup" g ON g.id = cl.distributor_id
      WHERE cl.campaign_id = ${id} AND cl.external_lead_id IS NULL
    `;
    let pushed = 0;
    let pushFailed = 0;
    for (const lead of leadsToSend) {
      const emailAddr = lead.toEmail || lead.personEmail;
      if (!emailAddr) {
        await sql`UPDATE outreach.campaign_lead SET status = 'skipped' WHERE id = ${lead.id}`;
        continue;
      }
      const [firstName, ...rest] = (lead.personFullName ?? "").trim().split(/\s+/);
      const lastName = rest.join(" ");
      try {
        const r = await instantly.addLead({
          campaignId: externalId,
          email: emailAddr,
          firstName: firstName || null,
          lastName: lastName || null,
          companyName: lead.distributorName,
          personalization: {
            subject: lead.emailSubject ?? "",
            body: lead.emailBody ?? "",
          },
        });
        await sql`
          UPDATE outreach.campaign_lead
          SET external_lead_id = ${(r?.id ?? null) as string | null},
              status = 'queued'
          WHERE id = ${lead.id}
        `;
        pushed += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[outreach] failed to push lead ${lead.id}:`, msg);
        await sql`UPDATE outreach.campaign_lead SET status = 'failed' WHERE id = ${lead.id}`;
        pushFailed += 1;
      }
    }

    const [updated] = await sql<CampaignRow[]>`
      UPDATE outreach.campaign
      SET status = 'running',
          external_id = ${externalId},
          started_at = COALESCE(started_at, now())
      WHERE id = ${id}
      RETURNING id, name, status, external_provider AS "externalProvider",
                external_id AS "externalId",
                sequence_json AS "sequenceJson",
                audience_filter_json AS "audienceFilterJson",
                mailbox_ids AS "mailboxIds",
                created_by AS "createdBy", created_at AS "createdAt",
                started_at AS "startedAt", ended_at AS "endedAt"
    `;
    res.json({ ...shapeCampaign(updated), pushed, pushFailed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[outreach] start campaign failed", msg);
    await sql`UPDATE outreach.campaign SET status = 'failed' WHERE id = ${id}`;
    res.status(502).json({ error: msg });
  }
});

// POST /api/outreach/campaigns/:id/pause
outreachRouter.post("/campaigns/:id/pause", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "bad id" });
  const [c] = await sql<CampaignRow[]>`SELECT id, external_id AS "externalId" FROM outreach.campaign WHERE id = ${id}`;
  if (!c) return res.status(404).json({ error: "campaign not found" });
  try {
    if (c.externalId) await instantly.pause(c.externalId);
  } catch (e) {
    console.error("[outreach] instantly pause failed", e);
  }
  const [updated] = await sql<CampaignRow[]>`
    UPDATE outreach.campaign SET status = 'paused' WHERE id = ${id}
    RETURNING id, name, status, external_provider AS "externalProvider",
              external_id AS "externalId",
              sequence_json AS "sequenceJson",
              audience_filter_json AS "audienceFilterJson",
              mailbox_ids AS "mailboxIds",
              created_by AS "createdBy", created_at AS "createdAt",
              started_at AS "startedAt", ended_at AS "endedAt"
  `;
  res.json(shapeCampaign(updated));
});

// POST /api/outreach/campaigns/:id/stop — pause on Instantly + mark done locally
outreachRouter.post("/campaigns/:id/stop", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "bad id" });
  const [c] = await sql<CampaignRow[]>`SELECT id, external_id AS "externalId" FROM outreach.campaign WHERE id = ${id}`;
  if (!c) return res.status(404).json({ error: "campaign not found" });
  try {
    if (c.externalId) await instantly.pause(c.externalId);
  } catch (e) {
    console.error("[outreach] instantly pause (stop) failed", e);
  }
  const [updated] = await sql<CampaignRow[]>`
    UPDATE outreach.campaign SET status = 'done', ended_at = now() WHERE id = ${id}
    RETURNING id, name, status, external_provider AS "externalProvider",
              external_id AS "externalId",
              sequence_json AS "sequenceJson",
              audience_filter_json AS "audienceFilterJson",
              mailbox_ids AS "mailboxIds",
              created_by AS "createdBy", created_at AS "createdAt",
              started_at AS "startedAt", ended_at AS "endedAt"
  `;
  res.json(shapeCampaign(updated));
});

// GET /api/outreach/campaigns/:id/stats — refresh from Instantly
outreachRouter.get("/campaigns/:id/stats", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "bad id" });
  const [c] = await sql<{ id: number; externalId: string | null }[]>`
    SELECT id, external_id AS "externalId" FROM outreach.campaign WHERE id = ${id}
  `;
  if (!c) return res.status(404).json({ error: "campaign not found" });

  // Stats from our DB (campaign_lead.last_event_kind)
  const statsRows = await sql<{ last_event_kind: string | null; n: number }[]>`
    SELECT last_event_kind, COUNT(*)::int AS n
    FROM outreach.campaign_lead
    WHERE campaign_id = ${id}
    GROUP BY last_event_kind
  `;
  const stats = { leads: 0, sent: 0, opened: 0, replied: 0, bounced: 0 };
  for (const r of statsRows) {
    stats.leads += r.n;
    const k = (r.last_event_kind ?? "").toLowerCase();
    if (k === "sent") stats.sent += r.n;
    else if (k === "open") stats.opened += r.n;
    else if (k === "reply") stats.replied += r.n;
    else if (k === "bounce") stats.bounced += r.n;
  }

  // Optionally overlay live Instantly numbers when available. Use
  // getAnalyticsAnyKey so the right workspace key is found even when more
  // than one is configured.
  if (c.externalId && instantly.hasKey()) {
    const a = await instantly.getAnalyticsAnyKey(c.externalId);
    if (a) {
      const sent = Number(a.sent ?? a.total_emails_sent ?? 0);
      const opened = Number(a.opened ?? a.emails_opened ?? 0);
      const replied = Number(a.replied ?? a.emails_replied ?? 0);
      const bounced = Number(a.bounced ?? a.emails_bounced ?? 0);
      if (sent > stats.sent) stats.sent = sent;
      if (opened > stats.opened) stats.opened = opened;
      if (replied > stats.replied) stats.replied = replied;
      if (bounced > stats.bounced) stats.bounced = bounced;
    }
  }
  res.json(stats);
});

// GET /api/outreach/mailboxes — live Instantly accounts merged with our local rows.
//
// Returns `{ accounts: Mailbox[], instantly: { connected, error? } }`.
// - When Instantly API works → we surface their live sending accounts (the
//   source of truth — only mailboxes actually connected via OAuth can send).
// - When Instantly errors (no plan, no key, network) → we fall back to local
//   rows + the error message, so the operator sees exactly why nothing is live.
// - Local row daily_limit / display_name override the Instantly defaults.
outreachRouter.get("/mailboxes", async (_req, res) => {
  const localRows = await sql<Array<{
    id: number; address: string; displayName: string | null; provider: string;
    externalId: string | null; dailyLimit: number | null; warmupActive: boolean;
    addedBy: string; addedAt: string;
  }>>`
    SELECT id, address, display_name AS "displayName", provider, external_id AS "externalId",
           daily_limit AS "dailyLimit", warmup_active AS "warmupActive",
           added_by AS "addedBy", added_at AS "addedAt"
    FROM outreach.mailbox
    ORDER BY added_at DESC
  `;
  // Try live Instantly accounts
  let live: Array<{ email: string; name?: string; daily_limit?: number; status?: string }> = [];
  let instantlyState: { connected: boolean; error?: string } = { connected: false, error: "not configured" };
  try {
    const accounts = await instantly.listAccounts();
    if (Array.isArray(accounts)) {
      live = accounts as typeof live;
      instantlyState = { connected: true };
    }
  } catch (e) {
    instantlyState = { connected: false, error: e instanceof Error ? e.message : String(e) };
  }

  // Index local by lower-cased address for quick merge
  const localByAddr = new Map<string, typeof localRows[number]>();
  for (const r of localRows) localByAddr.set(r.address.toLowerCase(), r);

  // Build response: live accounts first, marked as "connected"; then local-only
  // rows that aren't on Instantly, marked "unverified".
  const liveAddrSet = new Set<string>();
  const accounts: Array<{
    id: number | null; address: string; displayName: string | null; provider: string;
    externalId: string | null; dailyLimit: number | null; warmupActive: boolean;
    addedBy: string | null; addedAt: string | null;
    sourceConnected: boolean; statusNote: string | null;
  }> = [];
  for (const a of live) {
    const addr = a.email.toLowerCase();
    liveAddrSet.add(addr);
    const local = localByAddr.get(addr);
    accounts.push({
      id: local?.id ?? null,
      address: a.email,
      displayName: local?.displayName ?? a.name ?? null,
      provider: local?.provider ?? "instantly",
      externalId: local?.externalId ?? null,
      dailyLimit: local?.dailyLimit ?? a.daily_limit ?? null,
      warmupActive: local?.warmupActive ?? true,
      addedBy: local?.addedBy ?? null,
      addedAt: local?.addedAt ?? null,
      sourceConnected: true,
      statusNote: a.status ?? null,
    });
  }
  for (const r of localRows) {
    if (liveAddrSet.has(r.address.toLowerCase())) continue;
    accounts.push({ ...r, sourceConnected: false, statusNote: instantlyState.connected ? "not connected on Instantly" : null });
  }
  res.json({ accounts, instantly: instantlyState });
});

// POST /api/outreach/mailboxes
outreachRouter.post("/mailboxes", async (req, res) => {
  const { address, displayName, externalId, dailyLimit } = (req.body ?? {}) as {
    address?: string;
    displayName?: string;
    externalId?: string;
    dailyLimit?: number;
  };
  if (!address?.trim()) return res.status(400).json({ error: "address required" });
  try {
    const [row] = await sql`
      INSERT INTO outreach.mailbox
        (address, display_name, external_id, daily_limit, added_by)
      VALUES
        (${address.trim()}, ${displayName?.trim() || null}, ${externalId?.trim() || null},
         ${Number.isFinite(Number(dailyLimit)) ? Number(dailyLimit) : 50}, ${username(req)})
      RETURNING id, address, display_name AS "displayName", provider, external_id AS "externalId",
                daily_limit AS "dailyLimit", warmup_active AS "warmupActive",
                added_by AS "addedBy", added_at AS "addedAt"
    `;
    res.status(201).json(row);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate key")) return res.status(409).json({ error: "mailbox already exists" });
    res.status(500).json({ error: msg });
  }
});

// DELETE /api/outreach/mailboxes/:id
outreachRouter.delete("/mailboxes/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "bad id" });
  const rows = await sql`DELETE FROM outreach.mailbox WHERE id = ${id} RETURNING id`;
  if (rows.length === 0) return res.status(404).json({ error: "mailbox not found" });
  res.status(204).end();
});

// GET /api/outreach/instantly/stats — top-level dashboard summary
outreachRouter.get("/instantly/stats", async (_req, res) => {
  const campaigns = await sql<Array<{ id: number; name: string; status: string; externalId: string | null }>>`
    SELECT id, name, status, external_id AS "externalId"
    FROM outreach.campaign
    ORDER BY created_at DESC
  `;
  const stats = await instantly.getAllStats(campaigns);
  res.json(stats);
});
