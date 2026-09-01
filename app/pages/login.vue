<script setup lang="ts">
definePageMeta({
  title: 'Connexion — Doobleo',
  layout: 'auth',
})

const { login } = useAuth()
const { loggedIn } = useUserSession()

// Rediriger si déjà connecté
if (loggedIn.value) {
  await navigateTo('/')
}

const form = reactive({ email: '', password: '' })
const error = ref('')
const loading = ref(false)

const handleLogin = async () => {
  error.value = ''
  loading.value = true
  try {
    await login(form)
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    error.value = err.data?.message ?? 'Une erreur est survenue.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-logo">🎙️</div>
      <h1 class="auth-title">Connexion</h1>
      <p class="auth-subtitle">Bon retour sur Doobleo !</p>

      <form class="auth-form" @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="form.email"
            type="email"
            placeholder="ton@email.com"
            autocomplete="email"
            required
          />
        </div>

        <div class="form-group">
          <label for="password">Mot de passe</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
            required
          />
        </div>

        <p v-if="error" class="form-error" role="alert">{{ error }}</p>

        <button type="submit" class="btn-primary" :disabled="loading">
          {{ loading ? 'Connexion...' : 'Se connecter' }}
        </button>
      </form>

      <div class="auth-footer">
        <p>Pas encore de compte ? <NuxtLink to="/register">S'inscrire</NuxtLink></p>
        <p class="or-divider">— ou —</p>
        <NuxtLink to="/" class="btn-guest">Jouer en tant qu'invité</NuxtLink>
      </div>
    </div>
  </div>
</template>
