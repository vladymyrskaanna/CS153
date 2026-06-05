import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { apiRouter } from "./routes";
import { researchRouter } from "./research";
import { materialsRouter } from "./materials";
import { pipelineRouter } from "./pipeline";
import { reportRouter } from "./report";
import { outreachRouter, outreachWebhookRouter } from "./outreach";
import { attemptLogin, clearSessionCookie, readSession, setSessionCookie } from "./auth";

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

function loginHandler(req: express.Request, res: express.Response) {
  const { username, password } = req.body ?? {};
  if (!attemptLogin(String(username ?? ""), String(password ?? ""))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  setSessionCookie(res, username);
  res.json({ ok: true });
}
function logoutHandler(_req: express.Request, res: express.Response) {
  clearSessionCookie(res);
  res.json({ ok: true });
}
// Mount under /api (Vite proxies /api → here) AND legacy paths for v1 client.
app.post("/login", loginHandler);
app.post("/logout", logoutHandler);
app.post("/api/login", loginHandler);
app.post("/api/logout", logoutHandler);

app.get("/healthz", (req, res) => {
  res.json({ ok: true, session: readSession(req) });
});

// Public webhook receiver — MUST be mounted before the authed /api/outreach
// router so Instantly can POST without a session cookie.
app.use("/api/outreach/webhooks/instantly", outreachWebhookRouter);

app.use("/api/distributors/:id/materials", materialsRouter);
app.use("/api", pipelineRouter);    // tag, owner, users
app.use("/api", reportRouter);      // /distributors/:id/report.html
app.use("/api", apiRouter);
app.use("/api/research", researchRouter);
app.use("/api/outreach", outreachRouter);

const port = Number(process.env.API_PORT ?? 4041);
app.listen(port, () => {
  console.log(`API server on http://localhost:${port}`);
});
