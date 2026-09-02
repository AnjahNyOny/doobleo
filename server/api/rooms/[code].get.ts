import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { rooms, scenes, characters } from '../../db/schema/index'

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code')?.toUpperCase()
  if (!code || code.length !== 6) {
    throw createError({ statusCode: 400, message: 'Code de salon invalide.' })
  }

  const db = useDb()

  const [room] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1)
  if (!room) {
    throw createError({ statusCode: 404, message: 'Salon introuvable.' })
  }

  // On renvoie aussi les infos de la scène
  const [scene] = await db.select().from(scenes).where(eq(scenes.id, room.sceneId!)).limit(1)
  const sceneCharacters = await db.select().from(characters).where(eq(characters.sceneId, scene.id))
  
  // Importer lines from schema
  const { lines } = await import('../../db/schema/index')
  const sceneLines = await db.select().from(lines).where(eq(lines.sceneId, scene.id)).orderBy(lines.order)

  const { generateDownloadPresignedUrl, extractKeyFromUrl } = await import('../../utils/s3')

  let videoUrl = scene.videoUrl
  let audioMeUrl = scene.audioMeUrl
  let audioVocalsUrl = scene.audioVocalsUrl

  try {
    if (scene.videoUrl?.includes('.r2.cloudflarestorage.com')) {
      const videoKey = extractKeyFromUrl(scene.videoUrl)
      videoUrl = await generateDownloadPresignedUrl(videoKey, 3600)
    }
    if (scene.audioMeUrl?.includes('.r2.cloudflarestorage.com')) {
      const audioKey = extractKeyFromUrl(scene.audioMeUrl)
      audioMeUrl = await generateDownloadPresignedUrl(audioKey, 3600)
    }
    if (scene.audioVocalsUrl?.includes('.r2.cloudflarestorage.com')) {
      const vocalsKey = extractKeyFromUrl(scene.audioVocalsUrl)
      audioVocalsUrl = await generateDownloadPresignedUrl(vocalsKey, 3600)
    }
  } catch (err) {
    console.warn('Erreur lors de la génération des URLs présignées R2:', err)
  }

  return {
    ...room,
    scene: {
      ...scene,
      videoUrl,
      audioMeUrl,
      audioVocalsUrl,
      characters: sceneCharacters,
      lines: sceneLines,
    },
  }
})
