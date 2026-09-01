import { eq } from 'drizzle-orm'
import { users } from '../../db/schema/index'
import { useDb } from '../../utils/db'
import { updateProfileSchema } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  // Vérifier la session
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, message: 'Non authentifié.' })
  }

  const body = await readValidatedBody(event, updateProfileSchema.parse)
  const db = useDb()

  // Vérifier unicité du nouveau username si changé
  if (body.username && body.username !== session.user.username) {
    const existing = await db.select().from(users).where(eq(users.username, body.username)).limit(1)
    if (existing.length > 0) {
      throw createError({ statusCode: 409, message: 'Ce pseudo est déjà pris.' })
    }
  }

  // Mettre à jour le profil
  const [updated] = await db
    .update(users)
    .set({
      ...(body.username && { username: body.username }),
      ...(body.avatarUrl !== undefined && { avatarUrl: body.avatarUrl }),
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id))
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      avatarUrl: users.avatarUrl,
      role: users.role,
    })

  // Mettre à jour la session avec les nouvelles infos
  await setUserSession(event, { user: updated })

  return { success: true, user: updated }
})
