import { z } from 'zod';

export const LoginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const ReviewSchema = z.object({
  note: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type ReviewInput = z.infer<typeof ReviewSchema>;
