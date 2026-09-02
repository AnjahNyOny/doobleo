import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

let _s3: S3Client | null = null

function getS3Client(): S3Client {
  if (_s3) return _s3
  const config = useRuntimeConfig()
  _s3 = new S3Client({
    region: config.s3Region || 'auto',
    endpoint: config.s3Endpoint,
    credentials: {
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey,
    },
    forcePathStyle: true,
  })
  return _s3
}

// ─── Générer une URL présignée pour upload direct depuis le navigateur ──────

export async function generateUploadPresignedUrl(
  key: string,
  contentType: string,
  expiresIn = 300 // 5 minutes
): Promise<string> {
  const config = useRuntimeConfig()
  const s3 = getS3Client()
  const command = new PutObjectCommand({
    Bucket: config.s3BucketName,
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(s3, command, { expiresIn })
}

// ─── Générer une URL présignée pour téléchargement (lien temporaire) ────────

export async function generateDownloadPresignedUrl(
  key: string,
  expiresIn = 1800 // 30 minutes
): Promise<string> {
  const config = useRuntimeConfig()
  const s3 = getS3Client()
  const command = new GetObjectCommand({
    Bucket: config.s3BucketName,
    Key: key,
  })
  return getSignedUrl(s3, command, { expiresIn })
}

// ─── Supprimer un objet du bucket ────────────────────────────────────────────

export async function deleteS3Object(key: string): Promise<void> {
  const config = useRuntimeConfig()
  const s3 = getS3Client()
  await s3.send(
    new DeleteObjectCommand({
      Bucket: config.s3BucketName,
      Key: key,
    })
  )
}

// ─── Construire l'URL publique d'un objet ────────────────────────────────────

export function getPublicUrl(key: string): string {
  const config = useRuntimeConfig()
  return `${config.s3PublicUrl}/${key}`
}

// ─── Extraire la clé S3 depuis une URL publique ──────────────────────────────

export function extractKeyFromUrl(url: string): string {
  const config = useRuntimeConfig()
  try {
    const parsed = new URL(url)
    let key = parsed.pathname
    const bucketPrefix = `/${config.s3BucketName}/`
    if (key.startsWith(bucketPrefix)) {
      key = key.substring(bucketPrefix.length)
    } else if (key.startsWith('/')) {
      key = key.substring(1)
    }
    return key
  } catch {
    // Fallback in case of malformed URL
    let key = url.replace(`${config.s3PublicUrl}/`, '')
    const queryIndex = key.indexOf('?')
    if (queryIndex !== -1) {
      key = key.substring(0, queryIndex)
    }
    return key
  }
}

// ─── Générer une clé unique pour un média ────────────────────────────────────

export function generateMediaKey(
  type: 'video' | 'audio' | 'thumbnail' | 'recording' | 'output',
  filename: string
): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  const ext = filename.split('.').pop()
  return `${type}/${timestamp}-${random}.${ext}`
}
