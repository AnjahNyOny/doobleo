// Composable centralisé pour les actions auth
// Encapsule les appels API et gère les erreurs

export const useAuth = () => {
  const { fetch: refreshSession } = useUserSession()
  const router = useRouter()

  // ─── Inscription ───────────────────────────────────────────────────────────

  const register = async (data: { username: string; email: string; password: string }) => {
    await $fetch('/api/auth/register', { method: 'POST', body: data })
    await refreshSession()
    await router.push('/')
  }

  // ─── Connexion ─────────────────────────────────────────────────────────────

  const login = async (data: { email: string; password: string }) => {
    await $fetch('/api/auth/login', { method: 'POST', body: data })
    await refreshSession()
    await router.push('/')
  }

  // ─── Déconnexion ───────────────────────────────────────────────────────────

  const logout = async () => {
    const { clear } = useUserSession()
    await clear()
    await router.push('/login')
  }

  // ─── Mise à jour profil ────────────────────────────────────────────────────

  const updateProfile = async (data: { username?: string; avatarUrl?: string | null }) => {
    const result = await $fetch('/api/user/profile', { method: 'PATCH', body: data })
    await refreshSession()
    return result
  }

  return { register, login, logout, updateProfile }
}
