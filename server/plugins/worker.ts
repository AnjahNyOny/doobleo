import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'
import { eq } from 'drizzle-orm'
import { useDb } from '../utils/db'
import { scenes, lines as linesSchema } from '../db/schema/index'
import { mixingQueue } from '../services/queue'

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

    // Fetch all lines for this scene
    const sceneLines = await db.select().from(linesSchema).where(eq(linesSchema.sceneId, scene.id))

    let finalUrl: string
    try {
      const { processMixJob } = await import('../utils/mixer')
      finalUrl = await processMixJob(data, scene, sceneLines)

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

  console.log('👷 In-Memory Workers initialized (Mixing)')
})
