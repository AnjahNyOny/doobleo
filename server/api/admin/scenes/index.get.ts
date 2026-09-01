import { desc } from 'drizzle-orm'
import { requireAdmin } from '../../../utils/guards'
import { useDb } from '../../../utils/db'
import { scenes, characters } from '../../../db/schema/index'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb()

  const allScenes = await db.select().from(scenes).orderBy(desc(scenes.createdAt))

  // Compter les personnages pour chaque scène
  const allChars = await db
    .select({ id: characters.id, sceneId: characters.sceneId })
    .from(characters)
  const charCountByScene = allChars.reduce(
    (acc, c) => {
      acc[c.sceneId] = (acc[c.sceneId] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return allScenes.map((s) => ({
    ...s,
    characterCount: charCountByScene[s.id] ?? 0,
  }))
})
