// Types partagés entre le frontend (Nuxt) et le backend (Nitro/Socket.io)
// Ces types reflètent exactement le schéma de la base de données

export type UserRole = 'player' | 'admin'
export type RoomStatus = 'waiting' | 'playing' | 'done'

export interface User {
  id: string
  username: string
  avatarUrl: string | null
  role: UserRole
  createdAt: Date
}

export interface GuestUser {
  id: string // généré côté client (uuid)
  username: string
  isGuest: true
}

export type AnyUser = User | GuestUser

export interface Scene {
  id: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  videoUrl: string
  audioMeUrl: string
  durationMs: number
  isPublished: boolean
  characters: Character[]
}

export interface Character {
  id: string
  sceneId: string
  name: string
  color: string // hex color
  description: string | null
}

export interface Line {
  id: string
  characterId: string
  sceneId: string
  text: string
  startMs: number
  endMs: number
  order: number
}

export interface Room {
  id: string
  code: string // 6 chars
  sceneId: string | null
  status: RoomStatus
  hostUserId: string
  createdAt: Date
  players: RoomPlayer[]
}

export interface RoomPlayer {
  id: string
  roomId: string
  userId: string
  username: string
  avatarUrl: string | null
  characterIds: string[]
  isReady: boolean
  isGuest: boolean
}

export interface Recording {
  id: string
  roomId: string
  userId: string
  characterId: string
  audioUrl: string
  durationMs: number
  createdAt: Date
}

// ─── Socket.io Events ─────────────────────────────────────────────────────────

export interface ServerToClientEvents {
  user_joined: (player: RoomPlayer) => void
  user_left: (userId: string) => void
  character_locked: (characterId: string, userId: string) => void
  character_released: (characterId: string) => void
  player_ready: (userId: string, isReady: boolean) => void
  scene_selected: (scene: Scene) => void
  countdown: (seconds: number) => void
  playback_started: (startTimestamp: number) => void
  audio_ready: (userId: string, characterId: string) => void
  mix_ready: (downloadUrl: string, expiresAt: number) => void
  mix_failed: (error: string) => void
  player_disconnected: (userId: string, waitSeconds: number) => void
  host_decision_required: (disconnectedUserId: string) => void
  session_cancelled: () => void
}

export interface ClientToServerEvents {
  create_room: (callback: (room: { code: string }) => void) => void
  join_room: (
    code: string,
    user: AnyUser,
    callback: (room: Room | { error: string }) => void
  ) => void
  select_character: (characterId: string) => void
  release_character: () => void
  set_ready: (isReady: boolean) => void
  select_scene: (sceneId: string) => void
  host_start_game: () => void
  audio_uploaded: (characterId: string, audioUrl: string) => void
  host_continue_without: (disconnectedUserId: string) => void
  host_cancel_session: () => void
}
