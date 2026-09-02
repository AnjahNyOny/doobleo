<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import WaveSurfer from 'wavesurfer.js'

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
const waveformContainerRef = ref<HTMLElement | null>(null)
let wavesurfer: WaveSurfer | null = null

// Init WaveSurfer when elements are ready
watch(
  [videoRef, waveformContainerRef],
  async ([videoEl, containerEl]) => {
    if (videoEl && containerEl && roomInfo.value?.scene?.videoUrl && !wavesurfer) {
      wavesurfer = WaveSurfer.create({
        container: containerEl,
        waveColor: '#4c1d95',
        progressColor: '#8b5cf6',
        cursorColor: 'transparent', // On cache le curseur puisque c'est statique pour la durée
        height: 80,
        normalize: true,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        hideScrollbar: true, // Cache la scrollbar
        interact: false, // Statistique
      })

      const audioToLoad = roomInfo.value.scene.audioVocalsUrl || roomInfo.value.scene.videoUrl
      try {
        await wavesurfer.load(`/api/proxy?url=${encodeURIComponent(audioToLoad)}`)
      } catch (err) {
        console.warn('Erreur WaveSurfer', err)
      }
    }
  },
  { immediate: true }
)

// Synchroniser le zoom de la Waveform sur la réplique active
const activeLineIndex = ref(0)
const lines = ref<Line[]>([])
const activeLine = computed<Line | undefined>(() => lines.value[activeLineIndex.value])

watch(
  [activeLine, () => wavesurfer],
  ([line, ws]) => {
    if (line && ws && waveformContainerRef.value) {
      const durationSec = (line.endMs - line.startMs) / 1000
      if (durationSec > 0) {
        const width = waveformContainerRef.value.clientWidth || 800
        const pxPerSec = width / durationSec
        ws.setOptions({ minPxPerSec: pxPerSec })

        // Petit délai pour laisser le zoom s'appliquer avant de scroller
        setTimeout(() => {
          ws.setScrollTime(line.startMs / 1000)
        }, 50)
      }
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  if (wavesurfer) {
    wavesurfer.destroy()
    wavesurfer = null
  }
  if (wavesurferRecorded) {
    wavesurferRecorded.destroy()
    wavesurferRecorded = null
  }
})

const { isPlaying, currentTimeMs, loadMeTrack, loadVocalsTrack, playSegment, pause, stop } =
  usePlaybackSync(videoRef)

const { isRecording, startRecording, stopRecording, recordedBlob, requestPermission, audioLevel } =
  useMicrophone()

const isStudioReady = ref(false)
// Prises validées (lineId -> Blob)
const recordedTakes = ref<Record<string, Blob>>({})

// Prise temporaire pour la réplique sélectionnée (Blob)
const pendingBlob = ref<Blob | null>(null)

// Prise actuelle pour la réplique sélectionnée (soit validée, soit tout juste enregistrée)
const currentLineTake = computed<Blob | null>(() => {
  if (!activeLine.value) return null
  return pendingBlob.value || recordedTakes.value[activeLine.value.id] || null
})

// Init WaveSurfer recorded (Vert)
const waveformRecordedRef = ref<HTMLElement | null>(null)
let wavesurferRecorded: WaveSurfer | null = null

watch(
  [activeLine, waveformRecordedRef, currentLineTake],
  async ([line, containerEl, takeBlob]) => {
    if (!line || !containerEl) return

    if (!wavesurferRecorded) {
      wavesurferRecorded = WaveSurfer.create({
        container: containerEl,
        waveColor: 'rgba(74, 222, 128, 0.7)', // Vert translucide
        progressColor: 'rgba(34, 197, 94, 0.9)',
        cursorColor: 'transparent',
        height: 80,
        normalize: true,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        hideScrollbar: true,
        interact: false,
      })
    }

    // Sync la largeur / échelle avec l'original
    const durationSec = (line.endMs - line.startMs) / 1000
    if (durationSec > 0) {
      const width = containerEl.clientWidth || 800
      const pxPerSec = width / durationSec
      wavesurferRecorded.setOptions({ minPxPerSec: pxPerSec })
    }

    if (takeBlob) {
      try {
        await wavesurferRecorded.loadBlob(takeBlob)
      } catch (err) {
        console.warn('Erreur chargement prise', err)
      }
    } else {
      wavesurferRecorded.empty()
    }
  },
  { immediate: true }
)

// L'audio player (previewAudio) est maintenant géré par wavesurferRecorded
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
const countdown = ref<number | null>(null)
let countdownTimer: ReturnType<typeof setInterval> | null = null

const recordTake = async () => {
  if (!activeLine.value || countdown.value !== null) return
  stopPreview()

  // Efface l'ancienne prise (fait disparaître la courbe verte instantanément)
  pendingBlob.value = null
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete recordedTakes.value[activeLine.value.id]

  await requestPermission()

  // Lancer le compte à rebours
  countdown.value = 3
  countdownTimer = setInterval(() => {
    if (countdown.value && countdown.value > 1) {
      countdown.value--
    } else {
      if (countdownTimer) clearInterval(countdownTimer)
      countdown.value = null

      // Démarrer réellement l'enregistrement
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
  }, 1000)
}

// 2b. Arrêter manuellement l'enregistrement (ou annuler le compte à rebours)
const stopTake = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
    countdown.value = null
  }
  stopRecording()
  pause()
}

// 3. Écouter ma propre prise
const playMyTake = () => {
  if (!activeLine.value || !currentLineTake.value || isRecording.value) return
  stopPreview()

  isReviewing.value = true

  // Lancer la vidéo au bon endroit
  if (videoRef.value) {
    videoRef.value.currentTime = activeLine.value.startMs / 1000
    videoRef.value.muted = true
    videoRef.value.play().catch(() => {})
  }

  if (wavesurferRecorded) {
    wavesurferRecorded.play()
    wavesurferRecorded.once('finish', () => {
      stopPreview()
    })
  }
}

const stopPreview = () => {
  if (wavesurferRecorded && wavesurferRecorded.isPlaying()) {
    wavesurferRecorded.pause()
    wavesurferRecorded.setTime(0)
  }
  if (isReviewing.value) {
    pause()
    isReviewing.value = false
  }
}

// ─── CURSEUR DE LECTURE ────────────────────────────────────────────────────
const playheadProgress = computed(() => {
  if (!activeLine.value || !currentTimeMs.value) return -1

  if (!isRecording.value && !isPlaying.value && !isReviewing.value) return -1

  const total = activeLine.value.endMs - activeLine.value.startMs
  if (total <= 0) return -1

  const relativeTime = currentTimeMs.value - activeLine.value.startMs

  if (relativeTime < 0 || relativeTime > total) return -1

  return Math.min(Math.max((relativeTime / total) * 100, 0), 100)
})

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

const selectLine = (index: number) => {
  if (isRecording.value) return
  stopPreview()
  pause()

  // Sauvegarde automatique de la prise non validée si on change de ligne
  if (pendingBlob.value && activeLine.value) {
    recordedTakes.value[activeLine.value.id] = pendingBlob.value
  }

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

  // Sauvegarde automatique de la dernière prise
  if (pendingBlob.value && activeLine.value) {
    recordedTakes.value[activeLine.value.id] = pendingBlob.value
    pendingBlob.value = null
  }

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
  <div class="studio-page new-layout">
    <div v-if="!isStudioReady" class="loading-overlay">
      <div class="spinner" />
      <p>Préparation du studio...</p>
    </div>

    <!-- Sidebar à gauche -->
    <aside class="sidebar-left">
      <div class="sidebar-header">
        <h2 class="scene-title">{{ roomInfo?.scene?.title }}</h2>
        <span v-if="myCharId" class="progression-pill">
          {{ completedLinesCount }} / {{ myLines.length }} validées
        </span>
      </div>

      <div class="lines-list">
        <div
          v-for="(line, index) in lines"
          :key="line.id"
          class="line-item"
          :class="{
            'is-active': index === activeLineIndex,
            'is-mine': line.characterId === myCharId,
            'is-done': !!recordedTakes[line.id],
          }"
          @click="selectLine(index)"
        >
          <div class="line-char" :style="{ color: getChar(line.characterId)?.color || '#6366f1' }">
            {{ getChar(line.characterId)?.name }}
            <span v-if="!!recordedTakes[line.id]" class="status-icon">✓</span>
          </div>
          <div class="line-text">{{ line.text }}</div>
        </div>
      </div>
    </aside>

    <!-- Zone principale centrale -->
    <main class="main-workspace">
      <!-- Indicateur d'enregistrement global -->
      <div class="workspace-header">
        <div v-if="isRecording" class="recording-indicator">
          <div class="red-dot" />
          ENREGISTREMENT EN COURS
        </div>
        <div class="spacer" />
        <button
          v-if="completedLinesCount > 0"
          class="btn-finish"
          :disabled="isRecording || isUploading"
          @click="handleEnd"
        >
          🚀 Terminer et Passer au Mix
        </button>
      </div>

      <!-- Vidéo au centre (réduite) -->
      <div class="video-container">
        <video
          ref="videoRef"
          :src="roomInfo?.scene?.videoUrl"
          class="scene-video"
          muted
          playsinline
        />
      </div>

      <!-- Panneau de la réplique active et des boutons -->
      <div class="active-line-panel">
        <div v-if="activeLine" class="active-line-content">
          <div class="card-header">
            <span
              class="char-badge"
              :style="{ background: getChar(activeLine.characterId)?.color || '#6366f1' }"
            >
              {{ getChar(activeLine.characterId)?.name || 'Personnage' }}
            </span>
            <span v-if="recordedTakes[activeLine.id]" class="validated-tag">✓ Déjà validé</span>
            <span v-else-if="pendingBlob" class="recorded-tag">● Prise prête</span>
          </div>

          <h1 class="main-text">{{ activeLine.text }}</h1>

          <!-- Contrôles d'action -->
          <div v-if="activeLine.characterId === myCharId" class="controls">
            <button
              class="btn-control btn-listen"
              :disabled="isRecording || isReviewing || countdown !== null"
              @click="playReference"
            >
              <span class="icon">▶️</span> Écouter Référence
            </button>

            <button
              v-if="!isRecording && countdown === null"
              class="btn-control btn-record"
              :disabled="isReviewing"
              @click="recordTake"
            >
              <span class="icon">🎤</span>
              {{ currentLineTake ? 'Réenregistrer' : 'Enregistrer' }}
            </button>
            <button
              v-else-if="countdown !== null"
              class="btn-control btn-record countdown-btn"
              @click="stopTake"
            >
              <span class="icon">⏱️</span> Préparez-vous : {{ countdown }}
            </button>
            <button v-else class="btn-control btn-stop-rec" @click="stopTake">
              <span class="icon">⏹️</span> Arrêter l'enregistrement
            </button>

            <button
              v-if="!isReviewing"
              class="btn-control btn-review"
              :disabled="!currentLineTake || isRecording || countdown !== null"
              @click="playMyTake"
            >
              <span class="icon">🎧</span> Écouter ma prise
            </button>
            <button v-else class="btn-control btn-review is-active-review" @click="stopPreview">
              <span class="icon">⏸️</span> Pause preview
            </button>

            <button
              class="btn-control btn-validate"
              :disabled="!currentLineTake || isRecording || isReviewing || countdown !== null"
              @click="validateTake"
            >
              <span class="icon">✅</span> Valider
            </button>
          </div>

          <div v-else class="waiting-turn">
            <p>
              Cette réplique appartient à
              <strong>{{ getChar(activeLine.characterId)?.name }}</strong
              >.
            </p>
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

      <!-- Graphiques et VU-meter en bas -->
      <div class="bottom-panel">
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

        <div v-show="activeLine" class="studio-waveform-wrapper">
          <div class="waveform-label">
            <span class="label-ref">Voix originale</span>
            <span v-if="currentLineTake" class="label-take"> / Votre prise</span>
          </div>
          <div class="waveforms-stack">
            <div ref="waveformContainerRef" class="waveform-container" />
            <div ref="waveformRecordedRef" class="waveform-container waveform-recorded" />

            <div
              v-show="playheadProgress >= 0"
              class="playhead-cursor"
              :style="{ left: playheadProgress + '%' }"
            />
          </div>
        </div>
      </div>
    </main>

    <!-- Overlay d'upload final -->
    <div v-if="isUploading" class="uploading-overlay">
      <div class="spinner" />
      <p>Envoi de vos enregistrements vers le studio...</p>
    </div>
  </div>
</template>

<style scoped>
.studio-page {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #09090b;
  font-family:
    'Inter',
    system-ui,
    -apple-system,
    sans-serif;
  color: white;
  display: flex;
}

/* ─── OVERLAYS ─── */
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

/* ─── SIDEBAR (LEFT) ─── */
.sidebar-left {
  width: 320px;
  background: #121217;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  z-index: 10;
}
.sidebar-header {
  padding: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.scene-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: white;
  margin: 0 0 0.5rem 0;
}
.progression-pill {
  display: inline-block;
  background: rgba(168, 85, 247, 0.2);
  border: 1px solid rgba(168, 85, 247, 0.4);
  color: #d8b4fe;
  padding: 0.25rem 0.6rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
}
.lines-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}
.line-item {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.line-item:hover {
  background: rgba(255, 255, 255, 0.08);
}
.line-item.is-active {
  background: rgba(168, 85, 247, 0.15);
  border-color: rgba(168, 85, 247, 0.4);
}
.line-item.is-mine {
  border-left: 4px solid #a855f7;
}
.line-item.is-done {
  border-left-color: #22c55e;
}
.line-char {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  display: flex;
  justify-content: space-between;
}
.status-icon {
  color: #22c55e;
  font-weight: 800;
}
.line-text {
  font-size: 0.85rem;
  color: #cbd5e1;
  line-height: 1.4;
  /* limit to 3 lines */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ─── MAIN WORKSPACE ─── */
.main-workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: radial-gradient(circle at top, #1a1a24 0%, #09090b 100%);
  position: relative;
  overflow: hidden;
}
.workspace-header {
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
}
.spacer {
  flex: 1;
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
  animation: pulse 1.5s infinite;
}
.red-dot {
  width: 10px;
  height: 10px;
  background: #ef4444;
  border-radius: 50%;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
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

/* ─── VIDEO CONTAINER ─── */
.video-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 2rem 0 2rem;
  min-height: 0; /* allows shrinking */
}
.scene-video {
  width: 100%;
  max-width: 900px;
  max-height: 100%;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
  background: #000;
  object-fit: contain;
}

/* ─── ACTIVE LINE & CONTROLS ─── */
.active-line-panel {
  padding: 1.5rem 2rem;
  display: flex;
  justify-content: center;
}
.active-line-content {
  width: 100%;
  max-width: 900px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.char-badge {
  padding: 0.25rem 1rem;
  border-radius: 20px;
  font-weight: 800;
  font-size: 0.8rem;
  text-transform: uppercase;
  color: white;
}
.validated-tag,
.recorded-tag {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
}
.validated-tag {
  background: rgba(34, 197, 94, 0.2);
  border: 1px solid rgba(34, 197, 94, 0.4);
  color: #4ade80;
}
.recorded-tag {
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.4);
  color: #93c5fd;
}

.main-text {
  font-size: 1.75rem;
  font-weight: 800;
  line-height: 1.35;
  color: #f8fafc;
  margin: 0 0 1.5rem 0;
}

.controls,
.turn-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}
.btn-control {
  padding: 0.75rem 1.25rem;
  border-radius: 12px;
  font-weight: 700;
  font-size: 0.95rem;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
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
}

.btn-control.btn-record {
  background: linear-gradient(135deg, #ef4444, #f43f5e);
}
.btn-control.btn-record:hover:not(:disabled) {
  background: linear-gradient(135deg, #dc2626, #e11d48);
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
}
.countdown-btn {
  background: linear-gradient(135deg, #f59e0b, #d97706) !important;
  animation: pulse-orange 1s infinite;
}
@keyframes pulse-orange {
  0% {
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(245, 158, 11, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
  }
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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

/* ─── BOTTOM PANEL (WAVEFORM & VU) ─── */
.bottom-panel {
  padding: 0 2rem 2rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
.vu-meter {
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.5rem 1rem;
  border-radius: 16px;
  width: 250px;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.vu-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  font-weight: 700;
  color: #94a3b8;
  text-align: center;
}
.vu-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}
.vu-fill {
  height: 100%;
  transition: width 0.08s ease-out;
}

.studio-waveform-wrapper {
  width: 100%;
  max-width: 1200px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  overflow: hidden;
}
.waveform-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 0.5rem 1rem 0;
}
.label-ref {
  color: #c4b5fd;
}
.label-take {
  color: #86efac;
}
.waveforms-stack {
  position: relative;
  width: 100%;
}
.waveform-container {
  width: 100%;
  padding-bottom: 0.25rem;
}
.waveform-recorded {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  z-index: 2;
  pointer-events: none;
}
.playhead-cursor {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background-color: #ef4444;
  box-shadow:
    0 0 10px rgba(239, 68, 68, 0.8),
    0 0 4px rgba(239, 68, 68, 1);
  z-index: 10;
  pointer-events: none;
}
</style>
