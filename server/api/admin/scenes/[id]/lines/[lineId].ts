import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireAdmin } from '../../../../../utils/guards'
import { useDb } from '../../../../../utils/db'
import { lines } from '../../../../../db/schema/index'

const updateLineSchema = z.object({
  text: z.string().min(1).optional(),
  startMs: z.number().int().min(0).optional(),
  endMs: z.number().int().min(0).optional(),
  order: z.number().int().min(0).optional(),
  characterId: z.string().uuid().optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const lineId = getRouterParam(event, 'lineId')!
  const method = getMethod(event)
  const db = useDb()

  const [line] = await db.select().from(lines).where(eq(lines.id, lineId)).limit(1)
  if (!line) throw createError({ statusCode: 404, message: 'Réplique introuvable.' })

  if (method === 'PATCH') {
    const body = await readValidatedBody(event, updateLineSchema.parse)

    if (body.startMs !== undefined && body.endMs !== undefined && body.endMs <= body.startMs) {
      throw createError({ statusCode: 400, message: 'endMs doit être supérieur à startMs.' })
    }

    const [updated] = await db.update(lines).set(body).where(eq(lines.id, lineId)).returning()
    return updated
  }

  if (method === 'DELETE') {
    await db.delete(lines).where(eq(lines.id, lineId))
    return { success: true }
  }

  throw createError({ statusCode: 405, message: 'Méthode non autorisée.' })
})
