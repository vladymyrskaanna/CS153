import { useMemo } from "react";

/**
 * Pretty HTML preview of an email body.
 *
 * Input body is markdown-ish plain text from the LLM:
 *   - paragraphs separated by blank lines
 *   - bullet lines starting with `-` or `*`
 *   - optional "**Subject:**" line at the top (gets stripped from body)
 *   - signature lines at the bottom (e.g. "Cheers, Anna")
 *
 * We render as semantic HTML: <p> per block, <ul><li> for bullets, URLs auto-linked,
 * signature visually de-emphasised. Typography is tuned for an "email shell" look.
 */
export function EmailRenderer({ subject, body }: { subject?: string | null; body: string | null }) {
  const blocks = useMemo(() => parseEmailBody(body ?? ""), [body]);

  return (
    <div className="rounded-md border border-border/60 bg-background/50 px-6 py-5 max-w-[640px] mx-auto">
      {subject ? (
        <header className="border-b border-border/40 pb-3 mb-4">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-0.5 font-medium">Subject</div>
          <h3 className="text-base font-semibold text-foreground leading-snug">{subject}</h3>
        </header>
      ) : null}
      <div
        className="text-foreground/90 font-sans"
        style={{ fontSize: "15px", lineHeight: 1.65 }}
      >
        {blocks.map((b, i) => renderBlock(b, i))}
      </div>
    </div>
  );
}

// ─── Parsing ────────────────────────────────────────────────────────────────

type Block =
  | { kind: "p"; lines: string[]; isSignature?: boolean }
  | { kind: "ul"; items: string[] };

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>()]+[^\s<>().,;!?])/gi;
const PHONE_RE = /(\+?\d[\d().\s-]{7,})/;
const SIGNATURE_OPENERS = /^(cheers|thanks|thank you|regards|best|best regards|sincerely|warmly|yours|cordially|talk soon|all the best|with appreciation)\b[,.!]?/i;

function parseEmailBody(raw: string): Block[] {
  // Strip leading "**Subject:** ..." marker (some older emails embed this).
  const cleaned = raw.replace(/^\s*\*\*subject:\*\*[^\n]*\n+/i, "").trim();
  if (!cleaned) return [];

  const paragraphs = cleaned.split(/\n\s*\n+/);
  const blocks: Block[] = [];

  // Detect a contiguous signature tail: paragraphs from the first signature opener to the end.
  let signatureStart = -1;
  for (let i = 0; i < paragraphs.length; i++) {
    const firstLine = paragraphs[i].split(/\n/)[0]?.trim() ?? "";
    if (SIGNATURE_OPENERS.test(firstLine)) {
      signatureStart = i;
      break;
    }
  }
  // Also: trailing 1-2 paragraphs that are just a short name + phone-like line.
  if (signatureStart === -1 && paragraphs.length >= 2) {
    const tail = paragraphs[paragraphs.length - 1].trim();
    const tailLines = tail.split(/\n/).map((s) => s.trim()).filter(Boolean);
    const isShortTail = tailLines.length > 0 && tailLines.length <= 4 && tailLines.every((l) => l.length < 80);
    const hasPhone = tailLines.some((l) => PHONE_RE.test(l));
    if (isShortTail && hasPhone) {
      signatureStart = paragraphs.length - 1;
    }
  }

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const lines = p.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const bulletLines = lines.filter((l) => /^[-*]\s+/.test(l));
    if (bulletLines.length === lines.length) {
      blocks.push({ kind: "ul", items: lines.map((l) => l.replace(/^[-*]\s+/, "")) });
    } else {
      blocks.push({ kind: "p", lines, isSignature: signatureStart !== -1 && i >= signatureStart });
    }
  }
  return blocks;
}

// ─── Rendering ──────────────────────────────────────────────────────────────

function renderBlock(b: Block, key: number) {
  if (b.kind === "ul") {
    return (
      <ul key={key} className="list-disc pl-6 my-3 space-y-1.5">
        {b.items.map((it, i) => (
          <li key={i}>{linkify(it)}</li>
        ))}
      </ul>
    );
  }
  if (b.isSignature) {
    return (
      <p
        key={key}
        className="text-muted-foreground"
        style={{ marginTop: "1.25em", fontSize: "13px", lineHeight: 1.55 }}
      >
        {b.lines.map((line, i) => (
          <span key={i}>
            {linkify(line)}
            {i < b.lines.length - 1 ? <br /> : null}
          </span>
        ))}
      </p>
    );
  }
  return (
    <p key={key} style={{ marginTop: key === 0 ? 0 : "1em" }}>
      {b.lines.map((line, i) => (
        <span key={i}>
          {linkify(line)}
          {i < b.lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </p>
  );
}

function linkify(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(URL_RE.source, "gi");
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    if (start > lastIdx) parts.push(text.slice(lastIdx, start));
    const url = m[0];
    const href = url.startsWith("http") ? url : `https://${url}`;
    parts.push(
      <a
        key={`u${start}`}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-primary hover:underline"
      >
        {url}
      </a>,
    );
    lastIdx = start + url.length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts.length > 0 ? parts : text;
}
