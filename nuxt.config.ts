// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // ─── TypeScript strict mode ─────────────────────────────────────────────────
  typescript: {
    strict: true,
    typeCheck: false, // désactivé en dev pour la vitesse, activé en CI
  },

  // ─── Alias pour les types partagés ──────────────────────────────────────────
  alias: {
    '~shared': '../shared',
  },

  // ─── Variables d'environnement ───────────────────────────────────────────────
  runtimeConfig: {
    // Privées (serveur uniquement)
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    jwtSecret: process.env.JWT_SECRET,
    s3Endpoint: process.env.S3_ENDPOINT,
    s3Region: process.env.S3_REGION,
    s3BucketName: process.env.S3_BUCKET_NAME,
    s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
    s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    s3PublicUrl: process.env.S3_PUBLIC_URL,
    ffmpegPath: process.env.FFMPEG_PATH ?? 'ffmpeg',

    // Publiques (exposées au client)
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
      socketUrl: process.env.NUXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3000',
    },
  },

  // ─── Modules (à activer au fur et à mesure) ──────────────────────────────────
  modules: [
    '@nuxt/eslint', // Génère .nuxt/eslint.config.mjs
    // '@pinia/nuxt',           // Phase 6
    // '@nuxtjs/tailwindcss',   // Phase 6
    // 'nuxt-auth-utils',       // Phase 2
  ],
})
