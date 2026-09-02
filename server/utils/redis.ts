import type { ConnectionOptions } from 'bullmq'

/**
 * Parse la REDIS_URL pour créer une connexion compatible BullMQ.
 * Supporte:
 * - redis://localhost:6379 (local)
 * - rediss://default:xxx@host:port (Upstash TLS)
 */
export function getRedisConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL || 'redis://localhost:6379'

  try {
    const parsed = new URL(url)
    const isTLS = parsed.protocol === 'rediss:'

    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379'),
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      ...(isTLS
        ? {
            tls: {},
            enableTLSForSentinelMode: false,
          }
        : {}),
      maxRetriesPerRequest: null, // Requis par BullMQ
    }
  } catch {
    // Fallback si l'URL n'est pas parsable
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
    }
  }
}
