import { z } from 'zod'
import { generateUploadPresignedUrl, generateMediaKey } from '../../utils/s3'

// NOTE: Dans un vrai environnement, cette route serait protégée
// par un middleware d'authentification (joueur dans un salon).
// Pour le PoC, on la laisse ouverte.

const uploadRequestSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().startsWith('audio/'),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, uploadRequestSchema.parse)

  // 1. Générer une clé unique pour l'enregistrement brut
  const key = generateMediaKey('recording', body.filename)

  // 2. Générer l'URL présignée pour l'upload S3
  const presignedUrl = await generateUploadPresignedUrl(key, body.contentType)

  // 3. (Futur : Sauvegarder dans la DB "recordings" avec status "pending")

  return {
    presignedUrl,
    key,
    publicUrl: `${useRuntimeConfig().s3PublicUrl}/${key}`,
  }
})
