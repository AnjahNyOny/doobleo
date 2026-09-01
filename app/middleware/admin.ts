// Middleware Nuxt côté client : réservé aux admins
// Usage : definePageMeta({ middleware: 'admin' })
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn, session } = useUserSession()

  if (!loggedIn.value) {
    return navigateTo('/login')
  }

  if (session.value?.user?.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Accès refusé.' })
  }
})
