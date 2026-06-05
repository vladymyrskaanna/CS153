import { Router, type Request } from "express";
import postgres from "postgres";
import { requireAuth, type Session } from "./auth";
import { instantly } from "./instantly";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = postgres(url, { max: 3, idle_timeout: 20 });

export const researchRouter = Router();
researchRouter.use(requireAuth);

function username(req: Request) {
  return (req as Request & { session: Session }).session.username;
}

// POST /api/research — enqueue
researchRouter.post("/", async (req, res) => {
  const { url: targetUrl, distributorId, force } = req.body as {
    url?: string; distributorId?: string; force?: boolean;
  };
  if (!targetUrl?.trim()) return res.status(400).json({ error: "URL required" });

  // Guard: refuse if there's already a queued/running run for this distributor.
  // Caller can still override with { force: true } AFTER user-confirmation in the UI.
  if (distributorId) {
    const [active] = await sql<Array<{ id: number; status: string }>>`
      SELECT id, status FROM research.run
      WHERE distributor_id = ${distributorId} AND status IN ('queued','running')
      ORDER BY started_at DESC LIMIT 1
    `;
    if (active && !force) {
      return res.status(409).json({
        error: "A run is already in progress for this distributor",
        activeRunId: active.id,
        status: active.status,
      });
    }
  }

  const [run] = await sql`
    INSERT INTO research.run (distributor_id, url, created_by)
    VALUES (${distributorId ?? null}, ${targetUrl.trim()}, ${username(req)})
    RETURNING id, distributor_id AS "distributorId", url, status, current_phase AS "currentPhase",
              progress_pct AS "progressPct", started_at AS "startedAt"
  `;
  res.status(201).json(run);
});

// GET /api/research/runs — list (active or recent)
researchRouter.get("/runs", async (req, res) => {
  const active = req.query.active === "1";
  const limit = Math.min(Number(req.query.limit ?? 30), 100);
  const rows = active
    ? await sql`
        SELECT id, distributor_id AS "distributorId", url, status, current_phase AS "currentPhase",
               progress_pct AS "progressPct", error, started_at AS "startedAt", updated_at AS "updatedAt"
        FROM research.run WHERE status IN ('queued','running')
        ORDER BY started_at DESC LIMIT ${limit}
      `
    : await sql`
        SELECT id, distributor_id AS "distributorId", url, status, current_phase AS "currentPhase",
               progress_pct AS "progressPct", error, started_at AS "startedAt", updated_at AS "updatedAt",
               completed_at AS "completedAt", runtime_seconds AS "runtimeSeconds",
               cost_usd AS "costUsd", web_searches AS "webSearches",
               web_search_cost_usd AS "webSearchCostUsd", llm_cost_usd AS "llmCostUsd",
               input_tokens AS "inputTokens", output_tokens AS "outputTokens"
        FROM research.run ORDER BY started_at DESC LIMIT ${limit}
      `;
  res.json(rows);
});

// GET /api/research/runs/:id — single
researchRouter.get("/runs/:id", async (req, res) => {
  const [r] = await sql`
    SELECT id, distributor_id AS "distributorId", url, status, current_phase AS "currentPhase",
           progress_pct AS "progressPct", error, started_at AS "startedAt", updated_at AS "updatedAt",
           completed_at AS "completedAt", runtime_seconds AS "runtimeSeconds"
    FROM research.run WHERE id = ${Number(req.params.id)}
  `;
  if (!r) return res.status(404).json({ error: "Not found" });
  res.json(r);
});

// GET /api/research/distributor/:id/emails — generated outreach emails
researchRouter.get("/distributor/:id/emails", async (req, res) => {
  const id = req.params.id;
  // Join in the recipient's real title from research.person so the UI can show
  // "Secretary/Treasurer" alongside the playbook role (e.g. "ceo").
  const rows = await sql`
    SELECT e.id, e.role, e.to_name AS "toName", e.to_email AS "toEmail",
           e.subject, e.body,
           e.subject_original AS "subjectOriginal", e.body_original AS "bodyOriginal",
           e.is_edited AS "isEdited", e.edited_at AS "editedAt", e.edited_by AS "editedBy",
           e.approval_status AS "approvalStatus", e.approved_by AS "approvedBy", e.approved_at AS "approvedAt",
           e.sources_md AS "sourcesMd", e.word_count AS "wordCount",
           e.safe_mode AS "safeMode", e.filename, e.created_at AS "createdAt",
           e.sent_at AS "sentAt", e.sent_to_email AS "sentToEmail",
           e.sent_via AS "sentVia", e.sent_by AS "sentBy",
           e.sent_external_id AS "sentExternalId", e.sent_error AS "sentError",
           p.title AS "recipientTitle"
    FROM research.email e
    LEFT JOIN research.person p
      ON p.distributor_id = e.distributor_id
     AND lower(p.full_name) = lower(coalesce(e.to_name, ''))
    WHERE e.distributor_id = ${id}
    ORDER BY e.id ASC
  `;
  res.json(rows);
});

// GET /api/research/distributor/:id/people/:personId/thread — outbound + inbound history
researchRouter.get("/distributor/:id/people/:personId/thread", async (req, res) => {
  const personId = Number(req.params.personId);
  const distId = req.params.id;
  // Outbound: original draft + every edit version is captured implicitly by the email row.
  // We surface (a) the canonical email (current body), (b) thread entries (campaign-sent + replies).
  const [emailRow] = await sql`
    SELECT id, subject, body, subject_original AS "subjectOriginal", body_original AS "bodyOriginal",
           is_edited AS "isEdited", approval_status AS "approvalStatus",
           edited_at AS "editedAt", edited_by AS "editedBy", approved_at AS "approvedAt",
           created_at AS "createdAt", to_email AS "toEmail"
    FROM research.email
    WHERE distributor_id = ${distId}
      AND lower(coalesce(to_name, '')) = lower((SELECT full_name FROM research.person WHERE id = ${personId}))
    ORDER BY id ASC LIMIT 1
  `;
  // Thread entries
  const threadRows = await sql`
    SELECT id, email_id AS "emailId", direction, subject, body_text AS "bodyText",
           body_html AS "bodyHtml", from_addr AS "fromAddr", to_addr AS "toAddr", occurred_at AS "occurredAt"
    FROM research.email_thread
    WHERE person_id = ${personId}
    ORDER BY occurred_at ASC
  `;
  res.json({ email: emailRow ?? null, thread: threadRows });
});

// PATCH /api/research/distributor/:id/people/:personId/outreach-status — sales lifecycle for a person
researchRouter.patch("/distributor/:id/people/:personId/outreach-status", async (req, res) => {
  const status = String(req.body?.status ?? "");
  const VALID = ["new","contacted","replied","interested","not_interested","bounced"];
  if (!VALID.includes(status)) return res.status(400).json({ error: "invalid status" });
  const [row] = await sql`
    UPDATE research.person
    SET outreach_status = ${status}::research."OutreachStatus",
        outreach_updated_at = now(),
        outreach_updated_by = ${username(req)}
    WHERE id = ${Number(req.params.personId)} AND distributor_id = ${req.params.id}
    RETURNING id, outreach_status::text AS "outreachStatus",
              outreach_updated_at AS "outreachUpdatedAt",
              outreach_updated_by AS "outreachUpdatedBy"
  `;
  if (!row) return res.status(404).json({ error: "person not found" });
  res.json(row);
});

// PATCH /api/research/distributor/:id/people/:personId — inline-edit a single person field.
// Body: { field: "title", value: "VP Sales" }
// Whitelisted fields below. Strings are trimmed; empty string clears the field (becomes NULL).
const EDITABLE_PERSON_FIELDS: Record<string, string> = {
  fullName:        "full_name",
  title:           "title",
  generation:      "generation",
  linkedinUrl:     "linkedin_url",
  photoUrl:        "photo_url",
  email:           "email",
  phone:           "phone",
  bioShort:        "bio_short",
  locationText:    "location_text",
  headline:        "headline",
  personalEmail:   "personal_email",
  twitterUrl:      "twitter_url",
  githubUrl:       "github_url",
  isDecisionMaker: "is_decision_maker",
  isDeceased:      "is_deceased",
  deathYear:       "death_year",
};
researchRouter.patch("/distributor/:id/people/:personId", async (req, res) => {
  const personId = Number(req.params.personId);
  const distId   = req.params.id;
  const { field, value } = req.body as { field?: string; value?: unknown };
  if (!field || !(field in EDITABLE_PERSON_FIELDS)) {
    return res.status(400).json({ error: "field not editable", whitelisted: Object.keys(EDITABLE_PERSON_FIELDS) });
  }
  const col = EDITABLE_PERSON_FIELDS[field]!;
  // Normalize value: trim strings, coerce booleans/numbers.
  let v: string | number | boolean | null = null;
  if (field === "isDecisionMaker" || field === "isDeceased") {
    v = !!value;
  } else if (field === "generation" || field === "deathYear") {
    v = value === "" || value == null ? null : Number(value);
    if (typeof v === "number" && !Number.isFinite(v)) {
      return res.status(400).json({ error: `${field} must be a number` });
    }
  } else {
    const s = typeof value === "string" ? value.trim() : value == null ? "" : String(value);
    v = s === "" ? null : s;
  }

  // Use sql.unsafe to interpolate the column name (whitelist already applied).
  const [row] = await sql`
    UPDATE research.person
    SET ${sql.unsafe(col)} = ${v}
    WHERE id = ${personId} AND distributor_id = ${distId}
    RETURNING id, full_name AS "fullName", title, generation, linkedin_url AS "linkedinUrl",
              photo_url AS "photoUrl", email, phone, bio_short AS "bioShort",
              location_text AS "locationText", headline,
              personal_email AS "personalEmail", twitter_url AS "twitterUrl", github_url AS "githubUrl",
              is_decision_maker AS "isDecisionMaker", is_deceased AS "isDeceased", death_year AS "deathYear"
  `;
  if (!row) return res.status(404).json({ error: "person not found" });
  res.json(row);
});

// POST /api/research/distributor/:id/people — add a new manually-entered person.
// Body: { fullName: required, title?, ... } — anything in EDITABLE_PERSON_FIELDS is accepted.
researchRouter.post("/distributor/:id/people", async (req, res) => {
  const distId = req.params.id;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  if (!fullName) return res.status(400).json({ error: "fullName is required" });

  // Check the unique (distributor_id, full_name) constraint up front so we
  // return a friendly error instead of a 500.
  const [exists] = await sql`
    SELECT id FROM research.person WHERE distributor_id = ${distId} AND full_name = ${fullName} LIMIT 1
  `;
  if (exists) return res.status(409).json({ error: "person with that name already exists at this distributor", existingId: exists.id });

  const [row] = await sql`
    INSERT INTO research.person (
      distributor_id, full_name, title, generation,
      linkedin_url, photo_url, email, phone,
      bio_short, location_text, headline,
      personal_email, twitter_url, github_url,
      is_decision_maker, is_deceased, death_year
    ) VALUES (
      ${distId}, ${fullName},
      ${typeof body.title === "string" ? body.title.trim() || null : null},
      ${body.generation != null && body.generation !== "" ? Number(body.generation) : null},
      ${typeof body.linkedinUrl === "string" ? body.linkedinUrl.trim() || null : null},
      ${typeof body.photoUrl === "string" ? body.photoUrl.trim() || null : null},
      ${typeof body.email === "string" ? body.email.trim() || null : null},
      ${typeof body.phone === "string" ? body.phone.trim() || null : null},
      ${typeof body.bioShort === "string" ? body.bioShort.trim() || null : null},
      ${typeof body.locationText === "string" ? body.locationText.trim() || null : null},
      ${typeof body.headline === "string" ? body.headline.trim() || null : null},
      ${typeof body.personalEmail === "string" ? body.personalEmail.trim() || null : null},
      ${typeof body.twitterUrl === "string" ? body.twitterUrl.trim() || null : null},
      ${typeof body.githubUrl === "string" ? body.githubUrl.trim() || null : null},
      ${!!body.isDecisionMaker}, ${!!body.isDeceased},
      ${body.deathYear != null && body.deathYear !== "" ? Number(body.deathYear) : null}
    )
    RETURNING id, distributor_id AS "distributorId",
              full_name AS "fullName", title, generation,
              linkedin_url AS "linkedinUrl", photo_url AS "photoUrl",
              email, phone, emails, phones,
              role_category AS "roleCategory",
              is_decision_maker AS "isDecisionMaker", is_deceased AS "isDeceased",
              outreach_status::text AS "outreachStatus"
  `;
  res.status(201).json(row);
});

// DELETE /api/research/distributor/:id/people/:personId — remove a person row.
// (Person dossier rows persist by default. Use this to drop accidentally-added rows.)
researchRouter.delete("/distributor/:id/people/:personId", async (req, res) => {
  const personId = Number(req.params.personId);
  const distId   = req.params.id;
  const [row] = await sql`
    DELETE FROM research.person
    WHERE id = ${personId} AND distributor_id = ${distId}
    RETURNING id
  `;
  if (!row) return res.status(404).json({ error: "person not found" });
  res.json({ ok: true, id: row.id });
});

// POST /api/research/distributor/:id/emails/:emailId/send — send this email NOW.
//
// Flow:
//   1. Validates recipient email (from body { toEmail } or from email.to_email).
//   2. Pushes to Instantly: creates a 1-step campaign with this exact
//      subject/body, adds the recipient as a single lead, activates.
//      (Instantly does the per-mailbox sending + tracking.)
//   3. Marks the email row sent_at = now(), records sent_external_id +
//      sent_via = 'instantly'.
//   4. If Instantly fails or no API key, still marks sent_at locally with
//      sent_via = 'manual' and a clear sent_error so the operator can copy
//      the email and send it from their own client.
researchRouter.post("/distributor/:id/emails/:emailId/send", async (req, res) => {
  const distId  = req.params.id;
  const emailId = Number(req.params.emailId);
  const body    = (req.body ?? {}) as {
    toEmail?: string;
    mailboxEmail?: string; // which Instantly mailbox to send FROM
    firstName?: string;
    lastName?: string;
    companyName?: string;
    manualOnly?: boolean;
  };

  const [row] = await sql`
    SELECT e.id, e.subject, e.body, e.to_name AS "toName", e.to_email AS "toEmail",
           e.approval_status AS "approvalStatus", e.sent_at AS "sentAt",
           g.name AS "distributorName"
    FROM research.email e
    LEFT JOIN distributor."DistributorGroup" g ON g.id = e.distributor_id
    WHERE e.id = ${emailId} AND e.distributor_id = ${distId}
  `;
  if (!row) return res.status(404).json({ error: "email not found" });
  if (row.sentAt) return res.status(409).json({ error: "email already sent", sentAt: row.sentAt });

  const toEmail = (body.toEmail ?? row.toEmail ?? "").trim();
  if (!toEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toEmail)) {
    return res.status(400).json({ error: "valid toEmail required" });
  }
  if (!row.subject || !row.body) {
    return res.status(400).json({ error: "email subject/body missing" });
  }

  const [firstName, ...lastBits] = (row.toName ?? "").trim().split(/\s+/);
  const lastName = lastBits.join(" ");

  // ─── Manual-only path: just mark sent locally. No Instantly call. ─────────
  if (body.manualOnly) {
    const [updated] = await sql`
      UPDATE research.email
      SET sent_at = now(),
          sent_to_email = ${toEmail},
          sent_via = 'manual',
          sent_by = ${username(req)},
          sent_external_id = NULL,
          sent_error = NULL,
          approval_status = 'approved'
      WHERE id = ${emailId} AND distributor_id = ${distId}
      RETURNING id, sent_at AS "sentAt", sent_to_email AS "sentToEmail",
                sent_via AS "sentVia", sent_by AS "sentBy",
                sent_external_id AS "sentExternalId", sent_error AS "sentError",
                approval_status AS "approvalStatus"
    `;
    return res.json(updated);
  }

  // ─── Instantly path: STRICT. If anything fails, return 502 and DO NOT mark sent. ──
  if (!instantly.hasKey()) {
    return res.status(503).json({ error: "Instantly API key not configured. Use 'Mark sent (manual)' instead." });
  }
  const mailboxEmail = (body.mailboxEmail ?? "").trim().toLowerCase();
  if (!mailboxEmail) {
    return res.status(400).json({ error: "mailboxEmail is required (which mailbox to send FROM)" });
  }
  // Resolve which workspace key owns this mailbox.
  const keyInfo = await instantly.findKeyForMailbox(mailboxEmail);
  if (!keyInfo) {
    return res.status(400).json({ error: `No Instantly workspace owns mailbox '${mailboxEmail}'` });
  }
  try {
    const campaign = await instantly.createCampaign({
      name: `[manual] ${row.distributorName ?? "send"} #${row.id}`,
      sequence: [{ subject: row.subject, body: row.body, waitDays: 0 }],
      fromMailbox: mailboxEmail,
      apiKey: keyInfo.apiKey,
    });
    await instantly.addLead({
      campaignId: campaign.id,
      email: toEmail,
      firstName: firstName || undefined,
      lastName:  lastName || undefined,
      companyName: row.distributorName ?? undefined,
      apiKey: keyInfo.apiKey,
    });
    await instantly.activate(campaign.id, keyInfo.apiKey);

    const [updated] = await sql`
      UPDATE research.email
      SET sent_at = now(),
          sent_to_email = ${toEmail},
          sent_via = 'instantly',
          sent_by = ${username(req)},
          sent_external_id = ${campaign.id},
          sent_error = NULL,
          approval_status = 'approved'
      WHERE id = ${emailId} AND distributor_id = ${distId}
      RETURNING id, sent_at AS "sentAt", sent_to_email AS "sentToEmail",
                sent_via AS "sentVia", sent_by AS "sentBy",
                sent_external_id AS "sentExternalId", sent_error AS "sentError",
                approval_status AS "approvalStatus"
    `;
    return res.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[send] Instantly push failed for email ${emailId} (mailbox ${mailboxEmail}): ${msg}`);
    // DO NOT mark sent. Return upstream error so the UI can show it.
    return res.status(502).json({
      error: "Instantly send failed — email NOT marked sent",
      details: msg,
      mailboxEmail,
      workspaceIndex: keyInfo.workspaceIndex,
    });
  }
});

// POST /api/research/distributor/:id/emails/:emailId/approve — approve an email for campaigns
researchRouter.post("/distributor/:id/emails/:emailId/approve", async (req, res) => {
  const [row] = await sql`
    UPDATE research.email
    SET approval_status = 'approved', approved_by = ${username(req)}, approved_at = now()
    WHERE id = ${Number(req.params.emailId)} AND distributor_id = ${req.params.id}
    RETURNING id, approval_status AS "approvalStatus",
              approved_by AS "approvedBy", approved_at AS "approvedAt"
  `;
  if (!row) return res.status(404).json({ error: "email not found" });
  res.json(row);
});

// PATCH /api/research/distributor/:id/emails/:emailId — edit a generated email
// Updates subject/body in-place; the _original columns remain frozen.
researchRouter.patch("/distributor/:id/emails/:emailId", async (req, res) => {
  const { subject, body } = req.body as { subject?: string; body?: string };
  if (typeof subject !== "string" && typeof body !== "string") {
    return res.status(400).json({ error: "subject or body required" });
  }
  const emailId = Number(req.params.emailId);
  if (!Number.isFinite(emailId)) return res.status(400).json({ error: "bad emailId" });
  // Fetch current row (we only update what was sent + check ownership by distributor_id)
  const [existing] = await sql`
    SELECT id, subject, body FROM research.email
    WHERE id = ${emailId} AND distributor_id = ${req.params.id}
  `;
  if (!existing) return res.status(404).json({ error: "email not found" });
  const newSubject = typeof subject === "string" ? subject : existing.subject;
  const newBody = typeof body === "string" ? body : existing.body;
  // Word count auto-recomputed for convenience
  const newWordCount = (newBody ?? "").trim().split(/\s+/).filter(Boolean).length;
  await sql`
    UPDATE research.email
    SET subject = ${newSubject},
        body = ${newBody},
        word_count = ${newWordCount},
        is_edited = TRUE,
        edited_at = now(),
        edited_by = ${username(req)},
        -- Editing bumps approval from 'draft' to 'edited_by_human'. If already
        -- 'approved' we keep it (operator chose to keep approved + edited).
        approval_status = CASE WHEN approval_status = 'draft' THEN 'edited_by_human' ELSE approval_status END
    WHERE id = ${emailId}
  `;
  const [updated] = await sql`
    SELECT id, role, to_name AS "toName", to_email AS "toEmail", subject, body,
           subject_original AS "subjectOriginal", body_original AS "bodyOriginal",
           is_edited AS "isEdited", edited_at AS "editedAt", edited_by AS "editedBy",
           approval_status AS "approvalStatus", approved_by AS "approvedBy", approved_at AS "approvedAt",
           sources_md AS "sourcesMd", word_count AS "wordCount",
           safe_mode AS "safeMode", filename, created_at AS "createdAt",
           sent_at AS "sentAt", sent_to_email AS "sentToEmail",
           sent_via AS "sentVia", sent_by AS "sentBy",
           sent_external_id AS "sentExternalId", sent_error AS "sentError"
    FROM research.email WHERE id = ${emailId}
  `;
  res.json(updated);
});

// GET /api/distributors/:id/intel — full intel package
researchRouter.get("/distributor/:id/intel", async (req, res) => {
  const id = req.params.id;
  const [intel] = await sql`SELECT * FROM research.intel WHERE distributor_id = ${id}`;
  const people = await sql`
    SELECT id, full_name AS "fullName", title, role_category AS "roleCategory", generation,
           is_decision_maker AS "isDecisionMaker", is_deceased AS "isDeceased", death_year AS "deathYear",
           linkedin_url AS "linkedinUrl", photo_url AS "photoUrl", email, phone,
           parent_id AS "parentId", spouse_id AS "spouseId",
           parent_name AS "parentName", spouse_name AS "spouseName",
           bio_short AS "bioShort", key_facts_json AS "keyFacts",
           education_json AS "education", career_summary AS "careerSummary",
           related_article_urls AS "relatedArticleUrls", extra_facts_json AS "extraFacts",
           outreach_status::text AS "outreachStatus",
           outreach_updated_at AS "outreachUpdatedAt",
           outreach_updated_by AS "outreachUpdatedBy",
           emails, phones, personal_email AS "personalEmail",
           twitter_url AS "twitterUrl", github_url AS "githubUrl",
           location_text AS "locationText", headline
    FROM research.person WHERE distributor_id = ${id}
    ORDER BY (CASE WHEN generation IS NULL THEN 99 ELSE generation END), full_name
  `;
  const articles = await sql`SELECT * FROM research.article WHERE distributor_id = ${id} ORDER BY relevance DESC NULLS LAST`;
  const facts = await sql`SELECT * FROM research.fact WHERE distributor_id = ${id} ORDER BY confidence DESC NULLS LAST`;
  const flags = await sql`SELECT * FROM research.red_flag WHERE distributor_id = ${id} ORDER BY severity DESC`;
  const [latestRun] = await sql`
    SELECT id, status, current_phase AS "currentPhase", progress_pct AS "progressPct",
           started_at AS "startedAt", completed_at AS "completedAt", runtime_seconds AS "runtimeSeconds",
           cost_usd AS "costUsd", web_searches AS "webSearches",
           web_search_cost_usd AS "webSearchCostUsd", llm_cost_usd AS "llmCostUsd",
           input_tokens AS "inputTokens", output_tokens AS "outputTokens",
           url
    FROM research.run WHERE distributor_id = ${id} ORDER BY started_at DESC LIMIT 1
  `;
  res.json({ intel: intel ?? null, people, articles, facts, flags, latestRun: latestRun ?? null });
});

// GET /api/research/distributor/:id/people/:personId — single person dossier
researchRouter.get("/distributor/:id/people/:personId", async (req, res) => {
  const personId = Number(req.params.personId);
  const [person] = await sql`
    SELECT id, distributor_id AS "distributorId",
           full_name AS "fullName", title, role_category AS "roleCategory", generation,
           is_decision_maker AS "isDecisionMaker", is_deceased AS "isDeceased", death_year AS "deathYear",
           linkedin_url AS "linkedinUrl", photo_url AS "photoUrl", email, phone,
           parent_id AS "parentId", spouse_id AS "spouseId",
           parent_name AS "parentName", spouse_name AS "spouseName",
           bio_short AS "bioShort", key_facts_json AS "keyFacts",
           education_json AS "education", experience_json AS "experience",
           career_summary AS "careerSummary",
           related_article_urls AS "relatedArticleUrls", extra_facts_json AS "extraFacts",
           outreach_status::text AS "outreachStatus",
           outreach_updated_at AS "outreachUpdatedAt",
           outreach_updated_by AS "outreachUpdatedBy",
           emails, phones, personal_email AS "personalEmail",
           twitter_url AS "twitterUrl", github_url AS "githubUrl",
           location_text AS "locationText", headline
    FROM research.person WHERE id = ${personId} AND distributor_id = ${req.params.id}
  `;
  if (!person) return res.status(404).json({ error: "Person not found" });

  // Pull related articles (URL match against person.related_article_urls).
  // JSONB column may come back as either a parsed array OR a JSON-encoded
  // string when the source pipeline double-stringified — handle both.
  const rawRelated = person.relatedArticleUrls;
  let relatedUrls: string[] = [];
  if (Array.isArray(rawRelated)) {
    relatedUrls = rawRelated.filter((u): u is string => typeof u === "string");
  } else if (typeof rawRelated === "string") {
    try {
      const parsed = JSON.parse(rawRelated);
      if (Array.isArray(parsed)) {
        relatedUrls = parsed.filter((u): u is string => typeof u === "string");
      }
    } catch { /* ignore */ }
  }
  const relatedArticles = relatedUrls.length > 0
    ? await sql`
        SELECT id, url, title, outlet, publication_date AS "publicationDate",
               article_type AS "articleType", snippet, key_quote AS "keyQuote", relevance
        FROM research.article
        WHERE distributor_id = ${req.params.id} AND url IN ${sql(relatedUrls)}
        ORDER BY relevance DESC NULLS LAST
      `
    : [];

  // Resolve parent / spouse for context
  const linked = await sql`
    SELECT id, full_name AS "fullName", title, photo_url AS "photoUrl", generation
    FROM research.person
    WHERE distributor_id = ${req.params.id}
      AND id IN (${person.parentId ?? -1}, ${person.spouseId ?? -1})
  `;
  const parent = linked.find((p) => p.id === person.parentId) ?? null;
  const spouse = linked.find((p) => p.id === person.spouseId) ?? null;

  // Children
  const children = await sql`
    SELECT id, full_name AS "fullName", title, photo_url AS "photoUrl", generation
    FROM research.person
    WHERE distributor_id = ${req.params.id} AND parent_id = ${personId}
    ORDER BY generation, full_name
  `;

  // Pull the personalized email written for THIS person, if any. Match by
  // case-insensitive full_name → to_name. The email-writer phase keys output
  // by to_name (the person's canonical full_name) so a direct match works.
  const emailRows = await sql`
    SELECT id, role, to_name AS "toName", to_email AS "toEmail", subject, body,
           subject_original AS "subjectOriginal", body_original AS "bodyOriginal",
           is_edited AS "isEdited", edited_at AS "editedAt", edited_by AS "editedBy",
           approval_status AS "approvalStatus", approved_by AS "approvedBy", approved_at AS "approvedAt",
           sources_md AS "sourcesMd", word_count AS "wordCount",
           safe_mode AS "safeMode", filename, created_at AS "createdAt"
    FROM research.email
    WHERE distributor_id = ${req.params.id}
      AND lower(coalesce(to_name, '')) = lower(${person.fullName})
    ORDER BY id ASC
    LIMIT 1
  `;
  const personalizedEmail = emailRows[0] ?? null;

  res.json({ person, relatedArticles, parent, spouse, children, personalizedEmail });
});

// GET /api/distributors/:id/family-tree — {nodes, links, spouses}
researchRouter.get("/distributor/:id/family-tree", async (req, res) => {
  const id = req.params.id;
  // Include EVERYONE (family + non-family leadership). Family members are
  // those with generation IS NOT NULL — surface that flag so the UI can
  // visually distinguish them.
  const people = await sql`
    SELECT id, full_name AS "fullName", title, generation, role_category AS "roleCategory",
           is_decision_maker AS "isDecisionMaker", is_deceased AS "isDeceased",
           parent_id AS "parentId", spouse_id AS "spouseId", bio_short AS "bioShort",
           photo_url AS "photoUrl", linkedin_url AS "linkedinUrl",
           death_year AS "deathYear", email,
           (generation IS NOT NULL) AS "isFamilyMember"
    FROM research.person
    WHERE distributor_id = ${id}
    ORDER BY (CASE WHEN generation IS NULL THEN 99 ELSE generation END), full_name
  `;
  // 1. Family lineage edges (parent_id)
  const links = people
    .filter((p) => p.parentId)
    .map((p) => ({ parentId: p.parentId, childId: p.id }));

  // 2. Synthetic reporting edges for non-family executives — so the org
  // chart reads as a real reporting hierarchy, not isolated cards.
  type Row = (typeof people)[number] & { roleCategory?: string | null };
  const rows = people as Row[];
  // Pick the "anchor CEO" — active family member with role ceo/owner/president,
  // preferring the highest generation (most recent operator).
  const family = rows.filter((p) => p.isFamilyMember && !p.isDeceased);

  // 1b. Synthetic family-lineage edges — when discover/PPB couldn't infer
  // the parent of a 3rd-gen sibling cohort, attach them to a decision-maker
  // of the previous generation so the family tree stays connected. Without
  // this, gen-3 cousins render as floating root cards next to the real tree.
  const allFamily = rows.filter((p) => p.isFamilyMember);
  const familyByGen = new Map<number, Row[]>();
  for (const p of allFamily) {
    if (p.generation == null) continue;
    if (!familyByGen.has(p.generation)) familyByGen.set(p.generation, []);
    familyByGen.get(p.generation)!.push(p);
  }
  for (const p of allFamily) {
    if (p.generation == null || p.generation <= 1) continue;
    if (p.parentId) continue;
    if (p.spouseId && allFamily.find((s) => s.id === p.spouseId)?.parentId) continue;
    const earlierGen = familyByGen.get(p.generation - 1) ?? [];
    const candidate =
      earlierGen.find((c) => c.isDecisionMaker && !c.isDeceased) ??
      earlierGen.find((c) => !c.isDeceased) ??
      earlierGen[0];
    if (candidate && candidate.id !== p.id) {
      links.push({ parentId: candidate.id, childId: p.id });
    }
  }
  const isLeader = (r: string | null | undefined) =>
    r != null && ["ceo", "owner", "president"].includes(r);
  const isVp = (r: string | null | undefined) =>
    r != null && ["cfo", "coo", "vp_sales", "vp_ops"].includes(r);
  const ceo =
    family.find((p) => isLeader(p.roleCategory ?? null)) ??
    family.sort((a, b) => (b.generation ?? 0) - (a.generation ?? 0))[0] ??
    null;

  // VPs (any) — directors fan out to them by title keyword if they match.
  const vps = rows.filter((p) => isVp(p.roleCategory ?? null) && !p.isDeceased);
  function bestVpFor(title: string | null): Row | null {
    if (!title) return null;
    const t = title.toLowerCase();
    const sales = vps.find((v) => (v.roleCategory ?? "").includes("sales"));
    const ops = vps.find((v) => (v.roleCategory ?? "").includes("ops"));
    const fin = vps.find((v) => (v.roleCategory ?? "") === "cfo");
    if (/sales|account|business dev/.test(t) && sales) return sales;
    if (/operation|warehouse|logistic|fleet|delivery/.test(t) && ops) return ops;
    if (/finance|account|cfo|controller/.test(t) && fin) return fin;
    return null;
  }

  if (ceo) {
    for (const p of rows) {
      // Skip self + already linked via family.
      if (p.id === ceo.id || p.parentId) continue;
      // Family root (no parent + is family) — let it be a top-level root.
      if (p.isFamilyMember) continue;

      let parent: Row | null = null;
      const role = p.roleCategory ?? null;
      if (isLeader(role) || isVp(role)) {
        // VPs / co-presidents → report to the family CEO.
        parent = ceo;
      } else if (role === "director" || /director|manager|head of/i.test(p.title ?? "")) {
        parent = bestVpFor(p.title ?? null) ?? ceo;
      } else {
        parent = ceo;
      }
      if (parent && parent.id !== p.id) {
        links.push({ parentId: parent.id, childId: p.id });
      }
    }
  }

  const seen = new Set<string>();
  const spouses: Array<{ aId: number; bId: number }> = [];
  for (const p of people) {
    if (p.spouseId) {
      const key = [p.id, p.spouseId].sort((a, b) => a - b).join(":");
      if (!seen.has(key)) {
        seen.add(key);
        spouses.push({ aId: p.id, bId: p.spouseId });
      }
    }
  }
  res.json({ nodes: people, links, spouses });
});
