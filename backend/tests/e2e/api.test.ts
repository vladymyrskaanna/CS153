import { describe, it, expect, beforeAll } from "vitest";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:5181";
let cookie = "";

async function login() {
  const res = await fetch(BASE + "/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "BeerDist2024!" }),
  });
  expect(res.status).toBe(200);
  const setCookie = res.headers.get("set-cookie") ?? "";
  cookie = setCookie.split(";")[0];
}

beforeAll(async () => {
  const probe = await fetch(BASE + "/").catch(() => null);
  if (!probe || !probe.ok) throw new Error(`Vite dev server not reachable at ${BASE}. Start with: pnpm dev`);
  await login();
});

async function get(path: string): Promise<Response> {
  return fetch(BASE + path, { headers: { Cookie: cookie } });
}

describe("auth", () => {
  it("/login → 200 with session cookie", async () => {
    expect(cookie).toMatch(/^crm_session=/);
  });
  it("/api/me returns admin", async () => {
    const r = await get("/api/me");
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.username).toBe("admin");
    expect(j.isAdmin).toBe(true);
  });
  it("/api/me without cookie → 401", async () => {
    const r = await fetch(BASE + "/api/me");
    expect(r.status).toBe(401);
  });
});

describe("distributors", () => {
  let firstId = "";

  it("/api/distributors lists with pagination", async () => {
    const r = await get("/api/distributors?limit=10");
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(Array.isArray(j.rows)).toBe(true);
    expect(j.rows.length).toBeLessThanOrEqual(10);
    expect(j.total).toBeGreaterThanOrEqual(5); // curated sample dataset
    firstId = j.rows[0].id;
  });

  it("rows have non-null states (effectiveStates fallback)", async () => {
    const r = await get("/api/distributors?limit=50");
    const j = await r.json();
    for (const row of j.rows) {
      expect(Array.isArray(row.states)).toBe(true);
    }
  });

  it("rows carry an org-chart people count (contactCount = research.person)", async () => {
    const r = await get("/api/distributors?limit=20");
    const j = await r.json();
    expect(j.rows.length).toBeGreaterThan(0);
    expect(j.rows.every((x: { contactCount: number }) => typeof x.contactCount === "number")).toBe(true);
    // seeded, researched distributors have a non-empty org chart
    expect(j.rows.some((x: { contactCount: number }) => x.contactCount > 0)).toBe(true);
  });

  it("?q=GULF narrows results", async () => {
    const r = await get("/api/distributors?q=GULF");
    const j = await r.json();
    expect(j.rows.some((x: { name: string }) => x.name.toUpperCase().includes("GULF"))).toBe(true);
  });

  it("/api/distributors/:id detail includes branches+contacts+notes", async () => {
    const r = await get(`/api/distributors/${firstId}`);
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(Array.isArray(j.branches)).toBe(true);
    expect(Array.isArray(j.contacts)).toBe(true);
    expect(Array.isArray(j.notes)).toBe(true);
    expect(typeof j.contactsTotal).toBe("number");
  });

  it("/api/distributors/00000…/contacts.csv → 404", async () => {
    const r = await get("/api/distributors/00000000-0000-0000-0000-000000000000/contacts.csv");
    expect(r.status).toBe(404);
  });

  it("/api/distributors/:id/contacts.csv returns CSV", async () => {
    const r = await get(`/api/distributors/${firstId}/contacts.csv`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/text\/csv/);
    const text = await r.text();
    expect(text.split("\n")[0]).toBe("First name,Last name,Title,Email,Phone,LinkedIn,Status,Seniority");
  });
});

describe("dashboard", () => {
  it("/api/dashboard returns research-oriented counts", async () => {
    const r = await get("/api/dashboard");
    const j = await r.json();
    expect(j.distributors).toBeGreaterThanOrEqual(5);
    expect(j.contacts).toBeGreaterThan(0);       // org-chart people total
    expect(j.researched).toBeGreaterThanOrEqual(0);
    expect(typeof j.withContacts).toBe("number");
  });
});

describe("create + edit", () => {
  it("create distributor → fetch by id → returns it", async () => {
    const name = `Vitest distributor ${Date.now()}`;
    const r1 = await fetch(BASE + "/api/distributors", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ name, state: "AZ", city: "Phoenix" }),
    });
    expect(r1.status).toBe(201);
    const { id } = await r1.json();
    expect(id).toMatch(/[0-9a-f-]{36}/);
    const r2 = await get(`/api/distributors/${id}`);
    const j = await r2.json();
    expect(j.name).toBe(name);
    expect(j.states).toEqual(["AZ"]);
  });

  it("update field round-trips", async () => {
    const r = await get("/api/distributors?limit=1");
    const id = (await r.json()).rows[0].id;
    const phone = `(555) ${Math.floor(Math.random() * 9000 + 1000)}`;
    const r1 = await fetch(BASE + `/api/distributors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ field: "phone", value: phone }),
    });
    expect(r1.status).toBe(200);
    const r2 = await get(`/api/distributors/${id}`);
    expect((await r2.json()).phone).toBe(phone);
  });

  it("rejects field not on the allowlist", async () => {
    const r = await get("/api/distributors?limit=1");
    const id = (await r.json()).rows[0].id;
    const r1 = await fetch(BASE + `/api/distributors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ field: "isPriority", value: "true" }),
    });
    expect(r1.status).toBe(400);
  });
});
