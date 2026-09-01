import type { H3Event } from 'h3'

// Guard réutilisable pour les routes admin côté serveur
export async function requireAdmin(event: H3Event) {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({ statusCode: 401, message: 'Non authentifié.' })
  }

  if (session.user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Accès réservé aux administrateurs.' })
  }

  return session.user
}
