/**
 * Distributor tag / owner / users API.
 *
 * - PATCH /api/distributors/:id/tag    {tag: 'cold'|'warm'|'hot'|'none'}
 * - PATCH /api/distributors/:id/owner  {ownerUsername | null}
 * - GET   /api/users                   list users for the owner picker
 */
import { Router, type Request } from "express";
import postgres from "postgres";
import { requireAuth, listUsers, type Session } from "./auth";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = postgres(url, { max: 3, idle_timeout: 20 });

export const pipelineRouter = Router();
pipelineRouter.use(requireAuth);

function username(req: Request) {
  return (req as Request & { session: Session }).session.username;
}

const TAG_SET = new Set(["cold", "warm", "hot", "none"]);

// PATCH /api/distributors/:id/tag { tag }
pipelineRouter.patch("/distributors/:id/tag", async (req, res) => {
  const tag = String(req.body?.tag ?? "");
  if (!TAG_SET.has(tag)) return res.status(400).json({ error: "invalid tag" });
  const [row] = await sql`
    UPDATE distributor."DistributorGroup"
    SET tag = ${tag}, "lastUpdated" = now(), "lastUpdatedBy" = ${username(req)}, "updatedAt" = now()
    WHERE id = ${req.params.id}
    RETURNING id, tag
  `;
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

// PATCH /api/distributors/:id/owner { ownerUsername | null }
pipelineRouter.patch("/distributors/:id/owner", async (req, res) => {
  const ownerUsername = req.body?.ownerUsername ?? null;
  if (ownerUsername !== null && typeof ownerUsername !== "string") {
    return res.status(400).json({ error: "ownerUsername must be a string or null" });
  }
  if (ownerUsername !== null) {
    const u = listUsers().find((x) => x.username === ownerUsername);
    if (!u) return res.status(400).json({ error: "unknown user" });
  }
  const [row] = await sql`
    UPDATE distributor."DistributorGroup"
    SET owner_username = ${ownerUsername},
        "lastUpdated" = now(), "lastUpdatedBy" = ${username(req)}, "updatedAt" = now()
    WHERE id = ${req.params.id}
    RETURNING id, owner_username AS "ownerUsername"
  `;
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

// GET /api/users — list users for owner picker
pipelineRouter.get("/users", (_req, res) => {
  res.json(listUsers());
});
