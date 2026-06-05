/**
 * Thin Instantly.ai REST API adapter (v2).
 *
 * Auth: Bearer token via `Authorization: Bearer <INSTANTLY_API_KEY>` header.
 * Base URL: `INSTANTLY_API_BASE` env var (defaults to https://api.instantly.ai).
 *
 * Exports a single `instantly` object with high-level methods. Methods throw
 * on non-2xx HTTP responses (with the response body included in the error).
 * The only exception is `getAllStats()` which gracefully degrades when no API
 * key is configured so the dashboard can render an "Add Instantly API key"
 * CTA without an error.
 */

const API_BASE = process.env.INSTANTLY_API_BASE || "https://api.instantly.ai";

// Multi-workspace support: INSTANTLY_API_KEYS is a comma-separated list of bearer
// tokens (one per Instantly workspace). INSTANTLY_API_KEY is the legacy single-key
// env var — still honored as the primary if INSTANTLY_API_KEYS is unset.
// Writes (createCampaign / activate / pause / addLead) target the FIRST key.
// Reads (listAccounts / getAllStats) aggregate across ALL keys.
const API_KEYS: string[] = (() => {
  const multi = (process.env.INSTANTLY_API_KEYS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (multi.length > 0) return multi;
  const single = (process.env.INSTANTLY_API_KEY || "").trim();
  return single ? [single] : [];
})();

function hasKey() {
  return API_KEYS.length > 0;
}

/** Mask a token for logs: "abcd…wxyz" (first 4 + last 4). Never log the full token. */
function maskKey(k: string): string {
  if (k.length <= 8) return "****";
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

async function fetchJsonWithKey<T>(
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE.replace(/\/$/, "")}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Instantly API ${res.status} ${res.statusText} ${path} [key ${maskKey(apiKey)}]: ${text.slice(0, 500)}`,
    );
  }
  if (!text.trim()) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

/** Convenience: call with the PRIMARY (first) key — used for writes. */
async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!hasKey()) throw new Error("INSTANTLY_API_KEY(S) not configured");
  return fetchJsonWithKey<T>(API_KEYS[0]!, path, init);
}

// ----- Types (loose, since Instantly's schema evolves) -----

export type InstantlyAccount = {
  id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  warmup_status?: number | string;
  daily_limit?: number;
  status?: number | string;
  [k: string]: unknown;
};

export type InstantlyStep = {
  type: "email";
  delay: number; // days
  variants: Array<{ subject: string; body: string }>;
};

export type InstantlyAnalytics = {
  sent?: number;
  opened?: number;
  replied?: number;
  bounced?: number;
  unsubscribed?: number;
  total_emails_sent?: number;
  emails_opened?: number;
  emails_replied?: number;
  emails_bounced?: number;
  [k: string]: unknown;
};

// ----- Methods -----

async function listAccountsForKey(apiKey: string): Promise<InstantlyAccount[]> {
  const data = await fetchJsonWithKey<{ items?: InstantlyAccount[]; data?: InstantlyAccount[] } | InstantlyAccount[]>(
    apiKey,
    "/api/v2/accounts",
  );
  if (Array.isArray(data)) return data;
  return data?.items ?? data?.data ?? [];
}

/** Aggregate accounts across every configured key. Dedup by email. */
async function listAccounts(): Promise<InstantlyAccount[]> {
  if (!hasKey()) return [];
  const perKey = await Promise.all(
    API_KEYS.map(async (k, idx) => {
      try {
        const accts = await listAccountsForKey(k);
        return accts.map((a) => ({ ...a, _workspace_index: idx }));
      } catch (err) {
        console.error(`Instantly listAccounts failed for key ${maskKey(k)}: ${err instanceof Error ? err.message : err}`);
        return [];
      }
    }),
  );
  const all = perKey.flat();
  // Dedup by email (Instantly may surface the same forwarding mailbox in
  // multiple workspaces — collapse to the first occurrence).
  const seen = new Set<string>();
  const out: InstantlyAccount[] = [];
  for (const a of all) {
    const k = String(a.email ?? "").toLowerCase().trim() || `__noemail_${out.length}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}

/** Find the workspace key that owns a given mailbox email. Returns null if no
 *  configured workspace has that mailbox. */
async function findKeyForMailbox(mailboxEmail: string): Promise<{ apiKey: string; workspaceIndex: number } | null> {
  const target = mailboxEmail.toLowerCase().trim();
  if (!target) return null;
  for (let i = 0; i < API_KEYS.length; i++) {
    const k = API_KEYS[i]!;
    try {
      const accts = await listAccountsForKey(k);
      if (accts.some((a) => String(a.email ?? "").toLowerCase().trim() === target)) {
        return { apiKey: k, workspaceIndex: i };
      }
    } catch {
      // skip on auth/plan errors; this key just doesn't own the mailbox
    }
  }
  return null;
}

async function createCampaign(input: {
  name: string;
  sequence: Array<{ subject: string; body: string; waitDays: number }>;
  fromMailbox?: string;        // restrict campaign sending to this mailbox
  apiKey?: string;             // use this specific key (defaults to primary)
}): Promise<{ id: string; [k: string]: unknown }> {
  // Convert our normalized sequence shape into Instantly's nested format.
  const steps: InstantlyStep[] = input.sequence.map((s) => ({
    type: "email",
    delay: Math.max(0, Number(s.waitDays) || 0),
    variants: [{ subject: s.subject ?? "", body: s.body ?? "" }],
  }));
  const body: Record<string, unknown> = {
    name: input.name,
    // Instantly v2 validates `timezone` against a tight enum (changed in
    // 2026); we use a value known to be accepted. The UI lets users tune
    // the schedule later if needed.
    campaign_schedule: {
      schedules: [
        {
          name: "Default",
          timing: { from: "09:00", to: "17:00" },
          days: { "1": true, "2": true, "3": true, "4": true, "5": true },
          timezone: "Etc/GMT+12",
        },
      ],
    },
    sequences: [{ steps }],
  };
  if (input.fromMailbox) {
    body.email_list = [input.fromMailbox];
  }
  const key = input.apiKey ?? API_KEYS[0];
  if (!key) throw new Error("INSTANTLY_API_KEY(S) not configured");
  const res = await fetchJsonWithKey<{ id?: string; campaign_id?: string; [k: string]: unknown }>(
    key,
    "/api/v2/campaigns",
    { method: "POST", body: JSON.stringify(body) },
  );
  const id = (res?.id || res?.campaign_id || "") as string;
  if (!id) throw new Error(`Instantly createCampaign returned no id: ${JSON.stringify(res).slice(0, 300)}`);
  return { ...res, id };
}

async function addLead(input: {
  campaignId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  personalization?: Record<string, unknown>;
  apiKey?: string;
}): Promise<{ id?: string; [k: string]: unknown }> {
  const body: Record<string, unknown> = {
    campaign: input.campaignId,
    email: input.email,
  };
  if (input.firstName) body.first_name = input.firstName;
  if (input.lastName) body.last_name = input.lastName;
  if (input.companyName) body.company_name = input.companyName;
  if (input.personalization && Object.keys(input.personalization).length > 0) {
    body.personalization = input.personalization;
  }
  const key = input.apiKey ?? API_KEYS[0];
  if (!key) throw new Error("INSTANTLY_API_KEY(S) not configured");
  return fetchJsonWithKey<{ id?: string; [k: string]: unknown }>(
    key,
    "/api/v2/leads",
    { method: "POST", body: JSON.stringify(body) },
  );
}

async function activate(campaignId: string, apiKey?: string): Promise<unknown> {
  const key = apiKey ?? API_KEYS[0];
  if (!key) throw new Error("INSTANTLY_API_KEY(S) not configured");
  return fetchJsonWithKey<unknown>(
    key,
    `/api/v2/campaigns/${encodeURIComponent(campaignId)}/activate`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

async function pause(campaignId: string, apiKey?: string): Promise<unknown> {
  const key = apiKey ?? API_KEYS[0];
  if (!key) throw new Error("INSTANTLY_API_KEY(S) not configured");
  return fetchJsonWithKey<unknown>(
    key,
    `/api/v2/campaigns/${encodeURIComponent(campaignId)}/pause`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

async function getAnalytics(campaignId: string): Promise<InstantlyAnalytics> {
  return fetchJson<InstantlyAnalytics>(`/api/v2/campaigns/${encodeURIComponent(campaignId)}/analytics`);
}

/**
 * Try every configured key in order; return the first non-error analytics
 * payload that looks like it contains real data. Used when we don't know which
 * workspace owns the campaign (the externalId is workspace-scoped).
 */
async function getAnalyticsAnyKey(campaignId: string): Promise<InstantlyAnalytics | null> {
  let lastErr: unknown = null;
  for (const k of API_KEYS) {
    try {
      const a = await fetchJsonWithKey<InstantlyAnalytics>(
        k,
        `/api/v2/campaigns/${encodeURIComponent(campaignId)}/analytics`,
      );
      if (a && typeof a === "object") return a;
    } catch (err) {
      lastErr = err;
      // 404/401 → wrong workspace; try the next key
    }
  }
  if (lastErr) {
    console.error(`Instantly getAnalyticsAnyKey('${campaignId}') exhausted all keys: ${lastErr instanceof Error ? lastErr.message : lastErr}`);
  }
  return null;
}

/**
 * Aggregate stats across an array of our local campaigns. Returns a graceful
 * `{ connected: false, ... }` shape if the API key isn't configured so the
 * dashboard can render an onboarding CTA.
 */
async function getAllStats(
  campaigns: Array<{ id: number; name: string; status: string; externalId: string | null }>,
): Promise<{
  connected: boolean;
  totalCampaigns: number;
  activeCampaigns: number;
  totalSent: number;
  totalOpened: number;
  totalReplied: number;
  totalBounced: number;
  campaigns: Array<{ id: number; name: string; status: string; sent: number; opened: number; replied: number; bounced: number }>;
}> {
  const blank = {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter((c) => c.status === "running").length,
    totalSent: 0,
    totalOpened: 0,
    totalReplied: 0,
    totalBounced: 0,
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      sent: 0,
      opened: 0,
      replied: 0,
      bounced: 0,
    })),
  };
  if (!hasKey()) {
    return { connected: false, ...blank };
  }
  // Fetch analytics for any campaign that has been pushed to Instantly.
  // Try every configured workspace key — the right one returns data, the
  // wrong ones 404/401 (silently swallowed).
  const enriched = await Promise.all(
    campaigns.map(async (c) => {
      const base = { id: c.id, name: c.name, status: c.status };
      if (!c.externalId) return { ...base, sent: 0, opened: 0, replied: 0, bounced: 0 };
      const a = await getAnalyticsAnyKey(c.externalId);
      if (!a) return { ...base, sent: 0, opened: 0, replied: 0, bounced: 0 };
      return {
        ...base,
        sent: Number(a.sent ?? a.total_emails_sent ?? 0),
        opened: Number(a.opened ?? a.emails_opened ?? 0),
        replied: Number(a.replied ?? a.emails_replied ?? 0),
        bounced: Number(a.bounced ?? a.emails_bounced ?? 0),
      };
    }),
  );
  const totals = enriched.reduce(
    (acc, c) => {
      acc.totalSent += c.sent;
      acc.totalOpened += c.opened;
      acc.totalReplied += c.replied;
      acc.totalBounced += c.bounced;
      return acc;
    },
    { totalSent: 0, totalOpened: 0, totalReplied: 0, totalBounced: 0 },
  );
  return {
    connected: true,
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter((c) => c.status === "running").length,
    ...totals,
    campaigns: enriched,
  };
}

export const instantly = {
  hasKey,
  workspaceCount: () => API_KEYS.length,
  listAccounts,
  findKeyForMailbox,
  createCampaign,
  addLead,
  activate,
  pause,
  getAnalytics,
  getAnalyticsAnyKey,
  getAllStats,
};
