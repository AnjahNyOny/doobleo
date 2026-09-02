import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../utils/guards'
import { useDb } from '../../../utils/db'
import { scenes, characters, lines } from '../../../db/schema/index'

import { generateDownloadPresignedUrl, extractKeyFromUrl } from '../../../utils/s3'

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

  // Générer des URLs temporaires valides si accès direct R2 privé
  let videoUrl = scene.videoUrl
  let audioMeUrl = scene.audioMeUrl

  try {
    if (scene.videoUrl?.includes('.r2.cloudflarestorage.com')) {
      const videoKey = extractKeyFromUrl(scene.videoUrl)
      videoUrl = await generateDownloadPresignedUrl(videoKey, 3600)
    }
    if (scene.audioMeUrl?.includes('.r2.cloudflarestorage.com')) {
      const audioKey = extractKeyFromUrl(scene.audioMeUrl)
      audioMeUrl = await generateDownloadPresignedUrl(audioKey, 3600)
    }
  } catch (err) {
    console.warn('Erreur lors de la génération des URLs présignées R2:', err)
  }

  return {
    ...scene,
    videoUrl,
    audioMeUrl,
    characters: sceneCharacters,
    lines: sceneLines,
  }
})
