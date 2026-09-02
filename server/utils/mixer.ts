import fs from 'node:fs/promises'
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

  const arrayBuffer = await res.arrayBuffer()
  await fs.writeFile(dest, Buffer.from(arrayBuffer))
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
      }

      for (const chunk of chunkFiles) {
        command.input(chunk.file)
        filterComplex += `[${inputIndex}:a]adelay=${chunk.startMs}:all=1[a${inputIndex}];`
        amixInputs += `[a${inputIndex}]`
        inputIndex++
      }

      const totalAudioInputs = inputIndex - 1

      if (totalAudioInputs > 0) {
        // Amix (Audio Mix)
        filterComplex += `${amixInputs}amix=inputs=${totalAudioInputs}:duration=first:dropout_transition=2[aout]`
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

    // 4. Upload to S3
    const outputKey = `mixes/${data.roomCode}-${Date.now()}.mp4`
    const uploadUrl = await generateUploadPresignedUrl(outputKey, 'video/mp4')

    const outputBuffer = await fs.readFile(outputFile)
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'video/mp4' },
      body: outputBuffer,
    })

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
