import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../utils/guards'
import { useDb } from '../../../utils/db'
import { scenes, rooms } from '../../../db/schema/index'
import { deleteS3Object, extractKeyFromUrl } from '../../../utils/s3'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()

  const [scene] = await db.select().from(scenes).where(eq(scenes.id, id)).limit(1)
  if (!scene) throw createError({ statusCode: 404, message: 'Scène introuvable.' })

  // Vérifier qu'aucun salon actif n'utilise cette scène
  const activeRoom = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.sceneId, id))
    .limit(1)

  if (activeRoom.length > 0) {
    throw createError({
      statusCode: 409,
      message: 'Cette scène est utilisée dans un salon actif. Impossible de la supprimer.',
    })
  }

  // Supprimer les médias S3 associés
  try {
    await deleteS3Object(extractKeyFromUrl(scene.videoUrl))
    await deleteS3Object(extractKeyFromUrl(scene.audioMeUrl))
    if (scene.thumbnailUrl) {
      await deleteS3Object(extractKeyFromUrl(scene.thumbnailUrl))
    }
  } catch {
    console.warn(
      'Impossible de supprimer certains fichiers S3 — la scène sera quand même supprimée.'
    )
  }

  // La suppression cascade sur characters, lines, recordings (via FK)
  await db.delete(scenes).where(eq(scenes.id, id))

  return { success: true }
})
