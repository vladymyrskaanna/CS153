import { Router, type Request } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync, mkdirSync, createReadStream } from "node:fs";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { requireAuth, type Session } from "./auth";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = postgres(url, { max: 3, idle_timeout: 20 });

const UPLOAD_ROOT = process.env.MATERIALS_UPLOAD_ROOT || path.join(process.cwd(), "uploads", "materials");
if (!existsSync(UPLOAD_ROOT)) mkdirSync(UPLOAD_ROOT, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const distId = req.params.id;
      const dir = path.join(UPLOAD_ROOT, distId);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const safe = `${randomUUID()}${ext}`;
      cb(null, safe);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB per file
});

export const materialsRouter = Router({ mergeParams: true });
materialsRouter.use(requireAuth);

function session(req: Request) {
  return (req as Request & { session: Session }).session;
}

// GET /api/distributors/:id/materials — list all materials
materialsRouter.get("/", async (req, res) => {
  const id = req.params.id;
  const rows = await sql`
    SELECT id, kind, title, url,
           filename, mime_type AS "mimeType", size_bytes AS "sizeBytes",
           uploaded_by AS "uploadedBy", uploaded_by_name AS "uploadedByName",
           uploaded_at AS "uploadedAt"
    FROM distributor.material
    WHERE distributor_id = ${id}
    ORDER BY uploaded_at DESC
  `;
  res.json(rows);
});

// POST /api/distributors/:id/materials — add a link
materialsRouter.post("/", async (req, res) => {
  const id = req.params.id;
  const { title, url: linkUrl } = req.body as { title?: string; url?: string };
  if (!title?.trim() || !linkUrl?.trim()) {
    return res.status(400).json({ error: "title and url required" });
  }
  const s = session(req);
  const [row] = await sql`
    INSERT INTO distributor.material (
      distributor_id, kind, title, url, uploaded_by, uploaded_by_name
    ) VALUES (
      ${id}, 'link', ${title.trim()}, ${linkUrl.trim()}, ${s.username}, ${s.name}
    )
    RETURNING id, kind, title, url,
              uploaded_by AS "uploadedBy", uploaded_by_name AS "uploadedByName",
              uploaded_at AS "uploadedAt"
  `;
  res.status(201).json(row);
});

// POST /api/distributors/:id/materials/upload — file upload
materialsRouter.post("/upload", upload.single("file"), async (req, res) => {
  const id = req.params.id;
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) return res.status(400).json({ error: "file required" });
  const title = (req.body?.title?.trim()) || file.originalname;
  const s = session(req);
  const [row] = await sql`
    INSERT INTO distributor.material (
      distributor_id, kind, title, filename, mime_type, size_bytes, storage_path,
      uploaded_by, uploaded_by_name
    ) VALUES (
      ${id}, 'file', ${title}, ${file.originalname}, ${file.mimetype}, ${file.size}, ${file.path},
      ${s.username}, ${s.name}
    )
    RETURNING id, kind, title, filename, mime_type AS "mimeType", size_bytes AS "sizeBytes",
              uploaded_by AS "uploadedBy", uploaded_by_name AS "uploadedByName",
              uploaded_at AS "uploadedAt"
  `;
  res.status(201).json(row);
});

// GET /api/distributors/:id/materials/:matId/file — stream file content
materialsRouter.get("/:matId/file", async (req, res) => {
  const [row] = await sql`
    SELECT filename, mime_type, storage_path
    FROM distributor.material
    WHERE id = ${Number(req.params.matId)} AND distributor_id = ${req.params.id} AND kind = 'file'
  `;
  if (!row?.storage_path) return res.status(404).json({ error: "not found" });
  if (!existsSync(row.storage_path)) return res.status(404).json({ error: "file missing on disk" });
  res.setHeader("Content-Type", row.mime_type || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(row.filename || "download")}"`);
  createReadStream(row.storage_path).pipe(res);
});

// DELETE /api/distributors/:id/materials/:matId
materialsRouter.delete("/:matId", async (req, res) => {
  const [row] = await sql`
    SELECT kind, storage_path FROM distributor.material
    WHERE id = ${Number(req.params.matId)} AND distributor_id = ${req.params.id}
  `;
  if (!row) return res.status(404).json({ error: "not found" });
  await sql`DELETE FROM distributor.material WHERE id = ${Number(req.params.matId)}`;
  if (row.kind === "file" && row.storage_path && existsSync(row.storage_path)) {
    fs.unlink(row.storage_path).catch(() => {});
  }
  res.status(204).end();
});
