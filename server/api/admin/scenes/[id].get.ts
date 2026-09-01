import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../../utils/guards'
import { useDb } from '../../../../utils/db'
import { scenes, characters, lines } from '../../../../db/schema/index'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()

  const [scene] = await db.select().from(scenes).where(eq(scenes.id, id)).limit(1)
  if (!scene) throw createError({ statusCode: 404, message: 'Scène introuvable.' })

  const sceneCharacters = await db
    .select()
    .from(characters)
    .where(eq(characters.sceneId, id))
    .orderBy(characters.order)

  const sceneLines = await db.select().from(lines).where(eq(lines.sceneId, id)).orderBy(lines.order)

  return { ...scene, characters: sceneCharacters, lines: sceneLines }
})
