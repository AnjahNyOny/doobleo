<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Library } from 'lucide-vue-next'

definePageMeta({ title: 'Doobleo — Doublez vos films entre amis' })

const router = useRouter()
const { loggedIn, user } = useUserSession()
const { logout } = useAuth()

// ─── ETAT INVITE ─────────────────────────────────────────────────────────────
const guestName = ref('')
const guestId = ref('')

const { disconnect } = useSocket()
const availableScenes = ref<{ id: string; title: string }[]>([])
const selectedSceneId = ref('')

onMounted(async () => {
  disconnect() // S'assurer de nettoyer la socket en revenant à l'accueil
  if (!loggedIn.value) {
    const savedName = sessionStorage.getItem('guestName')
    const savedId = sessionStorage.getItem('guestId')

    if (savedName) guestName.value = savedName

    if (savedId) {
      guestId.value = savedId
    } else {
      // Générer un ID unique temporaire pour l'invité
      const newId = 'guest-' + Math.random().toString(36).substring(2, 9)
      sessionStorage.setItem('guestId', newId)
      guestId.value = newId
    }
  }

  // Charger les scènes disponibles
  try {
    const scenes = await $fetch('/api/scenes')
    if (scenes && scenes.length > 0) {
      availableScenes.value = scenes
      selectedSceneId.value = scenes[0].id
    }
  } catch (e) {
    console.error('Erreur chargement des scènes', e)
  }
})

const updateGuest = () => {
  if (guestName.value.trim()) {
    sessionStorage.setItem('guestName', guestName.value.trim())
  }
}

// ─── ACTIONS ─────────────────────────────────────────────────────────────────
const roomCodeInput = ref('')
const loadingCreate = ref(false)
const errorMsg = ref('')

// Récupérer le user ou l'invité
const getCurrentUser = () => {
  if (loggedIn.value && user.value) {
    return { id: user.value.id, username: user.value.username, avatarUrl: user.value.avatarUrl }
  }

  if (!guestName.value.trim()) {
    errorMsg.value = 'Veuillez entrer un pseudo.'
    return null
  }
  updateGuest()
  return { id: guestId.value, username: guestName.value.trim(), avatarUrl: null }
}

const createRoom = async () => {
  errorMsg.value = ''
  const currentUser = getCurrentUser()
  if (!currentUser) return

  loadingCreate.value = true
  try {
    const res = await $fetch('/api/rooms', {
      method: 'POST',
      body: {
        hostUserId: currentUser.id,
        hostUsername: currentUser.username,
        hostAvatarUrl: currentUser.avatarUrl,
      },
    })

    // Redirection
    router.push(`/room/${res.room.code}`)
  } catch (e: any) {
    errorMsg.value = e.data?.message || 'Erreur lors de la création.'
  } finally {
    loadingCreate.value = false
  }
}

const joinRoom = () => {
  errorMsg.value = ''
  const code = roomCodeInput.value.toUpperCase().trim()
  if (code.length !== 6) {
    errorMsg.value = 'Le code doit contenir 6 caractères.'
    return
  }

  const currentUser = getCurrentUser()
  if (!currentUser) return

  router.push(`/room/${code}`)
}
</script>

<template>
  <div class="lobby-page">
    <div class="hero-section">
      <h1 class="hero-title text-gradient">Prêtez votre voix.</h1>
      <p class="hero-subtitle">Redoublez vos scènes de films préférées entre amis en temps réel.</p>
    </div>

    <div class="glass-card main-card">
      <div v-if="!loggedIn" class="guest-form">
        <label>Votre pseudo</label>
        <input
          v-model="guestName"
          type="text"
          class="input-field"
          placeholder="Ex: John Doe"
          maxlength="20"
          @blur="updateGuest"
        />
        <p class="auth-hint">
          Ou <NuxtLink to="/login" class="link">connectez-vous</NuxtLink> pour garder votre
          progression.
        </p>
      </div>

      <div v-else class="user-profile">
        <div class="profile-left">
          <img v-if="user?.avatarUrl" :src="user.avatarUrl" class="avatar" />
          <div v-else class="avatar-placeholder">{{ user?.username.charAt(0).toUpperCase() }}</div>
          <div>
            <p class="welcome-text">Content de vous revoir,</p>
            <p class="username">{{ user?.username }}</p>
          </div>
        </div>
        <button class="btn-sm-ghost" title="Se déconnecter" @click="logout">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>

      <div class="library-action">
        <NuxtLink
          to="/library"
          class="btn-secondary w-full"
          style="display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem"
        >
          <Library :size="18" /> Explorer la Bibliothèque de Scènes
        </NuxtLink>
      </div>

      <div class="divider" />

      <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>

      <div class="actions-grid">
        <div class="action-box">
          <h3 class="box-title">Rejoindre une partie</h3>
          <div class="join-form">
            <input
              v-model="roomCodeInput"
              type="text"
              class="input-field code-input"
              placeholder="CODE"
              maxlength="6"
            />
            <button class="btn-primary" @click="joinRoom">Rejoindre</button>
          </div>
        </div>

        <div class="action-divider">OU</div>

        <div class="action-box">
          <h3 class="box-title">Créer une partie</h3>
          <p class="box-desc">Créez un salon et invitez vos amis à doubler.</p>
          <div class="create-form">
            <button class="btn-secondary w-full" :disabled="loadingCreate" @click="createRoom">
              {{ loadingCreate ? 'Création...' : 'Héberger un salon' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <NuxtLink v-if="user?.role === 'admin'" to="/admin" class="admin-link"
      >→ Accéder au Panel Admin</NuxtLink
    >
  </div>
</template>

<style scoped>
.lobby-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 1rem;
}
@media (min-width: 768px) {
  .lobby-page {
    padding: 2rem;
  }
}

.hero-section {
  text-align: center;
  margin-bottom: 3rem;
  animation: fadeInDown 0.8s ease-out;
}

.hero-title {
  font-size: 2.2rem;
  font-weight: 800;
  margin-bottom: 1rem;
}
@media (min-width: 768px) {
  .hero-title {
    font-size: 3.5rem;
  }
}

.hero-subtitle {
  font-size: 1.1rem;
  color: var(--text-muted);
  max-width: 500px;
  margin: 0 auto;
}
@media (min-width: 768px) {
  .hero-subtitle {
    font-size: 1.25rem;
  }
}

.main-card {
  width: 100%;
  max-width: 600px;
  animation: fadeInUp 0.8s ease-out 0.2s both;
}

.guest-form label {
  display: block;
  font-size: 0.9rem;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.auth-hint {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 0.75rem;
  text-align: right;
}

.link {
  color: var(--primary);
  text-decoration: none;
}
.link:hover {
  text-decoration: underline;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.avatar,
.avatar-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid var(--primary);
}
.avatar-placeholder {
  background: var(--primary-glow);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1.25rem;
  color: white;
}
.welcome-text {
  font-size: 0.85rem;
  color: var(--text-muted);
}
.username {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-main);
}

.divider {
  height: 1px;
  background: var(--border-color);
  margin: 2rem 0;
}

.actions-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}

@media (min-width: 600px) {
  .actions-grid {
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 1.5rem;
  }
}

.box-title {
  font-size: 1.1rem;
  color: var(--text-main);
  margin-bottom: 0.5rem;
}

.action-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 0.9rem;
  font-weight: 600;
}

.box-desc {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: 1rem;
}

.join-form {
  display: flex;
  gap: 0.5rem;
}

.code-input {
  text-transform: uppercase;
  text-align: center;
  letter-spacing: 0.1em;
  font-weight: 600;
}

.w-full {
  width: 100%;
}

.error-text {
  color: #f87171;
  font-size: 0.9rem;
  text-align: center;
  margin-bottom: 1rem;
  background: rgba(248, 113, 113, 0.1);
  padding: 0.5rem;
  border-radius: var(--radius);
}

.logout-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.library-action {
  margin-top: 1.5rem;
  padding: 0 1rem;
}

.admin-link {
  margin-top: 2rem;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.9rem;
  transition: var(--transition);
}
.admin-link:hover {
  color: var(--text-main);
}

/* Animations */
@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
