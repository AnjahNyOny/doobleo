<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'

definePageMeta({ title: 'Studio — Doobleo' })

const route = useRoute()
const router = useRouter()
const code = route.params.code as string

const { connect, getSocket } = useSocket()
const socket = getSocket() || connect()

const { loggedIn, user } = useUserSession()
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
interface Character {
  id: string
  name: string
  color: string
}

interface Line {
  id: string
  sceneId: string
  characterId: string
  text: string
  startMs: number
  endMs: number
  order: number
}

const state = ref<any>(null)
const myCharId = ref<string>('')

const videoRef = ref<HTMLVideoElement | null>(null)
const {
  isPlaying,
  loadMeTrack,
  loadVocalsTrack,
  playSegment,
  pause,
  stop,
  updateTime,
} = usePlaybackSync(videoRef)

const {
  isRecording,
  startRecording,
  stopRecording,
  recordedBlob,
  requestPermission,
  audioLevel,
} = useMicrophone()

const isStudioReady = ref(false)
const lines = ref<Line[]>([])

// Ligne active
const activeLineIndex = ref(0)
const activeLine = computed<Line | undefined>(() => lines.value[activeLineIndex.value])

// Prises validées (lineId -> Blob)
const recordedTakes = ref<Record<string, Blob>>({})

// Prise temporaire pour la réplique sélectionnée (Blob)
const pendingBlob = ref<Blob | null>(null)

// Prise actuelle pour la réplique sélectionnée (soit validée, soit tout juste enregistrée)
const currentLineTake = computed<Blob | null>(() => {
  if (!activeLine.value) return null
  return pendingBlob.value || recordedTakes.value[activeLine.value.id] || null
})

// Audio player pour écouter sa propre prise en preview sans soucis de décodage WebAudio
const previewAudio = ref<HTMLAudioElement | null>(null)
const isReviewing = ref(false)

onMounted(async () => {
  await requestPermission()

  lines.value = (roomInfo.value?.scene?.lines as Line[]) || []

  if (roomInfo.value?.scene?.audioMeUrl) {
    await loadMeTrack(roomInfo.value.scene.audioMeUrl)
  }
  if (roomInfo.value?.scene?.audioVocalsUrl) {
    await loadVocalsTrack(roomInfo.value.scene.audioVocalsUrl)
  }

  isStudioReady.value = true

  socket.emit('join_room', { roomCode: code, userId: userId.value, isHost: false })

  socket.on('room_state_update', (roomState: any) => {
    state.value = roomState
    const me = roomState.players.find((p: any) => p.userId === userId.value)
    if (me?.characterId) {
      myCharId.value = me.characterId
      // Pointer vers la première réplique de ce personnage
      const firstMine = lines.value.findIndex((l) => l.characterId === myCharId.value)
      if (firstMine !== -1) activeLineIndex.value = firstMine
    }
  })
})

// Détecte quand un nouvel enregistrement micro est disponible
watch(recordedBlob, (blob) => {
  if (blob) {
    pendingBlob.value = blob
  }
})

// ─── WORKFLOW LIGNE PAR LIGNE ──────────────────────────────────────────────

// 1. Écouter la référence originale
const playReference = () => {
  if (!activeLine.value || isRecording.value) return
  stopPreview()
  playSegment(activeLine.value.startMs, activeLine.value.endMs, false)
}

// 2. Enregistrer
const recordTake = async () => {
  if (!activeLine.value) return
  stopPreview()

  await requestPermission()
  startRecording()

  playSegment(
    activeLine.value.startMs,
    activeLine.value.endMs,
    true, // mode enregistrement (fond M&E seul ou mute)
    () => {
      // Fin automatique à la fin du timecode
      stopRecording()
    }
  )
}

// 2b. Arrêter manuellement l'enregistrement
const stopTake = () => {
  stopRecording()
  pause()
}

// 3. Écouter ma propre prise
const playMyTake = () => {
  if (!activeLine.value || !currentLineTake.value || isRecording.value) return
  stopPreview()

  isReviewing.value = true

  // Créer ou réutiliser l'élément audio de preview
  if (!previewAudio.value) {
    previewAudio.value = new Audio()
  }
  const blobUrl = URL.createObjectURL(currentLineTake.value)
  previewAudio.value.src = blobUrl

  // Lancer la vidéo au bon endroit
  if (videoRef.value) {
    videoRef.value.currentTime = activeLine.value.startMs / 1000
    videoRef.value.muted = true
    videoRef.value.play().catch(() => {})
  }

  previewAudio.value.play().catch((err) => console.warn('Erreur preview audio:', err))

  previewAudio.value.onended = () => {
    stopPreview()
  }
}

const stopPreview = () => {
  if (previewAudio.value) {
    previewAudio.value.pause()
    previewAudio.value.currentTime = 0
  }
  if (isReviewing.value) {
    pause()
    isReviewing.value = false
  }
}

// 4. Valider la prise
const validateTake = () => {
  if (!activeLine.value || !currentLineTake.value) return
  stopPreview()

  recordedTakes.value[activeLine.value.id] = currentLineTake.value
  pendingBlob.value = null

  // Passer à la prochaine ligne de mon personnage
  const nextMine = lines.value.findIndex(
    (l, i) => i > activeLineIndex.value && l.characterId === myCharId.value
  )
  if (nextMine !== -1) {
    activeLineIndex.value = nextMine
  } else {
    // Si toutes les lignes sont validées
    const allDone = myLines.value.every((l) => recordedTakes.value[l.id])
    if (allDone) {
      handleEnd()
    }
  }
}

// Changer de réplique manuellement
const selectLine = (index: number) => {
  if (isRecording.value) return
  stopPreview()
  pause()
  activeLineIndex.value = index
  pendingBlob.value = null
}

// ─── MES RÉPLIQUES ─────────────────────────────────────────────────────────
const myLines = computed(() => {
  if (!myCharId.value) return []
  return lines.value.filter((l) => l.characterId === myCharId.value)
})

const completedLinesCount = computed(() => {
  return myLines.value.filter((l) => recordedTakes.value[l.id]).length
})

// ─── FIN & UPLOAD ──────────────────────────────────────────────────────────
const isUploading = ref(false)

const handleEnd = async () => {
  stopPreview()
  pause()
  stopRecording()

  if (!myCharId.value) {
    router.push(`/room/${code}/playback`)
    return
  }

  isUploading.value = true
  try {
    const takesEntries = Object.entries(recordedTakes.value)
    const chunks: { key: string; startMs: number }[] = []

    for (const [lineId, blob] of takesEntries) {
      const line = lines.value.find((l) => l.id === lineId)
      if (!line) continue

      const filename = `rec_${code}_${userId.value}_${lineId}.webm`
      const { presignedUrl, key } = await $fetch<{ presignedUrl: string; key: string }>(
        '/api/recordings/upload',
        {
          method: 'POST',
          body: { filename, contentType: blob.type },
        }
      )

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.onload = () => (xhr.status === 200 ? resolve() : reject(new Error('Upload failed')))
        xhr.onerror = () => reject(new Error('Network error'))
        xhr.open('PUT', presignedUrl)
        xhr.setRequestHeader('Content-Type', blob.type)
        xhr.send(blob)
      })

      chunks.push({ key, startMs: line.startMs })
    }

    // Notifier le salon avec tous les chunks
    socket.emit('audio_uploaded_chunks', {
      roomCode: code,
      userId: userId.value,
      characterId: myCharId.value,
      chunks,
    })

    router.push(`/room/${code}/playback`)
  } catch (e) {
    console.error(e)
    alert("Erreur lors de l'upload des audios.")
  } finally {
    isUploading.value = false
  }
}

const getChar = (charId: string): Character | undefined => {
  return (roomInfo.value?.scene?.characters as Character[])?.find((c) => c.id === charId)
}

onUnmounted(() => {
  stopPreview()
  stop()
  stopRecording()
})
</script>

<template>
  <div class="studio-page">
    <div v-if="!isStudioReady" class="loading-overlay">
      <div class="spinner" />
      <p>Préparation du studio...</p>
    </div>

    <!-- Vidéo en arrière-plan plein écran -->
    <video
      ref="videoRef"
      :src="roomInfo?.scene?.videoUrl"
      class="bg-video"
      muted
      playsinline
      @timeupdate="updateTime"
    />
    <div class="video-overlay" />

    <!-- UI Studio Ligne par Ligne -->
    <div class="studio-ui">
      <!-- En-tête -->
      <div class="header">
        <div class="header-left">
          <h2 class="scene-title">{{ roomInfo?.scene?.title }}</h2>
          <span v-if="myCharId" class="progression-pill">
            {{ completedLinesCount }} / {{ myLines.length }} validées
          </span>
        </div>

        <div class="header-right">
          <div v-if="isRecording" class="recording-indicator">
            <div class="red-dot" /> ENREGISTREMENT EN COURS
          </div>

          <button
            v-if="completedLinesCount > 0"
            class="btn-finish"
            :disabled="isRecording || isUploading"
            @click="handleEnd"
          >
            🚀 Terminer et Passer au Mix
          </button>
        </div>
      </div>

      <!-- Zone centrale : Réplique courante -->
      <div class="center-content">
        <div v-if="activeLine" class="active-line-display">
          <div class="card-header">
            <span
              class="char-badge"
              :style="{ background: getChar(activeLine.characterId)?.color || '#6366f1' }"
            >
              {{ getChar(activeLine.characterId)?.name || 'Personnage' }}
            </span>
            <span v-if="recordedTakes[activeLine.id]" class="validated-tag">
              ✓ Déjà validé
            </span>
            <span v-else-if="pendingBlob" class="recorded-tag">
              ● Prise prête
            </span>
          </div>

          <h1 class="main-text">{{ activeLine.text }}</h1>

          <!-- Contrôles d'action -->
          <div v-if="activeLine.characterId === myCharId" class="controls">
            <!-- 1. Écouter la référence -->
            <button
              class="btn-control btn-listen"
              :disabled="isRecording || isReviewing"
              @click="playReference"
            >
              <span class="icon">▶️</span> Écouter Référence
            </button>

            <!-- 2. Enregistrer / Arrêter -->
            <button
              v-if="!isRecording"
              class="btn-control btn-record"
              :disabled="isReviewing"
              @click="recordTake"
            >
              <span class="icon">🎤</span>
              {{ currentLineTake ? 'Réenregistrer' : 'Enregistrer' }}
            </button>
            <button
              v-else
              class="btn-control btn-stop-rec"
              @click="stopTake"
            >
              <span class="icon">⏹️</span> Arrêter l'enregistrement
            </button>

            <!-- 3. Écouter sa prise -->
            <button
              v-if="!isReviewing"
              class="btn-control btn-review"
              :disabled="!currentLineTake || isRecording"
              @click="playMyTake"
            >
              <span class="icon">🎧</span> Écouter ma prise
            </button>
            <button
              v-else
              class="btn-control btn-review is-active-review"
              @click="stopPreview"
            >
              <span class="icon">⏸️</span> Pause preview
            </button>

            <!-- 4. Valider -->
            <button
              class="btn-control btn-validate"
              :disabled="!currentLineTake || isRecording || isReviewing"
              @click="validateTake"
            >
              <span class="icon">✅</span> Valider
            </button>
          </div>

          <!-- Si la ligne n'appartient pas au joueur actuel -->
          <div v-else class="waiting-turn">
            <p>Cette réplique appartient à <strong>{{ getChar(activeLine.characterId)?.name }}</strong>.</p>
            <div class="turn-actions">
              <button class="btn-control btn-listen" :disabled="isPlaying" @click="playReference">
                ▶️ Écouter l'extrait
              </button>
              <button
                v-if="activeLineIndex < lines.length - 1"
                class="btn-control btn-next"
                @click="activeLineIndex++"
              >
                Réplique suivante ➔
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Barre de son VU Meter (active pendant l'enregistrement) -->
      <div v-if="isRecording" class="vu-meter">
        <div class="vu-label">Niveau micro</div>
        <div class="vu-bar">
          <div
            class="vu-fill"
            :style="{
              width: `${audioLevel}%`,
              background: audioLevel > 80 ? '#ef4444' : audioLevel > 40 ? '#22c55e' : '#3b82f6',
            }"
          />
        </div>
      </div>

      <!-- Timeline des répliques (en bas) -->
      <div class="lines-timeline">
        <div
          v-for="(line, index) in lines"
          :key="line.id"
          class="timeline-item"
          :class="{
            'is-active': index === activeLineIndex,
            'is-mine': line.characterId === myCharId,
            'is-done': !!recordedTakes[line.id],
          }"
          @click="selectLine(index)"
        >
          <div
            class="char-indicator"
            :style="{ background: getChar(line.characterId)?.color || '#6366f1' }"
          />
          <div class="timeline-info">
            <span class="timeline-char">{{ getChar(line.characterId)?.name }}</span>
            <span class="line-preview">{{ line.text }}</span>
          </div>
          <div v-if="recordedTakes[line.id]" class="done-badge" title="Validée">✓</div>
          <div v-else-if="line.characterId === myCharId" class="mine-dot" />
        </div>
      </div>

      <!-- Overlay d'upload final -->
      <div v-if="isUploading" class="uploading-overlay">
        <div class="spinner" />
        <p>Envoi de vos enregistrements vers le studio...</p>
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
  background: #09090b;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  color: white;
}

.loading-overlay,
.uploading-overlay {
  position: absolute;
  inset: 0;
  z-index: 100;
  background: rgba(9, 9, 11, 0.92);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  gap: 1.25rem;
  backdrop-filter: blur(8px);
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-left-color: #a855f7;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

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
  filter: brightness(0.45);
}

.video-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgba(0, 0, 0, 0.3) 0%, rgba(9, 9, 11, 0.85) 100%);
  z-index: 2;
}

.studio-ui {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  padding: 1.5rem 2rem;
  gap: 1.5rem;
}

/* ─── HEADER ─── */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.scene-title {
  font-size: 1.35rem;
  font-weight: 700;
  color: white;
  margin: 0;
}
.progression-pill {
  background: rgba(168, 85, 247, 0.2);
  border: 1px solid rgba(168, 85, 247, 0.4);
  color: #d8b4fe;
  padding: 0.35rem 0.85rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.recording-indicator {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.5);
  color: #fca5a5;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-weight: 700;
  font-size: 0.85rem;
  letter-spacing: 0.05em;
  animation: pulse 1.5s infinite;
}
.red-dot {
  width: 10px;
  height: 10px;
  background: #ef4444;
  border-radius: 50%;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.btn-finish {
  background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%);
  color: white;
  border: none;
  padding: 0.6rem 1.25rem;
  border-radius: 12px;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(168, 85, 247, 0.4);
  transition: all 0.2s;
}
.btn-finish:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(168, 85, 247, 0.6);
}
.btn-finish:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ─── CENTRE : RÉPLIQUE ACTIVE ─── */
.center-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.active-line-display {
  background: rgba(18, 18, 23, 0.85);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 28px;
  padding: 3rem;
  max-width: 850px;
  width: 100%;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  animation: fadeIn 0.3s ease;
}
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}
.char-badge {
  display: inline-block;
  padding: 0.35rem 1.2rem;
  border-radius: 20px;
  font-weight: 800;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: white;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}
.validated-tag {
  background: rgba(34, 197, 94, 0.2);
  border: 1px solid rgba(34, 197, 94, 0.4);
  color: #4ade80;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
}
.recorded-tag {
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.4);
  color: #93c5fd;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
}

.main-text {
  font-size: 2.5rem;
  font-weight: 800;
  line-height: 1.35;
  color: #f8fafc;
  margin-bottom: 2.5rem;
  max-width: 750px;
}

/* ─── BOUTONS D'ACTION ─── */
.controls {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn-control {
  padding: 0.85rem 1.5rem;
  border-radius: 14px;
  font-weight: 700;
  font-size: 1rem;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  color: white;
}
.btn-control:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  filter: grayscale(0.8);
  transform: none !important;
}

.btn-listen {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
}
.btn-listen:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.16);
  transform: translateY(-2px);
}

.btn-record {
  background: #ef4444;
  box-shadow: 0 4px 15px rgba(239, 68, 68, 0.35);
}
.btn-record:hover:not(:disabled) {
  background: #dc2626;
  box-shadow: 0 6px 20px rgba(239, 68, 68, 0.6);
  transform: translateY(-2px);
}

.btn-stop-rec {
  background: #b91c1c;
  border: 1px solid #f87171;
  animation: pulse 1s infinite;
}

.btn-review {
  background: #3b82f6;
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.35);
}
.btn-review:hover:not(:disabled) {
  background: #2563eb;
  transform: translateY(-2px);
}
.is-active-review {
  background: #1d4ed8;
  border-color: #60a5fa;
}

.btn-validate {
  background: #22c55e;
  box-shadow: 0 4px 15px rgba(34, 197, 94, 0.35);
}
.btn-validate:hover:not(:disabled) {
  background: #16a34a;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(34, 197, 94, 0.6);
}

.btn-next {
  background: rgba(255, 255, 255, 0.1);
}

.waiting-turn {
  color: #94a3b8;
  font-size: 1.1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
}
.turn-actions {
  display: flex;
  gap: 1rem;
}

/* ─── VU METER ─── */
.vu-meter {
  align-self: center;
  background: rgba(0, 0, 0, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0.75rem 1.5rem;
  border-radius: 24px;
  backdrop-filter: blur(12px);
  width: 280px;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.vu-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 0.05em;
  text-align: center;
}
.vu-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  overflow: hidden;
}
.vu-fill {
  height: 100%;
  transition: width 0.08s ease-out;
}

/* ─── TIMELINE RÉPLIQUES ─── */
.lines-timeline {
  display: flex;
  gap: 0.85rem;
  overflow-x: auto;
  padding: 0.5rem 0.25rem 0.75rem 0.25rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}
.timeline-item {
  flex: 0 0 auto;
  width: 240px;
  background: rgba(18, 18, 23, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 0.85rem 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  position: relative;
}
.timeline-item:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}
.timeline-item.is-active {
  border-color: #a855f7;
  background: rgba(168, 85, 247, 0.15);
  box-shadow: 0 0 15px rgba(168, 85, 247, 0.25);
}
.timeline-item.is-mine {
  border-left: 3px solid #a855f7;
}
.timeline-item.is-done {
  border-color: rgba(34, 197, 94, 0.4);
}

.char-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.timeline-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  gap: 0.2rem;
}
.timeline-char {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #cbd5e1;
}
.line-preview {
  color: #94a3b8;
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.done-badge {
  color: #22c55e;
  font-weight: 800;
  margin-left: auto;
  font-size: 1rem;
}
.mine-dot {
  width: 6px;
  height: 6px;
  background: #a855f7;
  border-radius: 50%;
  margin-left: auto;
}
</style>
