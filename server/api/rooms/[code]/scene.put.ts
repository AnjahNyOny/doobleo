import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDb } from '../../../utils/db'
import { rooms, scenes } from '../../../db/schema/index'
import { updateRoomScene } from '../../../services/socketManager'

const putSceneSchema = z.object({
  sceneId: z.string().uuid(),
})

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code')
  if (!code) {
    throw createError({ statusCode: 400, message: 'Code du salon manquant.' })
  }

  const body = await readValidatedBody(event, putSceneSchema.parse)
  const db = useDb()

  // 1. Vérifier si le salon existe
  const [room] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1)
  if (!room) {
    throw createError({ statusCode: 404, message: 'Salon introuvable.' })
  }

  // 2. Vérifier si la scène existe et est publiée
  const [scene] = await db.select().from(scenes).where(eq(scenes.id, body.sceneId)).limit(1)
  if (!scene || !scene.isPublished) {
    throw createError({ statusCode: 404, message: 'Scène introuvable ou non publiée.' })
  }

  // 3. Mettre à jour le salon
  await db
    .update(rooms)
    .set({
      sceneId: body.sceneId,
      updatedAt: new Date(),
    })
    .where(eq(rooms.id, room.id))

  // 4. Mettre à jour l'état Socket
  const io = global.__io
  if (io) {
    updateRoomScene(io, code, body.sceneId)
  }

  return { success: true, room: { ...room, sceneId: body.sceneId } }
})
