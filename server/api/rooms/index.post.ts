import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { rooms, roomPlayers, scenes } from '../../db/schema/index'

const createRoomSchema = z.object({
  sceneId: z.string().uuid().optional().nullable(),
  hostUserId: z.string().min(1),
  hostUsername: z.string().min(1).max(30),
  hostAvatarUrl: z.string().url().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, createRoomSchema.parse)
  const db = useDb()

  // 1. Vérifier si la scène existe et est publiée, si un sceneId est fourni
  if (body.sceneId) {
    const [scene] = await db.select().from(scenes).where(eq(scenes.id, body.sceneId)).limit(1)
    if (!scene || !scene.isPublished) {
      throw createError({ statusCode: 404, message: 'Scène introuvable ou non publiée.' })
    }
  }

  // 2. Générer un code unique à 6 caractères
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  let isUnique = false

  while (!isUnique) {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    const [existing] = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.code, code))
      .limit(1)
    if (!existing) isUnique = true
  }

  // 3. Créer le salon
  const [room] = await db
    .insert(rooms)
    .values({
      code,
      sceneId: body.sceneId || null,
      hostUserId: body.hostUserId,
      status: 'waiting',
      // Expiration dans 24h par exemple
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
    .returning()

  if (!room) {
    throw createError({ statusCode: 500, message: 'Erreur lors de la création du salon.' })
  }

  // 4. Ajouter l'hôte comme joueur dans la room (table room_players)
  const [player] = await db
    .insert(roomPlayers)
    .values({
      roomId: room.id,
      userId: body.hostUserId,
      username: body.hostUsername,
      avatarUrl: body.hostAvatarUrl,
      isGuest: !body.hostUserId.includes('-'), // simple check, on pourra l'améliorer
      isConnected: false, // Sera true quand il se connectera au websocket
    })
    .returning()

  return {
    room,
    player,
  }
})
