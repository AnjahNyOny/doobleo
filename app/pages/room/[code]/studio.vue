<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'

definePageMeta({ title: 'Studio — Doobleo' })

const route = useRoute()
const router = useRouter()
const code = route.params.code as string

const { connect, getSocket } = useSocket()
const socket = getSocket() || connect() // Récupère l'instance existante

const { loggedIn, user } = useAuth()
const userId = ref('')

// ─── INITIALISATION ────────────────────────────────────────────────────────
const { data: roomInfo } = await useFetch(`/api/rooms/${code}`)
if (!roomInfo.value) {
  router.push('/')
}

onMounted(() => {
  if (loggedIn.value && user.value) userId.value = user.value.id
  else userId.value = sessionStorage.getItem('guestId') || ''

  if (!userId.value) router.push('/')
})

// ─── AUDIO & VIDEO SYNC ────────────────────────────────────────────────────
const state = ref<any>(null)
const myCharId = ref<string>('')

const videoRef = ref<HTMLVideoElement | null>(null)
const { currentTimeMs, loadMeTrack, play, stop, updateTime } = usePlaybackSync(videoRef)
const { startRecording, stopRecording, recordedBlob, requestPermission, audioLevel } =
  useMicrophone()

const isStudioReady = ref(false)
const lines = ref<any[]>([])

onMounted(async () => {
  // 1. Demander le micro (interaction utilisateur requise, mais l'user a déjà cliqué dans le lobby)
  await requestPermission()

  // 2. Charger les répliques
  const { data: sceneLines } = await useFetch(`/api/admin/scenes/${roomInfo.value?.sceneId}/lines`)
  lines.value = sceneLines.value || []

  // 3. Charger la piste M&E
  if (roomInfo.value?.scene?.audioMeUrl) {
    await loadMeTrack(roomInfo.value.scene.audioMeUrl)
  }

  isStudioReady.value = true

  // Rejoindre au cas où
  socket.emit('join_room', { roomCode: code, userId: userId.value, isHost: false })

  socket.on('room_state_update', (roomState: any) => {
    state.value = roomState
    const me = roomState.players.find((p: any) => p.userId === userId.value)
    if (me?.characterId) myCharId.value = me.characterId
  })

  // Démarrer automatiquement la lecture et l'enregistrement
  startRecording()
  play()
})

// ─── FIN DE LA SCENE ───────────────────────────────────────────────────────
const isUploading = ref(false)

const handleEnd = async () => {
  stopRecording()
  stop()

  // Si on n'a pas de perso, on était juste spectateur
  if (!myCharId.value) {
    router.push(`/room/${code}/playback`)
    return
  }
}

watch(recordedBlob, async (blob) => {
  if (blob && myCharId.value) {
    isUploading.value = true
    try {
      // 1. Upload vers S3
      const filename = `rec_${code}_${userId.value}.webm`
      const { presignedUrl, key } = await $fetch('/api/recordings/upload', {
        method: 'POST',
        body: { filename, contentType: blob.type },
      })

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.onload = () => (xhr.status === 200 ? resolve() : reject(new Error('Upload failed')))
        xhr.onerror = () => reject(new Error('Network error'))
        xhr.open('PUT', presignedUrl)
        xhr.setRequestHeader('Content-Type', blob.type)
        xhr.send(blob)
      })

      // 2. Notifier le salon
      socket.emit('audio_uploaded', { roomCode: code, userId: userId.value, recordingKey: key })

      // 3. Rediriger vers playback
      router.push(`/room/${code}/playback`)
    } catch (e) {
      console.error(e)
      alert("Erreur lors de l'upload de l'audio.")
    }
  }
})

// ─── PROMPTEUR ─────────────────────────────────────────────────────────────
const activeLineIndex = computed(() => {
  return lines.value.findIndex(
    (l) => currentTimeMs.value >= l.startMs && currentTimeMs.value <= l.endMs
  )
})

const getChar = (charId: string) => {
  return roomInfo.value?.scene?.characters?.find((c: any) => c.id === charId)
}

onUnmounted(() => {
  stop()
  stopRecording()
  // Ne pas déconnecter le socket, on en a besoin dans playback
})
</script>

<template>
  <div class="studio-page">
    <div v-if="!isStudioReady" class="loading-overlay">
      <div class="spinner" />
      <p>Préparation du studio...</p>
    </div>

    <!-- Vidéo en arrière-plan plein écran (assombrie) -->
    <video
      ref="videoRef"
      :src="roomInfo?.scene?.videoUrl"
      class="bg-video"
      muted
      playsinline
      @timeupdate="updateTime"
      @ended="handleEnd"
    />
    <div class="video-overlay" />

    <!-- UI Studio -->
    <div class="studio-ui">
      <!-- Header avec statut -->
      <div class="header">
        <div class="recording-indicator">
          <div class="red-dot" />
          ENREGISTREMENT EN COURS
        </div>
        <div class="vu-meter">
          <div class="vu-bar">
            <div
              class="vu-fill"
              :style="{
                width: `${audioLevel}%`,
                background: audioLevel > 80 ? '#f87171' : '#4ade80',
              }"
            />
          </div>
        </div>
      </div>

      <!-- Prompteur -->
      <div class="prompter-container">
        <div class="lines-window">
          <div
            v-for="(line, index) in lines"
            :key="line.id"
            class="prompter-line"
            :class="{
              'is-active': index === activeLineIndex,
              'is-mine': line.characterId === myCharId,
              'is-past': currentTimeMs > line.endMs,
            }"
            :style="{ '--char-color': getChar(line.characterId)?.color }"
          >
            <span class="char-name" :style="{ color: getChar(line.characterId)?.color }">
              {{ getChar(line.characterId)?.name }}
            </span>
            <span class="line-text">{{ line.text }}</span>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <div v-if="isUploading" class="uploading-banner">Envoi de la piste vocale en cours...</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.studio-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #000;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 100;
  background: var(--bg-dark);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  gap: 1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-left-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ─── VIDEO BG ─── */
.bg-video {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  min-width: 100%;
  min-height: 100%;
  width: auto;
  height: auto;
  object-fit: cover;
  z-index: 1;
}
.video-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.8) 0%,
    rgba(0, 0, 0, 0.2) 20%,
    rgba(0, 0, 0, 0.8) 80%
  );
  z-index: 2;
  backdrop-filter: blur(2px);
}

/* ─── UI ─── */
.studio-ui {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  padding: 2rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.recording-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(220, 38, 38, 0.2);
  border: 1px solid rgba(220, 38, 38, 0.4);
  color: #fca5a5;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-weight: 700;
  font-size: 0.85rem;
  letter-spacing: 0.05em;
  backdrop-filter: blur(10px);
}
.red-dot {
  width: 10px;
  height: 10px;
  background: #ef4444;
  border-radius: 50%;
  animation: blink 1s infinite;
}
@keyframes blink {
  50% {
    opacity: 0.3;
  }
}

.vu-meter {
  background: rgba(0, 0, 0, 0.5);
  padding: 0.75rem 1.5rem;
  border-radius: 20px;
  backdrop-filter: blur(10px);
  width: 200px;
}
.vu-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}
.vu-fill {
  height: 100%;
  transition: width 0.1s ease-out;
}

/* ─── PROMPTEUR ─── */
.prompter-container {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 10vh;
  mask-image: linear-gradient(to bottom, transparent 0%, black 30%, black 70%, transparent 100%);
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    black 30%,
    black 70%,
    transparent 100%
  );
}

.lines-window {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 800px;
  width: 100%;
  transform: translateY(20%); /* Effet de défilement manuel ou auto */
}

.prompter-line {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.5rem;
  opacity: 0.3;
  transform: scale(0.9);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.prompter-line.is-past {
  opacity: 0.1;
}
.prompter-line.is-active {
  opacity: 1;
  transform: scale(1.1);
}
.prompter-line.is-active .line-text {
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
}
.prompter-line.is-active.is-mine .line-text {
  color: white;
  text-shadow: 0 0 30px var(--char-color);
}

.char-name {
  font-size: 1rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.line-text {
  font-size: 2.5rem;
  font-weight: 800;
  line-height: 1.2;
  color: #94a3b8;
}
.is-mine .line-text {
  color: #e2e8f0;
}

.footer {
  display: flex;
  justify-content: center;
}
.uploading-banner {
  background: var(--primary);
  color: white;
  padding: 1rem 2rem;
  border-radius: var(--radius);
  font-weight: 600;
  animation: fadeInUp 0.5s;
}
</style>
