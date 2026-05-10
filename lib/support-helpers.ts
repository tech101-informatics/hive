import { Counter } from "@/models/Counter";
import { SupportCategory } from "@/models/SupportRequest";

const ALLOWED_CATEGORIES: SupportCategory[] = ["bug", "feature", "billing", "other"];
const MAX_TITLE_LEN = 200;
const MAX_DESCRIPTION_LEN = 20_000;
const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_LEN = 2_000;

export async function getNextSupportCardNumber(): Promise<number> {
  const counter = await Counter.findByIdAndUpdate(
    "supportCardNumber",
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return counter.seq;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX = /^https?:\/\/[^\s]+$/i;

export interface NormalizedTicketInput {
  title: string;
  description: string;
  submitterEmail: string;
  submitterName: string;
  category: SupportCategory;
  attachments: string[];
  externalUserId: string | null;
}

/**
 * Validate and normalize incoming ticket payload.
 * Returns { ok: true, value } on success, { ok: false, error } on validation failure.
 */
export function normalizeTicketInput(
  body: Record<string, unknown>,
): { ok: true; value: NormalizedTicketInput } | { ok: false; error: string } {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return { ok: false, error: "title is required" };
  if (title.length > MAX_TITLE_LEN) return { ok: false, error: `title exceeds ${MAX_TITLE_LEN} chars` };

  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!description) return { ok: false, error: "description is required" };
  if (description.length > MAX_DESCRIPTION_LEN) {
    return { ok: false, error: `description exceeds ${MAX_DESCRIPTION_LEN} chars` };
  }

  const submitterEmail = typeof body.submitterEmail === "string"
    ? body.submitterEmail.trim().toLowerCase()
    : "";
  if (!submitterEmail || !EMAIL_REGEX.test(submitterEmail)) {
    return { ok: false, error: "submitterEmail must be a valid email" };
  }

  const submitterName = typeof body.submitterName === "string" ? body.submitterName.trim() : "";
  if (!submitterName) return { ok: false, error: "submitterName is required" };

  let category: SupportCategory = "other";
  if (typeof body.category === "string") {
    if (!ALLOWED_CATEGORIES.includes(body.category as SupportCategory)) {
      return { ok: false, error: `category must be one of ${ALLOWED_CATEGORIES.join(", ")}` };
    }
    category = body.category as SupportCategory;
  }

  const attachmentsRaw = Array.isArray(body.attachments) ? body.attachments : [];
  if (attachmentsRaw.length > MAX_ATTACHMENTS) {
    return { ok: false, error: `attachments may not exceed ${MAX_ATTACHMENTS}` };
  }
  const attachments: string[] = [];
  for (const a of attachmentsRaw) {
    if (typeof a !== "string") return { ok: false, error: "attachments must be strings" };
    const trimmed = a.trim();
    if (trimmed.length > MAX_ATTACHMENT_LEN) {
      return { ok: false, error: "attachment URL too long" };
    }
    if (!URL_REGEX.test(trimmed)) {
      return { ok: false, error: "attachments must be http(s) URLs" };
    }
    attachments.push(trimmed);
  }

  const externalUserId = typeof body.externalUserId === "string" && body.externalUserId.trim()
    ? body.externalUserId.trim()
    : null;

  return {
    ok: true,
    value: { title, description, submitterEmail, submitterName, category, attachments, externalUserId },
  };
}

export function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return undefined;
}

/**
 * Strip identifying author info (name/email) from replies before returning to
 * the dashboard. The customer only needs to know the role + body + timestamp.
 */
type RawReply = {
  _id?: unknown;
  body?: string;
  authorRole?: string;
  createdAt?: Date | string;
};
type RawTicket = {
  replies?: RawReply[];
  archivedAt?: Date | string | null;
} & Record<string, unknown>;

export function sanitizeTicketForCustomer<T extends RawTicket>(ticket: T): T {
  const replies = (ticket.replies || []).map((r) => ({
    _id: r._id,
    body: r.body,
    authorRole: r.authorRole ?? "admin",
    createdAt: r.createdAt,
  }));
  const { archivedAt: _archivedAt, ...rest } = ticket;
  return { ...rest, replies } as T;
}
