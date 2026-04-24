import { z } from 'zod';

/**
 * Fail-fast environment validation.
 * Any mis-configuration crashes the server on boot instead of at runtime.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4321),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),

  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:4321')
    .transform((s) =>
      s
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),

  APP_SECRET: z
    .string()
    .min(32, 'APP_SECRET must be at least 32 characters. Generate one with `node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"`.'),

  DATABASE_URL: z.string().default('file:./data/pomelo.db'),

  // Admin panel — if either is missing the /admin/* routes are disabled.
  ADMIN_USERNAME: z
    .string()
    .min(1)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  ADMIN_PASSWORD_HASH: z
    .string()
    .regex(/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/, 'ADMIN_PASSWORD_HASH must be generated via `npm run admin:hash <password>`')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24),

  MC_HOST: z.string().default('play.pomelosmp.net'),
  MC_PORT: z.coerce.number().int().positive().default(25565),

  DISCORD_WEBHOOK_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal('').transform(() => undefined)),

  RATE_LIMIT_WHITELIST_PER_HOUR: z.coerce.number().int().positive().default(3),
  RATE_LIMIT_API_PER_MINUTE: z.coerce.number().int().positive().default(60),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Set `SKIP_ENV_VALIDATION=true` in the build environment to bypass strict
 * validation during `astro build` prerendering on CI/hosts (Netlify, Vercel,
 * etc.) where runtime secrets aren't injected during the build phase. At
 * actual server start (NODE_ENV=production without the skip flag), we still
 * fail fast on missing/invalid env.
 */
const SKIP = process.env.SKIP_ENV_VALIDATION === 'true' || process.env.SKIP_ENV_VALIDATION === '1';

function load(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('✖ Invalid environment variables:');
    for (const issue of parsed.error.issues) {
      // eslint-disable-next-line no-console
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    if (SKIP) {
      // eslint-disable-next-line no-console
      console.warn(
        '⚠ SKIP_ENV_VALIDATION is set — returning a stub env. This is only safe during build/prerender.',
      );
      // Generate a valid-looking stub so the schema types still hold. The real
      // server will crash at runtime if these aren't set to real values.
      return EnvSchema.parse({
        APP_SECRET: 'build-time-placeholder-'.padEnd(48, 'x'),
        ...process.env,
      });
    }
    process.exit(1);
  }
  return parsed.data;
}

export const env = load();
export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
