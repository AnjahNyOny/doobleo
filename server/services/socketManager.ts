import type { Server as SocketServer, Socket } from 'socket.io'
import { eq } from 'drizzle-orm'
import { useDb } from '../utils/db'
import { rooms } from '../db/schema/index'
import { addMixJob } from './queue'

// État en mémoire pour les salons (plus rapide que la DB pour la sélection des persos en temps réel)
interface RoomState {
  code: string
  hostId: string
  sceneId: string
  players: {
    userId: string
    socketId: string
    isReady: boolean
    characterId?: string
    chunks?: { key: string; startMs: number }[]
  }[]
  status: 'waiting' | 'countdown' | 'playing' | 'review' | 'mixing' | 'finished'
  mixesReady: number
}

const activeRooms = new Map<string, RoomState>()

export const initSocketManager = (io: SocketServer) => {
  io.on('connection', (socket: Socket) => {
    // ─── REJOINDRE UN SALON ──────────────────────────────────────────────────
    socket.on('join_room', async ({ roomCode, userId, isHost: _isHost }) => {
      socket.join(roomCode)

      // Récupérer l'état du salon ou l'initialiser
      let state = activeRooms.get(roomCode)
      if (!state) {
        // Hydrater depuis la DB
        const db = useDb()
        const [roomData] = await db.select().from(rooms).where(eq(rooms.code, roomCode)).limit(1)
        if (roomData) {
          state = {
            code: roomCode,
            hostId: roomData.hostUserId,
            sceneId: roomData.sceneId!,
            players: [],
            status: roomData.status as RoomState['status'],
            mixesReady: 0,
          }
          activeRooms.set(roomCode, state)
        }
      }

      if (state) {
        // Ajouter ou mettre à jour le joueur
        const existingPlayer = state.players.find((p) => p.userId === userId)
        if (existingPlayer) {
          existingPlayer.socketId = socket.id
        } else {
          state.players.push({ userId, socketId: socket.id, isReady: false, chunks: [] })
        }

        // Informer les autres
        socket.to(roomCode).emit('player_joined', { userId, players: state.players })
        // Envoyer l'état actuel au joueur
        socket.emit('room_state_update', state)
      }
    })

    // ─── SÉLECTION DE PERSONNAGE ─────────────────────────────────────────────
    socket.on('select_character', ({ roomCode, userId, characterId }) => {
      const state = activeRooms.get(roomCode)
      if (!state) return

      // Vérifier si le perso est déjà pris par un autre
      const isTaken = state.players.some(
        (p) => p.characterId === characterId && p.userId !== userId
      )
      if (isTaken) {
        socket.emit('character_locked_error', { message: 'Personnage déjà sélectionné.' })
        return
      }

      const player = state.players.find((p) => p.userId === userId)
      if (player) {
        player.characterId = characterId
        io.to(roomCode).emit('room_state_update', state)
      }
    })

    // ─── ORCHESTRATION DU JEU ────────────────────────────────────────────────
    socket.on('host_start_game', ({ roomCode }) => {
      const state = activeRooms.get(roomCode)
      if (state) {
        state.status = 'countdown'
        state.mixesReady = 0
        state.players.forEach((p) => {
          p.chunks = []
          ;(p as any).hasUploaded = false
        })
        io.to(roomCode).emit('room_state_update', state)
        io.to(roomCode).emit('start_countdown', { duration: 3 })

        setTimeout(() => {
          if (state) {
            state.status = 'playing'
            io.to(roomCode).emit('room_state_update', state)
            io.to(roomCode).emit('play_video')
          }
        }, 3000)
      }
    })

    // ─── FIN DE L'ENREGISTREMENT ET UPLOAD ───────────────────────────────────
    socket.on(
      'audio_uploaded_chunks',
      async ({ roomCode, userId, characterId: _characterId, chunks }) => {
        const state = activeRooms.get(roomCode)
        if (!state) return

        const player = state.players.find((p) => p.userId === userId)
        if (player && !(player as any).hasUploaded) {
          player.chunks = chunks
          ;(player as any).hasUploaded = true
          state.mixesReady++
        }

        // Si tous les joueurs (ayant un perso) ont uploadé
        const playersWithChars = state.players.filter((p) => p.characterId)
        if (state.mixesReady >= playersWithChars.length) {
          state.status = 'mixing'
          io.to(roomCode).emit('room_state_update', state)

          // 🚀 DÉCLENCHER LE JOB BULLMQ
          const blobs = playersWithChars.map((p) => ({
            userId: p.userId,
            characterId: p.characterId!,
            chunks: p.chunks || [],
          }))

          // Cast to any to bypass type error while we update queue.ts
          await addMixJob(roomCode, state.sceneId, blobs as any)
        }
      }
    )

    // ─── DECONNEXION ─────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      // Chercher dans quels salons ce socket était
      for (const [roomCode, state] of activeRooms.entries()) {
        const player = state.players.find((p) => p.socketId === socket.id)
        if (player) {
          // On le retire (ou on gère un timeout de reconnexion)
          state.players = state.players.filter((p) => p.socketId !== socket.id)
          io.to(roomCode).emit('player_left', { userId: player.userId, players: state.players })
          io.to(roomCode).emit('room_state_update', state)

          // Si le salon est vide, on peut le nettoyer après un délai
          if (state.players.length === 0) {
            setTimeout(() => {
              const current = activeRooms.get(roomCode)
              if (current && current.players.length === 0) {
                activeRooms.delete(roomCode)
              }
            }, 30000)
          }
        }
      }
    })
  })
}

// Export a method to broadcast room state from HTTP endpoints
export const updateRoomScene = (io: SocketServer, roomCode: string, sceneId: string) => {
  const state = activeRooms.get(roomCode)
  if (state) {
    state.sceneId = sceneId
    io.to(roomCode).emit('room_state_update', state)
  }
}
