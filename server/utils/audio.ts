import fs from 'node:fs/promises'
import { createWriteStream, createReadStream, openAsBlob } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import path from 'node:path'
import os from 'node:os'
import ffmpeg from 'fluent-ffmpeg'
import {
  generateDownloadPresignedUrl,
  generateUploadPresignedUrl,
  getPublicUrl,
  extractKeyFromUrl,
} from './s3'

export async function processKaraokeSeparation(
  videoUrl: string,
  sceneId: string
): Promise<{ vocalsUrl: string; accompanimentUrl: string }> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `doobleo-karaoke-${sceneId}-`))

  try {
    const videoFile = path.join(tmpDir, 'video.mp4')
    const meFile = path.join(tmpDir, 'me.mp3')

    // 1. Download Video
    const downloadUrl = videoUrl.includes('.r2.cloudflarestorage.com')
      ? await generateDownloadPresignedUrl(extractKeyFromUrl(videoUrl))
      : videoUrl

    const res = await fetch(downloadUrl)
    if (!res.ok) throw new Error(`Failed to download video: ${res.statusText}`)
    if (!res.body) throw new Error('No body to download')

    const fileStream = createWriteStream(videoFile)
    await pipeline(Readable.fromWeb(res.body as any), fileStream)

    // 2. Process Karaoke (Remove center channel to keep only side channels for M&E)
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoFile)
        .noVideo()
        .audioFilters('pan=stereo|c0=c0-c1|c1=c1-c0')
        .outputOptions(['-c:a libmp3lame', '-q:a 2'])
        .output(meFile)
        .on('start', (cmd) => console.log('FFmpeg karaoke started:', cmd))
        .on('error', (err, stdout, stderr) => {
          console.error('FFmpeg karaoke stderr:', stderr)
          reject(new Error(`Karaoke extraction failed: ${err.message}`))
        })
        .on('end', () => resolve())
        .run()
    })

    // 3. Upload M&E track
    const meKey = `media/audio/${sceneId}_me_${Date.now()}.mp3`
    const uploadUrl = await generateUploadPresignedUrl(meKey, 'audio/mpeg')

    const meBuffer = createReadStream(meFile)
    const stat = await fs.stat(meFile)
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': stat.size.toString(),
      },
      body: meBuffer as any,
      duplex: 'half',
    } as any)

    if (!uploadRes.ok) {
      throw new Error(`Upload failed: ${uploadRes.statusText}`)
    }

    // Vocals is just the original video since extracting pure vocals without AI is tough
    return {
      vocalsUrl: videoUrl,
      accompanimentUrl: getPublicUrl(meKey),
    }
  } finally {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true })
    } catch (e) {
      console.error('Failed to cleanup tmp dir', e)
    }
  }
}

// ─── Hugging Face Separation (via Gradio REST API, no @gradio/client) ────────

const HF_SPACE = 'ahk-d/Spleeter-HT-Demucs-Stem-Separation-2025'
const HF_SPACE_URL = `https://${HF_SPACE.replace('/', '-').toLowerCase()}.hf.space`

export async function processHuggingFaceSeparation(
  videoUrl: string,
  sceneId: string
): Promise<{ vocalsUrl: string; accompanimentUrl: string }> {
  const hfToken = process.env.HUGGINGFACE_TOKEN
  if (!hfToken) throw new Error('HUGGINGFACE_TOKEN is not set in .env')

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `doobleo-hf-${sceneId}-`))

  try {
    // 1. Download the video from S3
    const downloadUrl = videoUrl.includes('.r2.cloudflarestorage.com')
      ? await generateDownloadPresignedUrl(extractKeyFromUrl(videoUrl))
      : videoUrl

    const videoRes = await fetch(downloadUrl)
    if (!videoRes.ok) throw new Error(`Failed to download video: ${videoRes.statusText}`)

    if (!videoRes.body) throw new Error('No body to download')

    // Save locally using streams to avoid RAM exhaustion
    const videoFile = path.join(tmpDir, 'video.mp4')
    const audioFile = path.join(tmpDir, 'audio.wav')
    const videoStream = createWriteStream(videoFile)
    await pipeline(Readable.fromWeb(videoRes.body as any), videoStream)

    // Extract audio from video
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoFile)
        .noVideo()
        .outputOptions(['-c:a', 'pcm_s16le', '-ar', '44100', '-ac', '2'])
        .output(audioFile)
        .on('error', (err) => reject(new Error(`Audio extraction failed: ${err.message}`)))
        .on('end', () => resolve())
        .run()
    })

    // 2. Upload audio file to the HF Space
    console.log(`[HF] Upload du fichier audio vers le Space Hugging Face...`)

    const fileBlob = await openAsBlob(audioFile)

    const uploadRes = await fetch(`${HF_SPACE_URL}/gradio_api/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hfToken}`,
      },
      body: (() => {
        const formData = new FormData()
        formData.append('files', fileBlob, 'audio.wav')
        return formData
      })(),
    })

    if (!uploadRes.ok) {
      const errText = await uploadRes.text()
      throw new Error(`HF upload failed (${uploadRes.status}): ${errText}`)
    }

    const uploadedPaths = (await uploadRes.json()) as string[]
    const uploadedPath = uploadedPaths[0]
    console.log(`[HF] Fichier uploadé: ${uploadedPath}`)

    // 3. Submit the prediction job via REST
    console.log(`[HF] Envoi de l'audio au modèle Demucs sur Hugging Face...`)
    const submitRes = await fetch(`${HF_SPACE_URL}/gradio_api/call/separate_selected_models`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hfToken}`,
      },
      body: JSON.stringify({
        data: [
          {
            path: uploadedPath,
            orig_name: 'audio.wav',
            size: fileBlob.size,
            mime_type: 'audio/wav',
            meta: { _type: 'gradio.FileData' },
          },
          true, // run_htdemucs
          false, // run_spleeter
        ],
      }),
    })

    if (!submitRes.ok) {
      const errText = await submitRes.text()
      throw new Error(`HF submit failed (${submitRes.status}): ${errText}`)
    }

    const { event_id } = (await submitRes.json()) as { event_id: string }
    console.log(`[HF] Job soumis, event_id: ${event_id}. Attente du résultat...`)

    // 4. Poll for results via SSE stream
    const resultRes = await fetch(
      `${HF_SPACE_URL}/gradio_api/call/separate_selected_models/${event_id}`,
      {
        headers: { Authorization: `Bearer ${hfToken}` },
      }
    )

    if (!resultRes.ok) {
      throw new Error(`HF result fetch failed (${resultRes.status})`)
    }

    // Parse the SSE stream
    const sseText = await resultRes.text()
    const lines = sseText.split('\n')

    let resultData: any[] | null = null
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const parsed = JSON.parse(line.slice(6))
          if (Array.isArray(parsed)) {
            resultData = parsed
          }
        } catch {
          /* skip non-JSON lines */
        }
      }
    }

    if (!resultData || resultData.length < 4) {
      throw new Error(`Unexpected HF output. SSE response:\n${sseText.slice(0, 500)}`)
    }

    // Output: [0]=Drums, [1]=Bass, [2]=Other, [3]=Vocals
    const drumsFileUrl = resultData[0]?.url
      ? resultData[0].url
      : `${HF_SPACE_URL}/gradio_api/file=${resultData[0]?.path}`
    const bassFileUrl = resultData[1]?.url
      ? resultData[1].url
      : `${HF_SPACE_URL}/gradio_api/file=${resultData[1]?.path}`
    const otherFileUrl = resultData[2]?.url
      ? resultData[2].url
      : `${HF_SPACE_URL}/gradio_api/file=${resultData[2]?.path}`
    const vocalsFileUrl = resultData[3]?.url
      ? resultData[3].url
      : `${HF_SPACE_URL}/gradio_api/file=${resultData[3]?.path}`

    if (!drumsFileUrl || !bassFileUrl || !otherFileUrl) {
      throw new Error('Missing stem URLs from Hugging Face output.')
    }

    console.log(`[HF] Téléchargement des stems séparées...`)

    // 5. Download the 3 non-vocal stems locally
    const stemFiles: string[] = []
    for (const [i, url] of [drumsFileUrl, bassFileUrl, otherFileUrl].entries()) {
      const stemRes = await fetch(url, { headers: { Authorization: `Bearer ${hfToken}` } })
      if (!stemRes.ok) throw new Error(`Failed to download stem ${i}: ${stemRes.statusText}`)
      if (!stemRes.body) throw new Error('No body to download for stem')
      const stemPath = path.join(tmpDir, `stem_${i}.wav`)
      const stemStream = createWriteStream(stemPath)
      await pipeline(Readable.fromWeb(stemRes.body as any), stemStream)
      stemFiles.push(stemPath)
    }

    // 6. Mix drums + bass + other into a single M&E track with FFmpeg
    const meFile = path.join(tmpDir, 'me.mp3')
    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg()
      for (const f of stemFiles) cmd.input(f)
      cmd
        .complexFilter('[0:a][1:a][2:a]amix=inputs=3:duration=longest:normalize=0[aout]')
        .outputOptions(['-map', '[aout]', '-c:a', 'libmp3lame', '-q:a', '2'])
        .output(meFile)
        .on('start', (c) => console.log('[HF] FFmpeg M&E merge:', c))
        .on('error', (err, _stdout, stderr) => {
          console.error('[HF] FFmpeg stderr:', stderr)
          reject(new Error(`M&E merge failed: ${err.message}`))
        })
        .on('end', () => resolve())
        .run()
    })

    // 7. Upload the M&E track to S3
    const meKey = `media/audio/${sceneId}_me_${Date.now()}.mp3`
    const s3UploadUrl = await generateUploadPresignedUrl(meKey, 'audio/mpeg')
    const meBuffer = await fs.readFile(meFile)
    const s3UploadRes = await fetch(s3UploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'audio/mpeg' },
      body: meBuffer,
    })
    if (!s3UploadRes.ok) throw new Error(`Upload M&E failed: ${s3UploadRes.statusText}`)

    console.log(`[HF] ✅ Séparation IA terminée avec succès pour la scène ${sceneId}`)

    return {
      vocalsUrl: vocalsFileUrl || videoUrl,
      accompanimentUrl: getPublicUrl(meKey),
    }
  } finally {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true })
    } catch (e) {
      console.error('Failed to cleanup tmp dir', e)
    }
  }
}
