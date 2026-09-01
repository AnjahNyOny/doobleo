import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['player', 'admin'])
export const roomStatusEnum = pgEnum('room_status', ['waiting', 'playing', 'done'])

// ─── users ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 30 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash'), // null si connexion OAuth uniquement
  avatarUrl: text('avatar_url'),
  role: userRoleEnum('role').notNull().default('player'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ─── scenes ───────────────────────────────────────────────────────────────────

export const scenes = pgTable('scenes', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 100 }).notNull(),
  description: text('description'),
  thumbnailUrl: text('thumbnail_url'),
  videoUrl: text('video_url').notNull(), // URL R2/S3 (vidéo muette)
  audioMeUrl: text('audio_me_url').notNull(), // URL R2/S3 (piste M&E)
  durationMs: integer('duration_ms').notNull(),
  isPublished: boolean('is_published').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ─── characters ───────────────────────────────────────────────────────────────

export const characters = pgTable('characters', {
  id: uuid('id').primaryKey().defaultRandom(),
  sceneId: uuid('scene_id')
    .notNull()
    .references(() => scenes.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 50 }).notNull(),
  color: varchar('color', { length: 7 }).notNull(), // ex: '#FF5733'
  description: text('description'),
  order: integer('order').notNull().default(0),
})

// ─── lines (répliques) ────────────────────────────────────────────────────────

export const lines = pgTable('lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  sceneId: uuid('scene_id')
    .notNull()
    .references(() => scenes.id, { onDelete: 'cascade' }),
  characterId: uuid('character_id')
    .notNull()
    .references(() => characters.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  startMs: integer('start_ms').notNull(), // timecode de début en millisecondes
  endMs: integer('end_ms').notNull(), // timecode de fin en millisecondes
  order: integer('order').notNull(),
})

// ─── rooms ────────────────────────────────────────────────────────────────────

export const rooms = pgTable('rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 6 }).notNull().unique(), // ex: 'ABC123'
  sceneId: uuid('scene_id').references(() => scenes.id),
  status: roomStatusEnum('status').notNull().default('waiting'),
  hostUserId: text('host_user_id').notNull(), // uuid ou guest_id
  maxPlayers: integer('max_players').notNull().default(6),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'), // nettoyage auto des salons inactifs
})

// ─── room_players ─────────────────────────────────────────────────────────────

export const roomPlayers = pgTable('room_players', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id')
    .notNull()
    .references(() => rooms.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(), // uuid ou guest_id
  username: varchar('username', { length: 30 }).notNull(),
  avatarUrl: text('avatar_url'),
  characterId: uuid('character_id').references(() => characters.id),
  isReady: boolean('is_ready').notNull().default(false),
  isGuest: boolean('is_guest').notNull().default(false),
  isConnected: boolean('is_connected').notNull().default(true),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
})

// ─── recordings ───────────────────────────────────────────────────────────────

export const recordings = pgTable('recordings', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id')
    .notNull()
    .references(() => rooms.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  characterId: uuid('character_id')
    .notNull()
    .references(() => characters.id),
  audioUrl: text('audio_url').notNull(), // URL R2/S3 (blob audio brut)
  durationMs: integer('duration_ms').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ─── mix_jobs ─────────────────────────────────────────────────────────────────
// Suivi des jobs FFmpeg (BullMQ)

export const mixJobs = pgTable('mix_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id')
    .notNull()
    .references(() => rooms.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | processing | done | failed
  outputUrl: text('output_url'), // URL R2/S3 du MP4 final
  downloadUrl: text('download_url'), // URL signée temporaire
  expiresAt: timestamp('expires_at'), // expiration du lien de téléchargement
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
