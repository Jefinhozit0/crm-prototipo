import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).toLowerCase(),
  // max evita DoS: bcrypt é caro e só considera os primeiros 72 bytes
  password: z.string().min(6).max(128),
});

export type LoginDto = z.infer<typeof loginSchema>;
