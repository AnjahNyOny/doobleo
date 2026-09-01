import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { requireAdmin } from '../../../../../utils/guards'
import { useDb } from '../../../../../utils/db'
import { characters, lines } from '../../../../../db/schema/index'

const updateCharSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  description: z.string().optional().nullable(),
  order: z.number().int().min(0).optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const sceneId = getRouterParam(event, 'id')!
  const charId = getRouterParam(event, 'charId')!
  const method = getMethod(event)
  const db = useDb()

  const [char] = await db
    .select()
    .from(characters)
    .where(and(eq(characters.id, charId), eq(characters.sceneId, sceneId)))
    .limit(1)

  if (!char) throw createError({ statusCode: 404, message: 'Personnage introuvable.' })

  // PATCH — Mettre à jour
  if (method === 'PATCH') {
    const body = await readValidatedBody(event, updateCharSchema.parse)
    const [updated] = await db
      .update(characters)
      .set(body)
      .where(eq(characters.id, charId))
      .returning()
    return updated
  }

  // DELETE — Supprimer (si pas de répliques)
  if (method === 'DELETE') {
    const charLines = await db
      .select({ id: lines.id })
      .from(lines)
      .where(eq(lines.characterId, charId))
      .limit(1)

    if (charLines.length > 0) {
      throw createError({
        statusCode: 409,
        message: "Ce personnage a des répliques. Supprimez-les d'abord.",
      })
    }

    await db.delete(characters).where(eq(characters.id, charId))
    return { success: true }
  }

  throw createError({ statusCode: 405, message: 'Méthode non autorisée.' })
})
