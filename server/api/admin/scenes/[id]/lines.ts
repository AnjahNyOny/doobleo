import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { requireAdmin } from '../../../../../utils/guards'
import { useDb } from '../../../../../utils/db'
import { lines, characters } from '../../../../../db/schema/index'

const lineSchema = z.object({
  characterId: z.string().uuid(),
  text: z.string().min(1),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  order: z.number().int().min(0).optional(),
})

const bulkLinesSchema = z.object({
  lines: z.array(lineSchema),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const sceneId = getRouterParam(event, 'id')!
  const method = getMethod(event)
  const db = useDb()

  // GET — Récupérer toutes les répliques de la scène
  if (method === 'GET') {
    return db.select().from(lines).where(eq(lines.sceneId, sceneId)).orderBy(lines.order)
  }

  // POST — Créer une réplique
  if (method === 'POST') {
    const body = await readValidatedBody(event, lineSchema.parse)

    // Vérifier que le personnage appartient à la scène
    const [char] = await db
      .select()
      .from(characters)
      .where(and(eq(characters.id, body.characterId), eq(characters.sceneId, sceneId)))
      .limit(1)
    if (!char)
      throw createError({ statusCode: 400, message: 'Personnage invalide pour cette scène.' })

    // Vérifier chevauchement de timecodes
    if (body.endMs <= body.startMs) {
      throw createError({ statusCode: 400, message: 'endMs doit être supérieur à startMs.' })
    }

    const order =
      body.order ?? (await db.select().from(lines).where(eq(lines.sceneId, sceneId))).length

    const [line] = await db
      .insert(lines)
      .values({ ...body, sceneId, order })
      .returning()

    return line
  }

  // PUT — Remplacer toutes les répliques en bulk (import JSON)
  if (method === 'PUT') {
    const body = await readValidatedBody(event, bulkLinesSchema.parse)

    // Supprimer les anciennes et réinsérer
    await db.delete(lines).where(eq(lines.sceneId, sceneId))

    if (body.lines.length > 0) {
      const toInsert = body.lines.map((l, i) => ({
        ...l,
        sceneId,
        order: l.order ?? i,
      }))
      await db.insert(lines).values(toInsert)
    }

    return db.select().from(lines).where(eq(lines.sceneId, sceneId)).orderBy(lines.order)
  }

  throw createError({ statusCode: 405, message: 'Méthode non autorisée.' })
})
