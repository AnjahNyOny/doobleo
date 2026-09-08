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
    <!-- Top Nav -->
    <nav class="top-nav">
      <div class="logo">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5z"
          />
          <path
            d="M12 9.5c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5z"
          />
        </svg>
        <span>Doobleo</span>
      </div>

      <div class="nav-actions">
        <!-- Admin link discreetly placed in nav for admins only -->
        <NuxtLink
          v-if="user?.role === 'admin'"
          to="/admin"
          class="admin-badge"
          title="Panel d'administration"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Admin
        </NuxtLink>

        <ClientOnly>
          <ColorModeToggle />
        </ClientOnly>
      </div>
    </nav>

    <div class="lobby-container">
      <!-- Left Column: Hero -->
      <div class="hero-section">
        <h1 class="hero-title">Prêtez<br /><span class="text-gradient">votre voix.</span></h1>
        <p class="hero-subtitle">
          Redoublez vos scènes de films préférées entre amis en temps réel.
        </p>

        <div class="hero-actions">
          <NuxtLink to="/library" class="btn-library">
            <Library :size="20" /> Explorer la Bibliothèque
          </NuxtLink>
        </div>
      </div>

      <!-- Right Column: Interactive Card -->
      <div class="interactive-section">
        <div class="glass-card main-card">
          <!-- Auth Section -->
          <div class="auth-section">
            <div v-if="!loggedIn" class="guest-form">
              <label class="input-label">Votre pseudo</label>
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
                <div v-else class="avatar-placeholder">
                  {{ user?.username.charAt(0).toUpperCase() }}
                </div>
                <div class="profile-info">
                  <span class="welcome-text">Content de vous revoir,</span>
                  <span class="username">{{ user?.username }}</span>
                </div>
              </div>
              <button class="btn-logout" title="Se déconnecter" @click="logout">
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
          </div>

          <div class="divider" />

          <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>

          <!-- Actions Section -->
          <div class="game-actions">
            <!-- Join -->
            <div class="action-block">
              <h3 class="block-title">Rejoindre un salon</h3>
              <p class="block-desc">Entrez le code fourni par votre ami.</p>
              <div class="join-form">
                <input
                  v-model="roomCodeInput"
                  type="text"
                  class="input-field code-input"
                  placeholder="CODE"
                  maxlength="6"
                  @keyup.enter="joinRoom"
                />
                <button class="btn-primary" @click="joinRoom">Rejoindre</button>
              </div>
            </div>

            <div class="or-badge"><span>OU</span></div>

            <!-- Create -->
            <div class="action-block">
              <h3 class="block-title">Créer un salon</h3>
              <p class="block-desc">Hébergez une session et invitez vos amis à doubler.</p>
              <button
                class="btn-secondary w-full create-btn"
                :disabled="loadingCreate"
                @click="createRoom"
              >
                {{ loadingCreate ? 'Création en cours...' : 'Héberger un salon' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lobby-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-body);
  position: relative;
  overflow: hidden;
}

/* Flou décoratif en arrière-plan */
.lobby-page::before {
  content: '';
  position: absolute;
  top: -20%;
  left: -10%;
  width: 50vw;
  height: 50vw;
  background: radial-gradient(circle, var(--theme-accent) 0%, transparent 60%);
  opacity: 0.05;
  filter: blur(100px);
  z-index: 0;
  pointer-events: none;
}
.lobby-page::after {
  content: '';
  position: absolute;
  bottom: -20%;
  right: -10%;
  width: 60vw;
  height: 60vw;
  background: radial-gradient(circle, var(--theme-secondary) 0%, transparent 60%);
  opacity: 0.05;
  filter: blur(100px);
  z-index: 0;
  pointer-events: none;
}

/* Top Navigation */
.top-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  position: relative;
  z-index: 10;
}
.logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-family: 'Cinzel', serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: 1px;
}
.logo svg {
  color: var(--theme-accent);
}
.nav-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.admin-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  padding: 0.4rem 0.8rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  text-decoration: none;
  transition: all 0.2s ease;
  border: 1px solid rgba(239, 68, 68, 0.2);
}
.admin-badge:hover {
  background: #ef4444;
  color: white;
}

/* Layout Principal */
.lobby-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  position: relative;
  z-index: 10;
  gap: 3rem;
}

@media (min-width: 992px) {
  .lobby-container {
    flex-direction: row;
    justify-content: space-between;
    padding: 2rem;
    gap: 4rem;
  }
}

/* Colonne Gauche: Hero */
.hero-section {
  text-align: center;
  flex: 1;
  max-width: 500px;
  animation: fadeInDown 0.8s ease-out;
}
@media (min-width: 992px) {
  .hero-section {
    text-align: left;
  }
}

.hero-title {
  font-size: 3rem;
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 1.5rem;
  font-family: 'Cinzel', serif;
  color: var(--text-main);
}
@media (min-width: 992px) {
  .hero-title {
    font-size: 4.5rem;
  }
}
.hero-subtitle {
  font-size: 1.1rem;
  line-height: 1.6;
  color: var(--text-muted);
  margin-bottom: 2.5rem;
  font-family: 'DM Sans', sans-serif;
}
@media (min-width: 992px) {
  .hero-subtitle {
    font-size: 1.25rem;
  }
}

.btn-library {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  background: var(--theme-accent);
  color: white;
  padding: 1rem 2rem;
  border-radius: 50px;
  font-size: 1.1rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(203, 153, 126, 0.3); /* Couleur Warm Neutral */
}
.btn-library:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(203, 153, 126, 0.5);
  background: #b5856b;
}

/* Colonne Droite: Carte Interactive */
.interactive-section {
  flex: 1;
  width: 100%;
  max-width: 480px;
  animation: fadeInUp 0.8s ease-out 0.2s both;
}

.main-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 24px;
  padding: 2.5rem;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(16px);
}
:root.dark-mode .main-card {
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  background: rgba(30, 30, 30, 0.7);
}

.input-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.input-field {
  width: 100%;
  padding: 0.875rem 1rem;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  color: var(--text-main);
  font-size: 1rem;
  transition: all 0.2s;
  font-family: 'DM Sans', sans-serif;
}
.input-field:focus {
  outline: none;
  border-color: var(--theme-accent);
  box-shadow: 0 0 0 3px rgba(203, 153, 126, 0.15);
}

.auth-hint {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-top: 0.75rem;
}
.link {
  color: var(--theme-accent);
  font-weight: 600;
  text-decoration: none;
}
.link:hover {
  text-decoration: underline;
}

/* Profil Utilisateur Connecté */
.user-profile {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-hover);
  padding: 1rem;
  border-radius: 16px;
  border: 1px solid var(--border-color);
}
.profile-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.avatar,
.avatar-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  object-fit: cover;
}
.avatar-placeholder {
  background: var(--theme-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.25rem;
  color: var(--text-main);
}
.profile-info {
  display: flex;
  flex-direction: column;
}
.welcome-text {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
}
.username {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-main);
}

.btn-logout {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 8px;
  transition: all 0.2s;
}
.btn-logout:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

/* Séparateur central */
.divider {
  height: 1px;
  background: var(--border-color);
  margin: 2rem 0;
}

/* Bloc d'actions (Rejoindre / Créer) */
.game-actions {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  position: relative;
}

.action-block {
  display: flex;
  flex-direction: column;
}

.block-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 0.25rem;
}
.block-desc {
  font-size: 0.9rem;
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
  letter-spacing: 2px;
  font-weight: 700;
  font-size: 1.1rem;
}

.btn-primary,
.btn-secondary {
  padding: 0.875rem 1.5rem;
  border-radius: 12px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-primary {
  background: var(--text-main);
  color: var(--bg-body);
}
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.btn-secondary {
  background: var(--theme-secondary);
  color: var(--text-main);
  border: 1px solid var(--border-color);
}
.btn-secondary:hover {
  background: var(--border-focus);
}
.create-btn {
  font-size: 1.1rem;
  padding: 1rem;
}

/* Badge "OU" */
.or-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0.5rem 0;
  position: relative;
}
.or-badge::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--border-color);
  z-index: 1;
}
.or-badge span {
  background: var(--bg-card);
  padding: 0 1rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
  z-index: 2;
  position: relative;
}

/* Erreurs */
.error-text {
  color: #ef4444;
  font-size: 0.9rem;
  text-align: center;
  margin-bottom: 1.5rem;
  background: rgba(239, 68, 68, 0.1);
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.w-full {
  width: 100%;
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
