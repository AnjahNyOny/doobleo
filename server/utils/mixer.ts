import fs from 'node:fs/promises'
import { createWriteStream, createReadStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import path from 'node:path'
import os from 'node:os'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import { generateDownloadPresignedUrl, generateUploadPresignedUrl } from './s3'
import type { MixJobData } from '../services/queue'

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath)
}

async function downloadFile(url: string, dest: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.statusText}`)
  if (!res.body) throw new Error('No body to download')

  const fileStream = createWriteStream(dest)
  // Convertit le Web Stream en Node Stream et écrit sur le disque sans saturer la RAM
  await pipeline(Readable.fromWeb(res.body as any), fileStream)
}

export async function processMixJob(data: MixJobData, scene: any): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `doobleo-mix-${data.roomCode}-`))

  try {
    const videoFile = path.join(tmpDir, 'video.mp4')
    const meFile = path.join(tmpDir, 'me.mp3')

    const { extractKeyFromUrl } = await import('./s3')

    // 1. Download Video and ME track
    const videoUrl = scene.videoUrl.includes('.r2.cloudflarestorage.com')
      ? await generateDownloadPresignedUrl(extractKeyFromUrl(scene.videoUrl))
      : scene.videoUrl

    await downloadFile(videoUrl, videoFile)

    if (scene.audioMeUrl) {
      const meUrl = scene.audioMeUrl.includes('.r2.cloudflarestorage.com')
        ? await generateDownloadPresignedUrl(extractKeyFromUrl(scene.audioMeUrl))
        : scene.audioMeUrl
      await downloadFile(meUrl, meFile)
    }

    // 2. Download all chunks
    const chunkFiles: { file: string; startMs: number }[] = []
    let chunkIndex = 0

    for (const player of data.blobs) {
      for (const chunk of player.chunks) {
        const chunkUrl = await generateDownloadPresignedUrl(chunk.key)
        const chunkDest = path.join(tmpDir, `chunk_${chunkIndex}.webm`)
        await downloadFile(chunkUrl, chunkDest)
        chunkFiles.push({ file: chunkDest, startMs: chunk.startMs })
        chunkIndex++
      }
    }

    // 3. Build FFmpeg command
    const outputFile = path.join(tmpDir, 'output.mp4')

    await new Promise<void>((resolve, reject) => {
      const command = ffmpeg(videoFile)

      let filterComplex = ''
      let amixInputs = ''
      let inputIndex = 1 // video is 0

      if (scene.audioMeUrl) {
        command.input(meFile)
        amixInputs += '[1:a]'
        inputIndex++
      } else {
        // Si pas de piste M&E, on utilise l'audio original de la vidéo comme base
        // pour que duration=first ne coupe pas le mixage sur la durée d'une petite prise.
        amixInputs += '[0:a]'
      }

      for (const chunk of chunkFiles) {
        command.input(chunk.file)
        filterComplex += `[${inputIndex}:a]adelay=${chunk.startMs}:all=1,apad[a${inputIndex}];`
        amixInputs += `[a${inputIndex}]`
        inputIndex++
      }

      // Si pas de ME, on a ajouté [0:a] comme base, donc le nombre d'entrées audio est inputIndex.
      // S'il y a un ME, on a [1:a] comme base + les chunks, donc c'est inputIndex - 1.
      // Wait, let's just count how many inputs amix is receiving.
      const totalAudioInputs = scene.audioMeUrl ? inputIndex - 1 : inputIndex

      if (totalAudioInputs > 0) {
        // Amix avec normalize=0 pour ne pas baisser le volume en fonction du nombre d'entrées
        filterComplex += `${amixInputs}amix=inputs=${totalAudioInputs}:duration=first:dropout_transition=2:normalize=0[aout]`
        command.complexFilter(filterComplex, ['aout'])
        command.outputOptions(['-map 0:v', '-c:v copy', '-c:a aac', '-b:a 192k'])
      } else {
        // Fallback: Just copy video audio
        command.outputOptions(['-c copy'])
      }

      command
        .output(outputFile)
        .on('start', (cmdline) => console.log('FFmpeg started:', cmdline))
        .on('error', (err, stdout, stderr) => {
          console.error('FFmpeg stderr:', stderr)
          reject(new Error(`FFmpeg error: ${err.message}\nStderr: ${stderr}`))
        })
        .on('end', () => resolve())
        .run()
    })

    // 4. Upload to S3 (Streaming to avoid RAM OOM)
    const outputKey = `mixes/${data.roomCode}-${Date.now()}.mp4`
    const uploadUrl = await generateUploadPresignedUrl(outputKey, 'video/mp4')

    const fileStream = createReadStream(outputFile)
    const stat = await fs.stat(outputFile)
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size.toString(),
      },
      body: fileStream as any, // Node.js stream
      duplex: 'half', // Requis par Node fetch pour streamer un body
    } as any)

    if (!uploadRes.ok) {
      throw new Error(`Upload failed: ${uploadRes.statusText}`)
    }

    return await generateDownloadPresignedUrl(outputKey)
  } finally {
    // 5. Cleanup
    try {
      await fs.rm(tmpDir, { recursive: true, force: true })
    } catch (e) {
      console.error('Failed to cleanup tmp dir', e)
    }
  }
}
