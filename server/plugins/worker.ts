import { Worker } from 'bullmq'
import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'
import type { MixJobData } from '../services/queue'

// Tell fluent-ffmpeg where the binary is
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath)
}

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
}

export default defineNitroPlugin(() => {
  const worker = new Worker(
    'mixing',
    async (job) => {
      const data = job.data as MixJobData

      // Dans la réalité, on devrait :
      // 1. Télécharger la vidéo originale depuis S3
      // 2. Télécharger la piste M&E depuis S3
      // 3. Télécharger les enregistrements vocaux des joueurs depuis S3
      // 4. Mixer le tout avec FFmpeg
      // 5. Uploader le fichier mixé vers S3
      // 6. Supprimer les fichiers temporaires locaux et les enregistrements originaux sur S3

      // Simulation du mixage (prend du temps)
      await new Promise((resolve) => setTimeout(resolve, 5000))

      // Exemple d'appel FFmpeg (désactivé pour le PoC car il nécessite de vrais fichiers)
      /*
    await new Promise((resolve, reject) => {
      ffmpeg('video.mp4')
        .input('audio_me.mp3')
        .input('player1.webm')
        .complexFilter([
          // Filtrage complexe pour merger les audios
        ])
        .on('end', resolve)
        .on('error', reject)
        .save('output.mp4')
    })
    */

      const finalUrl = `https://cdn.doobleo.com/mixes/${data.roomCode}.mp4`

      // Notifier le salon via Socket.io
      if (global.__io) {
        global.__io.to(data.roomCode).emit('mix_ready', { url: finalUrl })
      }

      return finalUrl
    },
    { connection }
  )

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} a échoué:`, err)
  })

  console.log('👷 BullMQ Worker initialized (FFmpeg setup ok)')
})
