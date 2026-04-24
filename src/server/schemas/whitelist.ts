import { z } from 'zod';

/**
 * Minecraft Java usernames: 3–16 chars, [A-Za-z0-9_].
 * Discord handles (new system): 2–32 chars, [a-z0-9._].
 */
const MC_USERNAME = /^[A-Za-z0-9_]{3,16}$/;
const DISCORD_HANDLE = /^[a-z0-9._]{2,32}$/;

export const WhitelistInputSchema = z.object({
  minecraftUsername: z
    .string()
    .trim()
    .regex(MC_USERNAME, 'ชื่อ Minecraft ไม่ถูกต้อง (A-Z, a-z, 0-9, _ ยาว 3–16 ตัว)'),
  discordHandle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(DISCORD_HANDLE, 'Discord handle ไม่ถูกต้อง (ใช้ username แบบใหม่ เช่น "pomelo.smp")'),
  age: z
    .number({ invalid_type_error: 'กรอกอายุเป็นตัวเลข' })
    .int()
    .min(10, 'อายุต้อง 10 ปีขึ้นไป')
    .max(99),
  whyJoin: z
    .string()
    .trim()
    .min(20, 'ช่วยเล่าให้ทีมงานอ่านหน่อย (อย่างน้อย 20 ตัวอักษร)')
    .max(1000, 'ยาวเกินไป (สูงสุด 1000 ตัวอักษร)'),
  referrer: z
    .string()
    .trim()
    .max(50)
    .transform((v) => (v === '' ? undefined : v))
    .optional(),
  // Honeypot field — bots tend to fill every input; humans won't see it.
  website: z
    .string()
    .max(0, 'Bot detected')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type WhitelistInput = z.infer<typeof WhitelistInputSchema>;

export const WhitelistIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{20,32}$/, 'Invalid application id');
