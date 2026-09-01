import { z } from 'zod'

// ─── Schémas de validation ─────────────────────────────────────────────────────

export const registerSchema = z.object({
  username: z
    .string()
    .min(2, 'Le pseudo doit contenir au moins 2 caractères')
    .max(30, 'Le pseudo ne peut pas dépasser 30 caractères')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Le pseudo ne peut contenir que des lettres, chiffres, _ et -'),
  email: z.string().email('Email invalide').max(255),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères').max(100),
})

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

export const guestSchema = z.object({
  username: z
    .string()
    .min(2, 'Le pseudo doit contenir au moins 2 caractères')
    .max(20, 'Le pseudo ne peut pas dépasser 20 caractères')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Caractères invalides dans le pseudo'),
})

export const updateProfileSchema = z.object({
  username: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
  avatarUrl: z.string().url().optional().nullable(),
})

// ─── Type utilitaire ───────────────────────────────────────────────────────────

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type GuestInput = z.infer<typeof guestSchema>
