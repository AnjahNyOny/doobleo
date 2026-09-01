<script setup lang="ts">
definePageMeta({
  title: 'Mon profil — Doobleo',
  middleware: 'auth',
})

const { session } = useUserSession()
const { updateProfile, logout } = useAuth()

const form = reactive({
  username: session.value?.user?.username ?? '',
})
const success = ref(false)
const error = ref('')
const loading = ref(false)

const handleUpdate = async () => {
  success.value = false
  error.value = ''
  loading.value = true
  try {
    await updateProfile({ username: form.username })
    success.value = true
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    error.value = err.data?.message ?? 'Une erreur est survenue.'
  } finally {
    loading.value = false
  }
}

const handleLogout = async () => {
  await logout()
}
</script>

<template>
  <div class="profile-page">
    <div class="profile-card">
      <div class="profile-header">
        <div class="profile-avatar">
          <img
            v-if="session?.user?.avatarUrl"
            :src="session.user.avatarUrl"
            :alt="session?.user?.username"
          />
          <span v-else class="avatar-placeholder">{{
            session?.user?.username?.[0]?.toUpperCase()
          }}</span>
        </div>
        <div>
          <h1 class="profile-username">{{ session?.user?.username }}</h1>
          <span class="profile-role" :class="session?.user?.role">{{ session?.user?.role }}</span>
        </div>
      </div>

      <form class="profile-form" @submit.prevent="handleUpdate">
        <div class="form-group">
          <label for="username">Pseudo</label>
          <input
            id="username"
            v-model="form.username"
            type="text"
            minlength="2"
            maxlength="30"
            required
          />
        </div>

        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <p v-if="success" class="form-success" role="status">Profil mis à jour !</p>

        <div class="profile-actions">
          <button type="submit" class="btn-primary" :disabled="loading">
            {{ loading ? 'Sauvegarde...' : 'Sauvegarder' }}
          </button>
          <button type="button" class="btn-danger" @click="handleLogout">Se déconnecter</button>
        </div>
      </form>
    </div>
  </div>
</template>
