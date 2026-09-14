import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'
import Replicate from 'replicate'
import { eq } from 'drizzle-orm'
import { useDb } from '../utils/db'
import { scenes } from '../db/schema/index'
import { mixingQueue, audioSeparationQueue } from '../services/queue'

// Tell fluent-ffmpeg where the binary is
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath)
}

export default defineNitroPlugin(() => {
  // ─── 1. Worker de mixage (Existant) ────────────────────────────────────────
  mixingQueue.process(async (job) => {
    const data = job.data
    // Récupérer les infos de la scène
    const db = useDb()
    const [scene] = await db.select().from(scenes).where(eq(scenes.id, data.sceneId)).limit(1)

    if (!scene) throw new Error('Scene not found')

    let finalUrl: string
    try {
      const { processMixJob } = await import('../utils/mixer')
      finalUrl = await processMixJob(data, scene)

      if (global.__io) {
        global.__io.to(data.roomCode).emit('mix_ready', { url: finalUrl })
      }
    } catch (err: any) {
      console.error('Mix job failed:', err)
      if (global.__io) {
        global.__io
          .to(data.roomCode)
          .emit('mix_error', { message: `Erreur lors du mixage: ${err.message || err}` })
      }
      throw err
    }
    return finalUrl
  })

  // ─── 2. Worker de séparation audio (Nouveau) ───────────────────────────────
  audioSeparationQueue.process(async (job) => {
    const { sceneId, videoUrl } = job.data
    console.log(`[Worker] Début séparation audio pour la scène ${sceneId}...`)

    let vocalsUrl: string | undefined
    let accompanimentUrl: string | undefined

    if (process.env.REPLICATE_API_TOKEN && process.env.REPLICATE_API_TOKEN !== 'CHANGE_ME') {
      const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })

      const output = (await replicate.run(
        'cjwbw/demucs:25a173108cff36ef9f80f854c162d01df9e6528be175794b81158fa03836d953',
        { input: { audio: videoUrl, stems: 'two' } }
      )) as any

      vocalsUrl = output?.vocals || output?.other || ''
      accompanimentUrl = output?.accompaniment || output?.no_vocals || ''
    } else if (process.env.HUGGINGFACE_TOKEN && process.env.HUGGINGFACE_TOKEN !== 'CHANGE_ME') {
      console.log(`[Worker] Utilisation de Hugging Face Spaces pour la séparation...`)
      try {
        const { processHuggingFaceSeparation } = await import('../utils/audio')
        const result = await processHuggingFaceSeparation(videoUrl, sceneId)
        vocalsUrl = result.vocalsUrl
        accompanimentUrl = result.accompanimentUrl
      } catch (err: any) {
        console.warn(
          `[Worker] Échec de Hugging Face, basculement vers FFmpeg. Erreur:`,
          err.message
        )
        const { processKaraokeSeparation } = await import('../utils/audio')
        const result = await processKaraokeSeparation(videoUrl, sceneId)
        vocalsUrl = result.vocalsUrl
        accompanimentUrl = result.accompanimentUrl
      }
    } else {
      console.log(`[Worker] Aucun token, utilisation de la méthode Karaoké FFmpeg...`)
      const { processKaraokeSeparation } = await import('../utils/audio')
      const result = await processKaraokeSeparation(videoUrl, sceneId)
      vocalsUrl = result.vocalsUrl
      accompanimentUrl = result.accompanimentUrl
    }

    // Mise à jour de la BDD
    if (vocalsUrl && accompanimentUrl) {
      const db = useDb()
      await db
        .update(scenes)
        .set({ audioVocalsUrl: vocalsUrl, audioMeUrl: accompanimentUrl })
        .where(eq(scenes.id, sceneId))
      console.log(`[Worker] Scène ${sceneId} mise à jour avec l'audio séparé.`)
    } else {
      throw new Error('Échec de la récupération des URLs séparées depuis Replicate.')
    }

    return { vocalsUrl, accompanimentUrl }
  })

  console.log('👷 In-Memory Workers initialized (Mixing, Audio Separation)')
})
