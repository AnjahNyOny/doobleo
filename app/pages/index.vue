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
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 280.624 280.624"
          fill="#4a3b32"
        >
          <path
            d="M202.376,165.176c0.055-0.032,0.109-0.064,0.163-0.099c9.956-6.175,15.9-16.857,15.9-28.575V33.686 c0-12.398-6.473-23.391-17.314-29.405c-6.198-3.44-13.021-4.795-19.694-4.108c-9.302-0.029-33.595-0.042-40.714-0.042 c-6.875,0-13.115,1.708-18.548,5.078L78.144,31.44c-0.044,0.026-0.087,0.053-0.131,0.08c-9.911,6.183-15.829,16.85-15.829,28.532 v102.789c0,8.98,3.352,17.261,9.439,23.315c6.113,6.08,14.71,9.558,23.614,9.558c0.091,0,0.168,0,0.285,0 c1.604,0,10.936,0.153,21.255,0.331v8.534c-28.185,4.381-45.574,15.811-45.574,30.121c0,0.675,0,8.375,0,14 c0,20.958,35.022,31.923,69.618,31.923s69.618-10.965,69.618-31.923c0-5.791,0-13.216,0-14c0-14.489-17.379-25.821-45.745-30.151 v-17.303L202.376,165.176z M193.849,17.397c6.006,3.332,9.591,9.421,9.591,16.289v1.217l-17.966,10.755 c-3.554,2.128-4.71,6.733-2.583,10.288c1.406,2.348,3.893,3.648,6.442,3.648c1.312,0,2.639-0.344,3.846-1.065l10.261-6.143v8.089 L185.474,71.23c-3.554,2.128-4.71,6.733-2.583,10.288c1.406,2.348,3.893,3.648,6.442,3.648c1.312,0,2.639-0.344,3.846-1.065 l10.261-6.143v8.09l-17.965,10.754c-3.555,2.128-4.711,6.733-2.584,10.287c1.405,2.349,3.892,3.649,6.442,3.649 c1.311,0,2.639-0.344,3.845-1.066l10.262-6.142v32.972c0,6.462-3.263,12.354-8.732,15.782l-44.884,26.287 c-0.056,0.032-0.109,0.064-0.164,0.099c-2.757,1.71-5.79,2.639-8.855,2.801c-0.721-0.014-1.588-0.029-2.582-0.047 c-2.552-0.23-5.079-0.991-7.44-2.306c-5.992-3.334-9.57-9.42-9.57-16.277v-11.114l35.687-20.971 c3.571-2.098,4.765-6.694,2.666-10.266c-2.098-3.571-6.695-4.767-10.266-2.666l-28.087,16.505v-8.176l35.687-20.971 c3.571-2.098,4.765-6.694,2.666-10.266c-2.098-3.571-6.695-4.764-10.266-2.666l-28.087,16.505v-8.175L156.9,79.611 c3.571-2.098,4.765-6.694,2.666-10.266c-2.098-3.571-6.695-4.765-10.266-2.666l-28.087,16.505V60.052 c0-6.441,3.246-12.323,8.688-15.756l44.876-26.31c0.06-0.034,0.118-0.07,0.177-0.106c2.361-1.474,4.928-2.369,7.544-2.703 c0.191,0.001,0.384,0.001,0.556,0.002v-0.073C186.714,14.753,190.45,15.512,193.849,17.397z M106.213,113.093H77.184v-10.572h29.029 V113.093z M77.184,128.093h29.029v10.573H77.184V128.093z M85.893,44.284l44.016-26.224c0.044-0.026,0.087-0.053,0.13-0.08 c3.074-1.917,6.567-2.849,10.68-2.849c1.984,0,5.31,0.001,9.268,0.003l-27.768,16.279c-0.06,0.034-0.118,0.07-0.177,0.106 c-9.911,6.183-15.829,16.85-15.829,28.532v27.469H77.184V60.052C77.184,53.604,80.438,47.714,85.893,44.284z M95.46,180.714 c-0.092,0-0.155,0-0.228,0c-4.965,0-9.71-1.89-13.031-5.193c-3.282-3.265-5.018-7.649-5.018-12.68v-9.175h29.029v9.175 c0,6.621,1.863,12.834,5.237,18.111C103.566,180.819,96.92,180.714,95.46,180.714z M142.777,196.389 c2.334-0.208,4.649-0.669,6.918-1.378v27.87c0,4.94-4.018,8.959-8.958,8.959c-4.94,0-8.959-4.018-8.959-8.959V196.31 C133.661,196.344,142.777,196.389,142.777,196.389z M195.44,234.701c0,0.269-0.077,0.644-0.196,1.023 c-2.12,6.11-22.392,15.9-54.422,15.9c-32.411,0-52.888-10.023-54.596-16.116c-0.042-0.409-0.022-0.773-0.022-0.807 c0-3.528,9.039-11.161,30.574-14.92v3.101c0,13.211,10.748,23.959,23.959,23.959c13.211,0,23.958-10.748,23.958-23.959v-3.133 C186.072,223.454,195.44,231.159,195.44,234.701z"
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
  color: var(--bg-main);
}
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  background: var(--theme-accent);
  color: #fff;
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
