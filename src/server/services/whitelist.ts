import { and, count, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { whitelistApplications, type WhitelistApplication } from '../db/schema';
import { AppError } from '../lib/errors';
import { hashIp, randomToken } from '../lib/crypto';
import { logger } from '../lib/logger';
import type { WhitelistInput } from '../schemas/whitelist';
import { notifyApplicationReviewed, notifyWhitelistApplication } from './discord';
import { recordAudit } from './audit';

export type PublicApplication = {
  id: string;
  minecraftUsername: string;
  status: WhitelistApplication['status'];
  createdAt: string;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
};

/** Full admin-only view — includes PII-lite fields (Discord, age, motivation). */
export type AdminApplication = PublicApplication & {
  discordHandle: string;
  age: number;
  whyJoin: string;
  referrer: string | null;
};

function toPublic(row: WhitelistApplication): PublicApplication {
  return {
    id: row.id,
    minecraftUsername: row.minecraftUsername,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    reviewNote: row.reviewNote ?? null,
    reviewedBy: row.reviewedBy ?? null,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
  };
}

function toAdmin(row: WhitelistApplication): AdminApplication {
  return {
    ...toPublic(row),
    discordHandle: row.discordHandle,
    age: row.age,
    whyJoin: row.whyJoin,
    referrer: row.referrer ?? null,
  };
}

export async function submitApplication(
  input: WhitelistInput,
  meta: { ip: string; userAgent: string | null },
): Promise<PublicApplication> {
  const ipHash = hashIp(meta.ip);

  // Business rule: one pending application per Minecraft username at a time.
  const existing = await db
    .select({ id: whitelistApplications.id })
    .from(whitelistApplications)
    .where(
      and(
        eq(whitelistApplications.minecraftUsername, input.minecraftUsername),
        eq(whitelistApplications.status, 'pending'),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    throw new AppError(
      'conflict',
      'มีใบสมัครที่ยังรอพิจารณาสำหรับชื่อนี้อยู่แล้ว — รอทีมงานอนุมัติก่อนนะ',
    );
  }

  const id = randomToken(18);
  const [row] = await db
    .insert(whitelistApplications)
    .values({
      id,
      minecraftUsername: input.minecraftUsername,
      discordHandle: input.discordHandle,
      age: input.age,
      whyJoin: input.whyJoin,
      referrer: input.referrer ?? null,
      ipHash,
      userAgent: meta.userAgent?.slice(0, 500) ?? null,
    })
    .returning();

  if (!row) throw new AppError('internal_error', 'Failed to persist application', { expose: false });

  logger.info(
    { id: row.id, mc: row.minecraftUsername, ipHash },
    'whitelist application received',
  );

  void recordAudit({
    actor: 'public',
    action: 'whitelist.submit',
    subjectType: 'whitelist_application',
    subjectId: row.id,
    metadata: {
      minecraftUsername: row.minecraftUsername,
      discordHandle: row.discordHandle,
      referrer: row.referrer ?? null,
    },
    ipHash,
  });

  // Fire-and-forget — don't block the response on Discord round-trip.
  void notifyWhitelistApplication({
    id: row.id,
    minecraftUsername: row.minecraftUsername,
    discordHandle: row.discordHandle,
    age: row.age,
    whyJoin: row.whyJoin,
    referrer: row.referrer ?? undefined,
  });

  return toPublic(row);
}

export async function getApplicationById(id: string): Promise<PublicApplication | null> {
  const rows = await db
    .select()
    .from(whitelistApplications)
    .where(eq(whitelistApplications.id, id))
    .limit(1);
  return rows[0] ? toPublic(rows[0]) : null;
}

// ─── Admin-only operations ──────────────────────────────────────────────────

export async function getAdminApplication(id: string): Promise<AdminApplication | null> {
  const rows = await db
    .select()
    .from(whitelistApplications)
    .where(eq(whitelistApplications.id, id))
    .limit(1);
  return rows[0] ? toAdmin(rows[0]) : null;
}

export type AdminListFilter = {
  status?: WhitelistApplication['status'];
  page?: number;
  pageSize?: number;
};

export type AdminListResult = {
  items: AdminApplication[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export async function listAdminApplications(filter: AdminListFilter = {}): Promise<AdminListResult> {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 25));
  const offset = (page - 1) * pageSize;

  const where = filter.status ? eq(whitelistApplications.status, filter.status) : undefined;

  const [totalRow] = await db
    .select({ count: count() })
    .from(whitelistApplications)
    .where(where);
  const total = totalRow?.count ?? 0;

  const rows = await db
    .select()
    .from(whitelistApplications)
    .where(where)
    .orderBy(desc(whitelistApplications.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    items: rows.map(toAdmin),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type ApplicationStats = {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
  last24h: number;
};

export async function getApplicationStats(): Promise<ApplicationStats> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      status: whitelistApplications.status,
      count: count(),
    })
    .from(whitelistApplications)
    .groupBy(whitelistApplications.status);

  const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.count])) as Record<
    WhitelistApplication['status'],
    number | undefined
  >;

  const [last24hRow] = await db
    .select({ count: count() })
    .from(whitelistApplications)
    .where(sql`${whitelistApplications.createdAt} >= ${since.getTime()}`);

  const pending = byStatus.pending ?? 0;
  const approved = byStatus.approved ?? 0;
  const rejected = byStatus.rejected ?? 0;

  return {
    pending,
    approved,
    rejected,
    total: pending + approved + rejected,
    last24h: last24hRow?.count ?? 0,
  };
}

export type ReviewDecision = 'approved' | 'rejected';

export async function reviewApplication(
  id: string,
  decision: ReviewDecision,
  reviewer: string,
  note?: string | null,
): Promise<AdminApplication> {
  const normalized = note?.trim() || null;
  if (normalized && normalized.length > 1000) {
    throw new AppError('bad_request', 'Review note must be 1000 characters or fewer');
  }

  // Only allow transitions from `pending` → approved/rejected (idempotent guard).
  const current = await db
    .select({ status: whitelistApplications.status })
    .from(whitelistApplications)
    .where(eq(whitelistApplications.id, id))
    .limit(1);

  if (current.length === 0) {
    throw new AppError('not_found', 'ไม่พบใบสมัครนี้');
  }
  if (current[0]!.status !== 'pending') {
    throw new AppError('conflict', `ใบสมัครนี้ถูก${current[0]!.status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}ไปแล้ว`);
  }

  const [row] = await db
    .update(whitelistApplications)
    .set({
      status: decision,
      reviewNote: normalized,
      reviewedBy: reviewer,
      reviewedAt: new Date(),
    })
    .where(eq(whitelistApplications.id, id))
    .returning();

  if (!row) {
    throw new AppError('internal_error', 'Failed to update application', { expose: false });
  }

  logger.info(
    { id, decision, reviewer, noteLen: normalized?.length ?? 0 },
    'whitelist application reviewed',
  );

  // Side-effects (fire-and-forget). Failures are logged inside each helper.
  void recordAudit({
    actor: reviewer,
    action: decision === 'approved' ? 'whitelist.approve' : 'whitelist.reject',
    subjectType: 'whitelist_application',
    subjectId: id,
    metadata: {
      minecraftUsername: row.minecraftUsername,
      discordHandle: row.discordHandle,
      previousStatus: 'pending',
      newStatus: decision,
      note: normalized,
    },
  });

  void notifyApplicationReviewed({
    id: row.id,
    minecraftUsername: row.minecraftUsername,
    discordHandle: row.discordHandle,
    decision,
    reviewer,
    note: normalized,
  });

  return toAdmin(row);
}

export async function listRecentApplications(limit = 5): Promise<PublicApplication[]> {
  const rows = await db
    .select()
    .from(whitelistApplications)
    .orderBy(desc(whitelistApplications.createdAt))
    .limit(Math.min(limit, 50));
  return rows.map(toPublic);
}
