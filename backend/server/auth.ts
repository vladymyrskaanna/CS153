import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

const COOKIE = "crm_session";
const MAX_AGE_SEC = 30 * 24 * 60 * 60;

const USERS: Record<string, { password: string; name: string; isAdmin?: boolean }> = {
  admin: { password: "BeerDist2024!", name: "Administrator", isAdmin: true },
  sales: { password: "SalesTeam#1", name: "Sales Team" },
  manager: { password: "Manager@123", name: "Manager" },
  tara: { password: "tara2025", name: "Tara" },
  diana: { password: "Diana@2026!", name: "Diana" },
};

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is required");
  return s;
}

function sign(p: string) {
  return createHmac("sha256", secret()).update(p).digest("hex");
}

function encode(username: string, expiresAt: number) {
  const p = `${username}.${expiresAt}`;
  return `${p}.${sign(p)}`;
}

function decode(token: string): { username: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [u, expStr, sig] = parts;
  const expected = sign(`${u}.${expStr}`);
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Date.now()) return null;
  return { username: u };
}

export type Session = { username: string; name: string; isAdmin: boolean };

export function setSessionCookie(res: Response, username: string) {
  const exp = Date.now() + MAX_AGE_SEC * 1000;
  const token = encode(username, exp);
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC * 1000,
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE, { path: "/" });
}

export function readSession(req: Request): Session | null {
  const raw = (req as any).cookies?.[COOKIE];
  if (!raw) return null;
  const d = decode(raw);
  if (!d) return null;
  const u = USERS[d.username];
  if (!u) return null;
  return { username: d.username, name: u.name, isAdmin: !!u.isAdmin };
}

export function attemptLogin(username: string, password: string): boolean {
  const u = USERS[username];
  return !!u && u.password === password;
}

export function listUsers(): Array<{ username: string; name: string; isAdmin: boolean }> {
  return Object.entries(USERS).map(([username, u]) => ({
    username, name: u.name, isAdmin: !!u.isAdmin,
  }));
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const s = readSession(req);
  if (!s) return res.status(401).json({ error: "Not authenticated" });
  (req as any).session = s;
  next();
}

export function requestId() {
  return randomUUID();
}
