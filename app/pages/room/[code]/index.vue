<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { Copy, Check } from 'lucide-vue-next'

definePageMeta({ title: "Salle d'attente — Doobleo" })

const route = useRoute()
const router = useRouter()
const code = route.params.code as string

const { loggedIn, user } = useUserSession()
const { connect, disconnect } = useSocket()

// ─── ETAT DU JOUEUR ────────────────────────────────────────────────────────
const userId = ref('')
const username = ref('')

onMounted(() => {
  if (loggedIn.value && user.value) {
    userId.value = user.value.id
    username.value = user.value.username
  } else {
    const savedId = sessionStorage.getItem('guestId')
    const savedName = sessionStorage.getItem('guestName')
    if (!savedId || !savedName) {
      alert('Veuillez définir un pseudo.')
      router.push('/')
      return
    }
    userId.value = savedId
    username.value = savedName
  }
})

// ─── ETAT DU SALON ─────────────────────────────────────────────────────────
const { data: roomInfo, error, refresh } = await useFetch(`/api/rooms/${code}`)
if (error.value) {
  alert(error.value.data?.message || 'Erreur lors du chargement du salon.')
  router.push('/')
}

const socketState = ref<any>(null)
const socketError = ref('')
const countdown = ref<number | null>(null)
const availableScenes = ref<any[]>([])

if (!roomInfo.value?.sceneId) {
  const scenes = await $fetch('/api/scenes')
  availableScenes.value = scenes as any[]
}

const isHost = computed(() => roomInfo.value?.hostUserId === userId.value)
const players = computed(() => socketState.value?.players || [])
const characters = computed(() => roomInfo.value?.scene?.characters || [])

// ─── ACTIONS ───────────────────────────────────────────────────────────────

const selectScene = async (sceneId: string) => {
  if (!isHost.value) return
  try {
    await $fetch(`/api/rooms/${code}/scene`, {
      method: 'PUT',
      body: { sceneId },
    })
    // Force refresh the room info to get the scene and characters
    await refresh()
  } catch (e: any) {
    socketError.value = e.data?.message || 'Erreur lors du choix de la scène.'
  }
}

// ─── SOCKET ────────────────────────────────────────────────────────────────
let socket: any

onMounted(() => {
  if (!userId.value) return // Wait for init

  socket = connect()

  socket.emit('join_room', { roomCode: code, userId: userId.value, isHost: isHost.value })

  socket.on('room_state_update', async (state: any) => {
    // Si la scène a été modifiée, on rafraîchit les infos de la room
    if (state.sceneId && roomInfo.value && state.sceneId !== roomInfo.value.sceneId) {
      await refresh()
    }

    socketState.value = state

    // Si la partie a commencé, on redirige vers le studio
    if (state.status === 'playing') {
      router.push(`/room/${code}/studio`)
    }
  })

  socket.on('character_locked_error', (data: any) => {
    socketError.value = data.message
    setTimeout(() => (socketError.value = ''), 3000)
  })

  socket.on('start_countdown', ({ duration }: { duration: number }) => {
    countdown.value = duration
    // Clear any existing interval
    if ((window as any).__countdownInterval) {
      clearInterval((window as any).__countdownInterval)
    }
    const interval = setInterval(() => {
      countdown.value! -= 1
      if (countdown.value! <= 0) {
        clearInterval(interval)
        countdown.value = null
      }
    }, 1000)
    ;(window as any).__countdownInterval = interval
  })
})

onUnmounted(() => {
  // Ne pas déconnecter ici, on navigue vers studio.vue
})

// ─── ACTIONS ───────────────────────────────────────────────────────────────

const selectCharacter = (charId: string) => {
  if (countdown.value !== null) return // Bloqué pendant le compte à rebours
  socket.emit('select_character', { roomCode: code, userId: userId.value, characterId: charId })
}

const startGame = () => {
  if (!isHost.value) return
  // Optionnel: On peut avertir si des persos sont vides, mais on laisse l'hôte décider.
  socket.emit('host_start_game', { roomCode: code })
}

const leaveRoom = () => {
  disconnect()
  router.push('/')
}

// Utilitaires UI
const getPlayerByChar = (charId: string) => {
  return players.value.find((p: any) => p.characterIds && p.characterIds.includes(charId))
}
const isCharTakenByOther = (charId: string) => {
  const p = getPlayerByChar(charId)
  return p && p.userId !== userId.value
}
const isMyChar = (charId: string) => {
  const p = getPlayerByChar(charId)
  return p && p.userId === userId.value
}

const copied = ref(false)
const copyCode = () => {
  navigator.clipboard.writeText(code).then(() => {
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  })
}
</script>

<template>
  <div class="room-page">
    <div class="header">
      <div class="brand text-gradient">Doobleo</div>
      <div class="header-actions">
        <div
          class="room-code"
          title="Copier le code"
          style="cursor: pointer; display: flex; align-items: center; gap: 0.5rem"
          @click="copyCode"
        >
          Code: <strong>{{ code }}</strong>
          <Copy v-if="!copied" :size="16" class="copy-icon" />
          <Check v-else :size="16" style="color: var(--theme-accent)" />
          <span v-if="copied" style="font-size: 0.75rem; color: var(--theme-accent)">Copié !</span>
        </div>
        <button class="btn-sm-ghost" title="Quitter la partie" @click="leaveRoom">Quitter</button>
      </div>
    </div>

    <!-- Écran Compte à rebours superposé -->
    <div v-if="countdown !== null" class="countdown-overlay">
      <h2>Préparez-vous...</h2>
      <div class="countdown-number">{{ countdown }}</div>
    </div>

    <div class="layout-grid" :class="{ 'blur-bg': countdown !== null }">
      <!-- PANEL GAUCHE : Joueurs -->
      <div class="players-panel">
        <h2 class="panel-title">Joueurs ({{ players.length }})</h2>
        <div class="players-list">
          <div v-for="player in players" :key="player.userId" class="player-card">
            <div class="player-avatar">
              {{ player.userId === userId.value ? username.charAt(0).toUpperCase() : '?' }}
            </div>
            <div class="player-info">
              <span class="player-name">
                {{ player.userId === userId.value ? username : 'Joueur connecté' }}
                <span v-if="player.userId === roomInfo?.hostUserId" class="host-badge">Hôte</span>
              </span>
              <span
                v-if="player.characterIds && player.characterIds.length > 0"
                class="status-ready"
                >Prêt</span
              >
              <span v-else class="status-choosing">Choisit...</span>
            </div>
          </div>
        </div>

        <div v-if="isHost" class="host-controls">
          <button class="btn-primary w-full" @click="startGame">Lancer la partie</button>
          <p v-if="socketError" class="error-msg">{{ socketError }}</p>
        </div>
        <div v-else class="guest-msg">En attente du lancement par l'hôte...</div>
      </div>

      <!-- PANEL DROITE : Choix Scène OU Personnages -->
      <div class="scene-panel glass-card">
        <!-- ETAT 1 : Pas de scène choisie -->
        <template v-if="!roomInfo?.sceneId">
          <div v-if="isHost" class="scene-selection">
            <h2 class="panel-title mb-4">Choisissez une scène à doubler</h2>
            <div class="scenes-grid">
              <button
                v-for="scene in availableScenes"
                :key="scene.id"
                class="scene-card"
                @click="selectScene(scene.id)"
              >
                <div class="scene-card-content">
                  <h3 class="scene-card-title">{{ scene.title }}</h3>
                  <p class="scene-card-desc">{{ scene.description }}</p>
                </div>
              </button>
            </div>
          </div>
          <div v-else class="guest-msg waiting-scene">
            <h2>En attente de l'hôte...</h2>
            <p>L'hôte est en train de choisir la scène à doubler.</p>
          </div>
        </template>

        <!-- ETAT 2 : Scène choisie, choix des persos -->
        <template v-else>
          <div class="scene-header">
            <h1 class="scene-title">{{ roomInfo?.scene?.title }}</h1>
            <span class="scene-duration">▶ 00:00</span>
          </div>

          <p class="instruction">Choisissez votre personnage :</p>

          <div class="characters-grid">
            <button
              v-for="char in characters"
              :key="char.id"
              class="character-card"
              :class="{
                'is-mine': isMyChar(char.id),
                'is-taken': isCharTakenByOther(char.id),
              }"
              :style="{ '--char-color': char.color }"
              :disabled="isCharTakenByOther(char.id)"
              @click="selectCharacter(char.id)"
            >
              <div class="char-color-dot" :style="{ background: char.color }" />
              <div class="char-content">
                <span class="char-name">{{ char.name }}</span>
                <span v-if="isMyChar(char.id)" class="char-status my-status">Mon choix</span>
                <span v-else-if="isCharTakenByOther(char.id)" class="char-status taken-status"
                  >Déjà pris</span
                >
              </div>
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.room-page {
  min-height: 100vh;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}
@media (min-width: 768px) {
  .header {
    flex-direction: row;
    justify-content: space-between;
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.brand {
  font-family: 'Outfit', sans-serif;
  font-size: 1.5rem;
  font-weight: 800;
}

.room-code {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-family: monospace;
  font-size: 1.1rem;
  color: var(--text-muted);
}
.room-code strong {
  color: var(--text-main);
  letter-spacing: 2px;
}

.layout-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  flex: 1;
  transition: filter 0.3s;
}
@media (min-width: 900px) {
  .layout-grid {
    grid-template-columns: 320px 1fr;
  }
}
.blur-bg {
  filter: blur(8px) brightness(0.6);
  pointer-events: none;
}

/* ─── PLAYERS PANEL ─── */
.players-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.panel-title {
  font-size: 1.1rem;
  color: var(--text-muted);
}
.players-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
}
.player-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.player-avatar {
  width: 36px;
  height: 36px;
  background: var(--primary-glow);
  border: 1px solid var(--primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: white;
}
.player-info {
  display: flex;
  flex-direction: column;
}
.player-name {
  color: var(--text-main);
  font-weight: 500;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.host-badge {
  background: var(--theme-accent);
  color: #451a03;
  font-size: 0.6rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}
.status-ready {
  font-size: 0.8rem;
  color: #4ade80;
}
.status-choosing {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.host-controls {
  background: var(--bg-card);
  padding: 1.5rem;
  border-radius: var(--radius);
  border: 1px solid var(--border-color);
}
.guest-msg {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.9rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: var(--radius);
}
.error-msg {
  color: #f87171;
  font-size: 0.85rem;
  text-align: center;
  margin-top: 0.75rem;
}

/* ─── SCENE PANEL ─── */
.scene-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
}
.scene-title {
  font-size: 2rem;
  color: var(--text-main);
}
.scene-duration {
  font-family: monospace;
  color: var(--text-muted);
}
.instruction {
  font-size: 1.1rem;
  color: var(--text-muted);
  margin-bottom: 1.5rem;
}
.scenes-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}
@media (min-width: 600px) {
  .scenes-grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }
}

.characters-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}
@media (min-width: 600px) {
  .characters-grid {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  }
}

.character-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}
.character-card:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--theme-accent);
  transform: translateY(-2px);
}
.character-card.is-mine {
  border-color: var(--char-color);
  background: var(--bg-hover);
}
.character-card.is-taken {
  opacity: 0.4;
  cursor: not-allowed;
  filter: grayscale(100%);
}

.char-color-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  flex-shrink: 0;
}
.char-content {
  display: flex;
  flex-direction: column;
}
.char-name {
  color: var(--text-main);
  font-weight: 600;
  font-size: 1.1rem;
}
.char-status {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  margin-top: 2px;
}
.my-status {
  color: var(--char-color);
}
.taken-status {
  color: #f87171;
}

/* ─── COUNTDOWN ─── */
.countdown-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-main);
}
.countdown-overlay h2 {
  font-size: 2rem;
  color: var(--primary);
  margin-bottom: 1rem;
  animation: fadeInDown 0.5s;
}
.countdown-number {
  font-size: 8rem;
  font-weight: 800;
  font-family: 'Outfit', sans-serif;
  text-shadow: 0 0 40px var(--primary-glow);
  animation: popIn 1s infinite;
}

@keyframes popIn {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  20% {
    transform: scale(1.1);
    opacity: 1;
  }
  50% {
    transform: scale(1);
    opacity: 1;
  }
  80% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}
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
</style>
