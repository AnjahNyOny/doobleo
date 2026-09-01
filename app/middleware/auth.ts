// Middleware Nuxt côté client : redirige vers /login si non authentifié
// Usage : definePageMeta({ middleware: 'auth' })
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn } = useUserSession()

  if (!loggedIn.value) {
    return navigateTo('/login')
  }
})
