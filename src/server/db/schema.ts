import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

/**
 * Whitelist applications.
 * - `id` is a URL-safe random token (given back to the applicant so they can check status).
 * - `status` state machine: pending → approved | rejected.
 */
export const whitelistApplications = sqliteTable(
  'whitelist_applications',
  {
    id: text('id').primaryKey(),
    minecraftUsername: text('minecraft_username').notNull(),
    discordHandle: text('discord_handle').notNull(),
    age: integer('age').notNull(),
    whyJoin: text('why_join').notNull(),
    referrer: text('referrer'),
    status: text('status', { enum: ['pending', 'approved', 'rejected'] })
      .notNull()
      .default('pending'),
    reviewNote: text('review_note'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp_ms' }),
    ipHash: text('ip_hash').notNull(),
    userAgent: text('user_agent'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    statusIdx: index('wl_status_idx').on(t.status),
    createdIdx: index('wl_created_idx').on(t.createdAt),
    mcUsernameIdx: index('wl_mc_username_idx').on(t.minecraftUsername),
  }),
);

/**
 * Admin session tokens. Stored in the DB (not a JWT) so we can revoke them
 * instantly and rotate secrets without invalidating existing sessions.
 */
export const adminSessions = sqliteTable(
  'admin_sessions',
  {
    id: text('id').primaryKey(), // opaque random token; never exposed in URLs
    username: text('username').notNull(),
    ipHash: text('ip_hash').notNull(),
    userAgent: text('user_agent'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => ({
    expiresIdx: index('adm_expires_idx').on(t.expiresAt),
  }),
);

export type AdminSession = typeof adminSessions.$inferSelect;

/**
 * Immutable append-only audit log of admin actions.
 * Every state-changing admin operation writes one row here.
 */
export const auditLog = sqliteTable(
  'audit_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    actor: text('actor').notNull(), // admin username (or 'system' for background jobs)
    action: text('action').notNull(), // e.g. 'whitelist.approve', 'whitelist.reject', 'admin.login'
    subjectType: text('subject_type'), // e.g. 'whitelist_application'
    subjectId: text('subject_id'),
    // JSON-encoded payload with extra context (before/after, note, etc.)
    metadata: text('metadata'),
    ipHash: text('ip_hash'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    actorIdx: index('audit_actor_idx').on(t.actor),
    actionIdx: index('audit_action_idx').on(t.action),
    subjectIdx: index('audit_subject_idx').on(t.subjectType, t.subjectId),
    createdIdx: index('audit_created_idx').on(t.createdAt),
  }),
);

export type AuditLogEntry = typeof auditLog.$inferSelect;

export type WhitelistApplication = typeof whitelistApplications.$inferSelect;
export type NewWhitelistApplication = typeof whitelistApplications.$inferInsert;

/**
 * Simple per-(key,bucket) rate-limit counter stored in SQLite.
 * Bucket is a time window identifier (e.g. "whitelist:2026-04-25T00").
 * The sliding-window logic lives in the service layer; the DB just persists counters.
 */
export const rateLimits = sqliteTable(
  'rate_limits',
  {
    key: text('key').notNull(), // e.g. "whitelist:<ipHash>"
    bucket: text('bucket').notNull(), // time bucket identifier
    hits: integer('hits').notNull().default(0),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => ({
    pk: index('rl_pk').on(t.key, t.bucket),
    expiresIdx: index('rl_expires_idx').on(t.expiresAt),
  }),
);
