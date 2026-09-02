import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { scenes } from '../../db/schema/index'

export default defineEventHandler(async () => {
  const db = useDb()
  const publishedScenes = await db
    .select()
    .from(scenes)
    .where(eq(scenes.isPublished, true))

  return publishedScenes
})
