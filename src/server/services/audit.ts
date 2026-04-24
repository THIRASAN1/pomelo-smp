import { and, count, desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { auditLog, type AuditLogEntry } from '../db/schema';
import { logger } from '../lib/logger';

export type AuditAction =
  | 'admin.login'
  | 'admin.login.failed'
  | 'admin.logout'
  | 'whitelist.submit'
  | 'whitelist.approve'
  | 'whitelist.reject';

export type AuditRecord = {
  actor: string;
  action: AuditAction;
  subjectType?: string;
  subjectId?: string;
  metadata?: Record<string, unknown>;
  ipHash?: string;
};

/**
 * Append-only: never throw (audit logging must not break the caller).
 * Failures are logged at WARN so we notice in production.
 */
export async function recordAudit(r: AuditRecord): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actor: r.actor,
      action: r.action,
      subjectType: r.subjectType ?? null,
      subjectId: r.subjectId ?? null,
      metadata: r.metadata ? JSON.stringify(r.metadata).slice(0, 4000) : null,
      ipHash: r.ipHash ?? null,
    });
  } catch (err) {
    logger.warn({ err, action: r.action, actor: r.actor }, 'audit log write failed');
  }
}

export async function listAuditForSubject(
  subjectType: string,
  subjectId: string,
  limit = 25,
): Promise<AuditLogEntry[]> {
  return db
    .select()
    .from(auditLog)
    .where(
      and(eq(auditLog.subjectType, subjectType), eq(auditLog.subjectId, subjectId)),
    )
    .orderBy(desc(auditLog.createdAt))
    .limit(Math.min(limit, 100));
}

export type AuditListFilter = {
  action?: string;
  actor?: string;
  page?: number;
  pageSize?: number;
};

export type AuditListResult = {
  items: AuditLogEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/** Paginated global audit log for admin viewers. */
export async function listAudit(filter: AuditListFilter = {}): Promise<AuditListResult> {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 50));
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (filter.action) conditions.push(eq(auditLog.action, filter.action));
  if (filter.actor) conditions.push(eq(auditLog.actor, filter.actor));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db
    .select({ count: count() })
    .from(auditLog)
    .where(where);
  const total = totalRow?.count ?? 0;

  const items = await db
    .select()
    .from(auditLog)
    .where(where)
    .orderBy(desc(auditLog.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
