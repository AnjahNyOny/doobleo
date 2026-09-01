import { z } from 'zod'
import { requireAdmin } from '../../utils/guards'
import { generateUploadPresignedUrl, generateMediaKey } from '../../utils/s3'

const presignSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum([
    'video/mp4',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'image/jpeg',
    'image/png',
    'image/webp',
  ]),
  type: z.enum(['video', 'audio', 'thumbnail', 'recording']),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readValidatedBody(event, presignSchema.parse)

  const key = generateMediaKey(body.type, body.filename)
  const presignedUrl = await generateUploadPresignedUrl(key, body.contentType)

  return {
    presignedUrl,
    key,
    // L'URL publique permanente (à sauvegarder en DB après upload réussi)
    publicUrl: `${useRuntimeConfig().s3PublicUrl}/${key}`,
  }
})
