import { z } from 'zod';
import { env } from '../env';
import { TtlCache } from '../lib/cache';
import { logger } from '../lib/logger';
import { AppError } from '../lib/errors';

/**
 * Minecraft server status, fetched from mcsrvstat.us (free public API).
 * Results are cached in-process for 30s to shield the upstream from traffic.
 */

const UpstreamSchema = z.object({
  online: z.boolean(),
  ip: z.string().optional(),
  port: z.number().optional(),
  version: z.string().optional(),
  players: z
    .object({
      online: z.number(),
      max: z.number(),
      list: z
        .array(z.object({ name: z.string(), uuid: z.string().optional() }))
        .optional(),
    })
    .optional(),
  motd: z
    .object({
      raw: z.array(z.string()).optional(),
      clean: z.array(z.string()).optional(),
      html: z.array(z.string()).optional(),
    })
    .optional(),
  icon: z.string().optional(),
  hostname: z.string().optional(),
});

export type ServerStatus = {
  online: boolean;
  host: string;
  port: number;
  version?: string;
  players: { online: number; max: number; sample: string[] };
  motd?: string;
  fetchedAt: string; // ISO timestamp
};

const TTL_MS = 30_000;
const UPSTREAM_TIMEOUT_MS = 3_500;
const cache = new TtlCache<ServerStatus>(TTL_MS);

async function fetchFromUpstream(host: string, port: number): Promise<ServerStatus> {
  const url = `https://api.mcsrvstat.us/3/${encodeURIComponent(host)}:${port}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'user-agent': 'PomeloSMP-Site/1.0 (+https://pomelosmp.net)' },
    });
    if (!res.ok) {
      throw new AppError('upstream_error', `mcsrvstat returned ${res.status}`);
    }
    const raw = await res.json();
    const parsed = UpstreamSchema.parse(raw);

    const status: ServerStatus = {
      online: parsed.online,
      host: parsed.hostname ?? host,
      port: parsed.port ?? port,
      version: parsed.version,
      players: {
        online: parsed.players?.online ?? 0,
        max: parsed.players?.max ?? 0,
        sample: parsed.players?.list?.map((p) => p.name).slice(0, 20) ?? [],
      },
      motd: parsed.motd?.clean?.join(' · '),
      fetchedAt: new Date().toISOString(),
    };
    return status;
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new AppError('upstream_error', 'Upstream timed out', { expose: false });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Get live status for the configured MC host (cached 30s, single-flight). */
export async function getServerStatus(): Promise<ServerStatus> {
  const key = `${env.MC_HOST}:${env.MC_PORT}`;
  try {
    return await cache.get(key, () => fetchFromUpstream(env.MC_HOST, env.MC_PORT));
  } catch (err) {
    logger.warn({ err, host: env.MC_HOST }, 'minecraft status fetch failed — serving offline fallback');
    // Graceful degradation: never 500 the site because of a flaky upstream.
    const fallback: ServerStatus = {
      online: false,
      host: env.MC_HOST,
      port: env.MC_PORT,
      players: { online: 0, max: 0, sample: [] },
      fetchedAt: new Date().toISOString(),
    };
    return fallback;
  }
}
