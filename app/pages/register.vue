<script setup lang="ts">
definePageMeta({
  middleware: 'guest',
})

const { register } = useAuth()
const { loggedIn } = useUserSession()

if (loggedIn.value) {
  await navigateTo('/')
}

const form = reactive({ username: '', email: '', password: '' })
const error = ref('')
const loading = ref(false)

const handleRegister = async () => {
  error.value = ''
  loading.value = true
  try {
    await register(form)
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
      <h1 class="auth-title">Créer un compte</h1>
      <p class="auth-subtitle">Rejoins la communauté Doobleo</p>

      <form class="auth-form" @submit.prevent="handleRegister">
        <div class="form-group">
          <label for="username">Pseudo</label>
          <input
            id="username"
            v-model="form.username"
            type="text"
            placeholder="TonPseudo"
            autocomplete="username"
            minlength="2"
            maxlength="30"
            required
          />
          <span class="form-hint">2-30 caractères, lettres, chiffres, _ et -</span>
        </div>

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
            placeholder="Min. 8 caractères"
            autocomplete="new-password"
            minlength="8"
            required
          />
        </div>

        <p v-if="error" class="form-error" role="alert">{{ error }}</p>

        <button type="submit" class="btn-primary" :disabled="loading">
          {{ loading ? 'Création...' : 'Créer mon compte' }}
        </button>
      </form>

      <div class="auth-footer">
        <p>Déjà un compte ? <NuxtLink to="/login">Se connecter</NuxtLink></p>
        <p class="or-divider">— ou —</p>
        <NuxtLink to="/" class="btn-guest">Jouer en tant qu'invité</NuxtLink>
      </div>
    </div>
  </div>
</template>
