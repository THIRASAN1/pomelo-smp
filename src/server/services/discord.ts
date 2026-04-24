import { env } from '../env';
import { logger } from '../lib/logger';

const POMELO = 0xf97316; // pomelo-500
const LEAF = 0x22c55e; // approve green
const FLESH = 0xf43f5e; // reject rose

/**
 * Small helper to POST to the configured webhook with a timeout.
 * Always resolves — swallows errors so callers can use fire-and-forget.
 */
async function postWebhook(payload: unknown, contextId: string): Promise<void> {
  if (!env.DISCORD_WEBHOOK_URL) {
    logger.debug({ contextId }, 'discord webhook not configured — skipping');
    return;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3_000);
  try {
    const res = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      logger.warn({ status: res.status, contextId }, 'discord webhook non-2xx');
    }
  } catch (err) {
    logger.warn({ err, contextId }, 'discord webhook failed');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fire-and-forget notification to a Discord webhook. Never throws — failures
 * are logged but must not block the user's request flow.
 */
export async function notifyWhitelistApplication(input: {
  id: string;
  minecraftUsername: string;
  discordHandle: string;
  age: number;
  whyJoin: string;
  referrer?: string;
}): Promise<void> {
  const payload = {
    username: 'PomeloBot',
    avatar_url: 'https://pomelosmp.net/favicon.svg',
    embeds: [
      {
        title: '🍊 Whitelist application',
        description: input.whyJoin.slice(0, 1800),
        color: POMELO,
        fields: [
          { name: 'Minecraft', value: `\`${input.minecraftUsername}\``, inline: true },
          { name: 'Discord', value: `\`${input.discordHandle}\``, inline: true },
          { name: 'Age', value: String(input.age), inline: true },
          { name: 'Referrer', value: input.referrer ?? '—', inline: true },
          { name: 'App ID', value: `\`${input.id}\``, inline: true },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'PomeloSMP' },
      },
    ],
  };

  await postWebhook(payload, input.id);
}

/**
 * Notify Discord when an admin approves or rejects an application.
 * Fire-and-forget — never blocks the moderator's action.
 */
export async function notifyApplicationReviewed(input: {
  id: string;
  minecraftUsername: string;
  discordHandle: string;
  decision: 'approved' | 'rejected';
  reviewer: string;
  note?: string | null;
}): Promise<void> {
  const approved = input.decision === 'approved';
  const payload = {
    username: 'PomeloBot',
    avatar_url: 'https://pomelosmp.net/favicon.svg',
    // Let admins @mention the applicant's Discord handle if they want — no auto-mention
    // because we only have the handle, not the snowflake id.
    embeds: [
      {
        title: approved ? '✅ Whitelist approved' : '❌ Whitelist rejected',
        description: input.note?.slice(0, 1800) || undefined,
        color: approved ? LEAF : FLESH,
        fields: [
          { name: 'Minecraft', value: `\`${input.minecraftUsername}\``, inline: true },
          { name: 'Discord', value: `\`${input.discordHandle}\``, inline: true },
          { name: 'Reviewed by', value: `\`${input.reviewer}\``, inline: true },
          { name: 'App ID', value: `\`${input.id}\``, inline: false },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'PomeloSMP · Admin action' },
      },
    ],
  };

  await postWebhook(payload, input.id);
}
