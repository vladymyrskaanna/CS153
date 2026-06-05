// Thin fetch wrapper. All requests share cookies (same origin via Vite proxy).
async function request<T>(input: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(input, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = `${res.status} ${res.statusText}`;
    try { const j = JSON.parse(text); if (j?.error) msg = j.error; } catch {}
    throw new ApiError(msg, res.status);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  return ct.includes("application/json") ? (res.json() as Promise<T>) : (res.text() as unknown as Promise<T>);
}

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: unknown) => request<T>(url, { method: "POST", body: body == null ? undefined : JSON.stringify(body) }),
  patch: <T>(url: string, body?: unknown) => request<T>(url, { method: "PATCH", body: body == null ? undefined : JSON.stringify(body) }),
  del: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};

// ----- Types -----

export type DistributorRow = {
  id: string;
  name: string;
  website: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  states: string[];
  priority: string;
  isPriority: boolean;
  lastUpdated: string | Date | null;
  contactCount: number;
  branchCount: number;
  tag?: Tag;
  ownerUsername?: string | null;
  supplier?: Supplier | null;
  aiProcessed?: boolean;
};

export type Supplier = "molson_coors" | "ab_inbev" | "mixed" | "independent" | "none";
export const SUPPLIER_OPTIONS: Supplier[] = ["molson_coors", "ab_inbev", "mixed", "independent", "none"];
export const SUPPLIER_LABELS: Record<Supplier, string> = {
  molson_coors: "Molson Coors",
  ab_inbev: "AB InBev",
  mixed: "Mixed",
  independent: "Independent",
  none: "Unknown",
};

export type Tag = "cold" | "warm" | "hot" | "none";
export const TAG_OPTIONS: Tag[] = ["cold","warm","hot","none"];

export type OutreachStatus = "new" | "contacted" | "replied" | "interested" | "not_interested" | "bounced";
export const OUTREACH_STATUSES: OutreachStatus[] = ["new","contacted","replied","interested","not_interested","bounced"];

export type SystemUser = { username: string; name: string; isAdmin: boolean };

export type Contact = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  status: string;
  seniority: string | null;
  note?: string | null;
};

export type Branch = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  phone: string | null;
  addressFull: string | null;
};

export type Note = { id: string; text: string; user: string; date: string | Date };

export type Distributor = DistributorRow & {
  zip: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  addressFull: string | null;
  branches: Branch[];
  contacts: Contact[];
  notes: Note[];
  contactsTotal: number;
};

export type Activity = { id: string; kind: "note" | "status_change"; text: string; user: string; date: string | Date };

export type Session = { username: string; name: string; isAdmin: boolean };

// ----- Endpoints -----

export const auth = {
  login: (username: string, password: string) => api.post<{ ok: true }>("/api/login", { username, password }),
  logout: () => api.post<{ ok: true }>("/api/logout"),
  me: () => api.get<Session>("/api/me"),
};

export const distributors = {
  list: (params: URLSearchParams) => api.get<{ rows: DistributorRow[]; total: number; page: number; limit: number }>(`/api/distributors?${params}`),
  get: (id: string) => api.get<Distributor>(`/api/distributors/${id}`),
  create: (input: Record<string, string>) => api.post<{ id: string }>("/api/distributors", input),
  updateField: (id: string, field: string, value: string) => api.patch<{ ok: true }>(`/api/distributors/${id}`, { field, value }),
  addNote: (id: string, text: string) => api.post<{ ok: true }>(`/api/distributors/${id}/notes`, { text }),
  activity: (id: string) => api.get<Activity[]>(`/api/distributors/${id}/activity`),
  csvUrl: (id: string) => `/api/distributors/${id}/contacts.csv`,
  setTag: (id: string, tag: Tag) => api.patch<{ id: string; tag: Tag }>(`/api/distributors/${id}/tag`, { tag }),
  setOwner: (id: string, ownerUsername: string | null) => api.patch<{ id: string; ownerUsername: string | null }>(`/api/distributors/${id}/owner`, { ownerUsername }),
};
export const users = {
  list: () => api.get<SystemUser[]>("/api/users"),
};

export const contactApi = {
  create: (distId: string, input: Record<string, string>) => api.post<{ id: string }>(`/api/distributors/${distId}/contacts`, input),
  updateField: (distId: string, contactId: string, field: string, value: string) =>
    api.patch<{ ok: true }>(`/api/distributors/${distId}/contacts/${contactId}`, { field, value }),
  setStatus: (distId: string, contactId: string, status: string) =>
    api.patch<{ ok: true }>(`/api/distributors/${distId}/contacts/${contactId}/status`, { status }),
  logCall: (distId: string, contactId: string, contactName: string) =>
    api.post<{ ok: true }>(`/api/distributors/${distId}/contacts/${contactId}/log-call`, { contactName }),
  markEmailed: (distId: string, contactId: string, contactName: string) =>
    api.post<{ ok: true }>(`/api/distributors/${distId}/contacts/${contactId}/mark-emailed`, { contactName }),
};

export const followups = {
  schedule: (distId: string, contactName: string, when: string) =>
    api.post<{ ok: true }>(`/api/distributors/${distId}/follow-up`, { contactName, when }),
};

export const dashboard = {
  stats: () => api.get<{ distributors: number; contacts: number; withContacts: number; researched: number }>("/api/dashboard"),
};

// ----- Research / Intelligence -----

export type ResearchRun = {
  id: number;
  distributorId: string | null;
  url: string;
  status: "queued" | "running" | "done" | "failed";
  currentPhase: string;
  progressPct: number;
  error: string | null;
  startedAt: string;
  updatedAt: string;
  completedAt?: string | null;
  runtimeSeconds?: number | null;
  costUsd?: number | null;
  webSearches?: number | null;
  webSearchCostUsd?: number | null;
  llmCostUsd?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
};

export type IntelPerson = {
  id: number;
  fullName: string;
  title: string | null;
  roleCategory: string | null;
  generation: number | null;
  isDecisionMaker: boolean;
  isDeceased: boolean;
  deathYear: number | null;
  linkedinUrl: string | null;
  photoUrl: string | null;
  email: string | null;
  phone: string | null;
  parentId: number | null;
  spouseId: number | null;
  parentName: string | null;
  spouseName: string | null;
  bioShort: string | null;
  education?: Array<{ school: string; degree: string | null; year: string | number | null; activities?: string | null; source_url?: string | null }> | null;
  experience?: Array<{ title: string; company: string | null; dates: string | null; description?: string | null; source_url?: string | null }> | null;
  careerSummary?: string | null;
  relatedArticleUrls?: string[] | null;
  extraFacts?: Array<{ type: string; fact: string; source_url?: string | null }> | null;
  outreachStatus?: OutreachStatus;
  outreachUpdatedAt?: string | null;
  outreachUpdatedBy?: string | null;
  emails?: string[] | null;
  phones?: string[] | null;
  personalEmail?: string | null;
  twitterUrl?: string | null;
  githubUrl?: string | null;
  locationText?: string | null;
  headline?: string | null;
};

export type PersonDossier = {
  person: IntelPerson & { distributorId: string };
  relatedArticles: Array<{ id: number; url: string; title: string; outlet: string; publicationDate: string; articleType: string; snippet: string; keyQuote: string | null; relevance: number | null }>;
  parent: { id: number; fullName: string; title: string | null; photoUrl: string | null; generation: number | null } | null;
  spouse: { id: number; fullName: string; title: string | null; photoUrl: string | null; generation: number | null } | null;
  children: Array<{ id: number; fullName: string; title: string | null; photoUrl: string | null; generation: number | null }>;
  personalizedEmail: ResearchEmail | null;
};

export type IntelPackage = {
  intel: {
    legal_name: string;
    dba: string | null;
    state: string | null;
    website: string | null;
    founded_year: number | null;
    employee_count: number | null;
    account_count: number | null;
    primary_supplier: string | null;
    brands_json: string[] | null;
    score: number | null;
    tier: string | null;
    red_flag_severity: string | null;
    founding_moment: string | null;
    summary: string | null;
    updated_at: string;
  } | null;
  people: IntelPerson[];
  articles: Array<{ id: number; url: string; title: string; outlet: string; publication_date: string; article_type: string; subject_person: string | null; snippet: string; key_quote: string | null; relevance: number | null }>;
  facts: Array<{ id: number; fact_type: string; subject: string; predicate: string; object: string; verbatim_quote: string; article_id: number | null; confidence: number | null; validated: boolean }>;
  flags: Array<{ id: number; flag_type: string; severity: string; description: string; source_url: string | null }>;
  latestRun: ResearchRun | null;
};

export type OrgTreeNode = IntelPerson & {
  isFamilyMember: boolean;
};

export type FamilyTree = {
  nodes: OrgTreeNode[];
  links: Array<{ parentId: number; childId: number }>;
  spouses: Array<{ aId: number; bId: number }>;
};

export type Material = {
  id: number;
  kind: "link" | "file";
  title: string;
  url: string | null;
  filename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedBy: string;
  uploadedByName: string | null;
  uploadedAt: string;
};

export const materials = {
  list: (distributorId: string) => api.get<Material[]>(`/api/distributors/${distributorId}/materials`),
  addLink: (distributorId: string, body: { title: string; url: string }) =>
    api.post<Material>(`/api/distributors/${distributorId}/materials`, body),
  uploadFile: async (distributorId: string, file: File, title?: string) => {
    const fd = new FormData();
    fd.append("file", file);
    if (title) fd.append("title", title);
    const res = await fetch(`/api/distributors/${distributorId}/materials/upload`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    if (!res.ok) {
      const text = await res.text();
      let msg = `${res.status} ${res.statusText}`;
      try { const j = JSON.parse(text); if (j?.error) msg = j.error; } catch {}
      throw new ApiError(msg, res.status);
    }
    return (await res.json()) as Material;
  },
  fileUrl: (distributorId: string, materialId: number) =>
    `/api/distributors/${distributorId}/materials/${materialId}/file`,
  remove: (distributorId: string, materialId: number) =>
    api.del<void>(`/api/distributors/${distributorId}/materials/${materialId}`),
};

export type ResearchEmail = {
  id: number;
  role: string | null;
  toName: string | null;
  toEmail: string | null;
  subject: string | null;
  body: string | null;
  subjectOriginal: string | null;
  bodyOriginal: string | null;
  isEdited: boolean;
  editedAt: string | null;
  editedBy: string | null;
  approvalStatus: "draft" | "edited_by_human" | "approved";
  approvedBy: string | null;
  approvedAt: string | null;
  sourcesMd: string | null;
  wordCount: number | null;
  safeMode: boolean;
  filename: string | null;
  createdAt: string;
  recipientTitle?: string | null;
  sentAt?: string | null;
  sentToEmail?: string | null;
  sentVia?: "instantly" | "manual" | null;
  sentBy?: string | null;
  sentExternalId?: string | null;
  sentError?: string | null;
};

export type EmailThreadItem = {
  id: number;
  emailId: number | null;
  direction: "out" | "in";
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  fromAddr: string | null;
  toAddr: string | null;
  occurredAt: string;
};

export type Mailbox = {
  id: number | null;
  address: string;
  displayName: string | null;
  provider: string;
  externalId: string | null;
  dailyLimit: number | null;
  warmupActive: boolean;
  addedBy: string | null;
  addedAt: string | null;
  sourceConnected: boolean;
  statusNote: string | null;
};

export type MailboxesResponse = {
  accounts: Mailbox[];
  instantly: { connected: boolean; error?: string };
};


export const research = {
  enqueue: (url: string, distributorId?: string, force?: boolean) =>
    api.post<ResearchRun>("/api/research/", { url, distributorId, force }),
  run: (id: number) => api.get<ResearchRun>(`/api/research/runs/${id}`),
  intel: (distributorId: string) => api.get<IntelPackage>(`/api/research/distributor/${distributorId}/intel`),
  familyTree: (distributorId: string) => api.get<FamilyTree>(`/api/research/distributor/${distributorId}/family-tree`),
  person: (distributorId: string, personId: number | string) =>
    api.get<PersonDossier>(`/api/research/distributor/${distributorId}/people/${personId}`),
  emails: (distributorId: string) => api.get<ResearchEmail[]>(`/api/research/distributor/${distributorId}/emails`),
  updateEmail: (distributorId: string, emailId: number, patch: { subject?: string; body?: string }) =>
    api.patch<ResearchEmail>(`/api/research/distributor/${distributorId}/emails/${emailId}`, patch),
  approveEmail: (distributorId: string, emailId: number) =>
    api.post<{ id: number; approvalStatus: "approved"; approvedBy: string; approvedAt: string }>(
      `/api/research/distributor/${distributorId}/emails/${emailId}/approve`,
    ),
  sendEmail: (distributorId: string, emailId: number, payload: { toEmail: string; mailboxEmail?: string; manualOnly?: boolean }) =>
    api.post<{ id: number; sentAt: string; sentToEmail: string; sentVia: "instantly" | "manual"; sentBy: string; sentExternalId: string | null; sentError: string | null; approvalStatus: "approved" }>(
      `/api/research/distributor/${distributorId}/emails/${emailId}/send`,
      payload,
    ),
  setOutreachStatus: (distributorId: string, personId: number, status: OutreachStatus) =>
    api.patch<{ id: number; outreachStatus: OutreachStatus; outreachUpdatedAt: string; outreachUpdatedBy: string }>(
      `/api/research/distributor/${distributorId}/people/${personId}/outreach-status`,
      { status },
    ),
  thread: (distributorId: string, personId: number) =>
    api.get<{ email: ResearchEmail | null; thread: EmailThreadItem[] }>(
      `/api/research/distributor/${distributorId}/people/${personId}/thread`,
    ),
  // Inline-edit a single field on a person row.
  updatePerson: (distributorId: string, personId: number, field: string, value: string | number | boolean | null) =>
    api.patch<IntelPerson>(
      `/api/research/distributor/${distributorId}/people/${personId}`,
      { field, value },
    ),
  // Add a manually-entered person (fullName required).
  addPerson: (distributorId: string, body: Partial<IntelPerson> & { fullName: string }) =>
    api.post<IntelPerson>(`/api/research/distributor/${distributorId}/people`, body),
  // Delete a person row (manual cleanup).
  deletePerson: (distributorId: string, personId: number) =>
    api.del<{ ok: true; id: number }>(`/api/research/distributor/${distributorId}/people/${personId}`),
};

export const outreach = {
  // Mailbox list — used by the per-distributor Emails tab to pick a sender.
  listMailboxes: () => api.get<MailboxesResponse>("/api/outreach/mailboxes"),
};
