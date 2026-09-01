import { compare } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { users } from '../../db/schema/index'
import { useDb } from '../../utils/db'
import { loginSchema } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  // 1. Valider le body
  const body = await readValidatedBody(event, loginSchema.parse)

  const db = useDb()

  // 2. Chercher l'utilisateur par email
  const [user] = await db.select().from(users).where(eq(users.email, body.email)).limit(1)

  // Message générique pour éviter l'énumération des emails
  const invalidCredentialsError = createError({
    statusCode: 401,
    message: 'Email ou mot de passe incorrect.',
  })

  if (!user || !user.passwordHash) {
    throw invalidCredentialsError
  }

  // 3. Vérifier le mot de passe
  const isValid = await compare(body.password, user.passwordHash)
  if (!isValid) {
    throw invalidCredentialsError
  }

  // 4. Créer la session
  await setUserSession(event, {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
    },
  })

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
    },
  }
})
