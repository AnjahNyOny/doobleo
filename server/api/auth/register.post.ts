import { hash } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { users } from '../../db/schema/index'
import { useDb } from '../../utils/db'
import { registerSchema } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  // 1. Valider le body
  const body = await readValidatedBody(event, registerSchema.parse)

  const db = useDb()

  // 2. Vérifier que l'email n'est pas déjà utilisé
  const existingEmail = await db.select().from(users).where(eq(users.email, body.email)).limit(1)
  if (existingEmail.length > 0) {
    throw createError({ statusCode: 409, message: 'Cet email est déjà utilisé.' })
  }

  // 3. Vérifier que le username n'est pas déjà pris
  const existingUsername = await db
    .select()
    .from(users)
    .where(eq(users.username, body.username))
    .limit(1)
  if (existingUsername.length > 0) {
    throw createError({ statusCode: 409, message: 'Ce pseudo est déjà pris.' })
  }

  // 4. Hacher le mot de passe
  const passwordHash = await hash(body.password, 12)

  // 5. Créer l'utilisateur
  const [newUser] = await db
    .insert(users)
    .values({
      username: body.username,
      email: body.email,
      passwordHash,
      role: 'player',
    })
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      avatarUrl: users.avatarUrl,
      role: users.role,
    })

  // 6. Créer la session
  await setUserSession(event, {
    user: {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      avatarUrl: newUser.avatarUrl,
      role: newUser.role,
    },
  })

  return { success: true, user: newUser }
})
