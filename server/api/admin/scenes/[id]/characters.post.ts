import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireAdmin } from '../../../../utils/guards'
import { useDb } from '../../../../utils/db'
import { characters } from '../../../../db/schema/index'

const createCharSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur hex invalide (ex: #FF5733)'),
  description: z.string().optional().nullable(),
  order: z.number().int().min(0).optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const sceneId = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, createCharSchema.parse)
  const db = useDb()

  // Calculer l'ordre si non fourni
  if (body.order === undefined) {
    const existing = await db
      .select({ order: characters.order })
      .from(characters)
      .where(eq(characters.sceneId, sceneId))
    body.order = existing.length
  }

  const [character] = await db
    .insert(characters)
    .values({ ...body, sceneId })
    .returning()

  return character
})
