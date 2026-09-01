import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { rooms, scenes, characters } from '../../db/schema/index'

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code')?.toUpperCase()
  if (!code || code.length !== 6) {
    throw createError({ statusCode: 400, message: 'Code de salon invalide.' })
  }

  const db = useDb()

  const [room] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1)
  if (!room) {
    throw createError({ statusCode: 404, message: 'Salon introuvable.' })
  }

  if (room.status !== 'waiting') {
    throw createError({ statusCode: 403, message: 'La partie a déjà commencé ou est terminée.' })
  }

  // On renvoie aussi les infos de la scène
  const [scene] = await db.select().from(scenes).where(eq(scenes.id, room.sceneId!)).limit(1)
  const sceneCharacters = await db.select().from(characters).where(eq(characters.sceneId, scene.id))

  return {
    ...room,
    scene: {
      ...scene,
      characters: sceneCharacters,
    },
  }
})
