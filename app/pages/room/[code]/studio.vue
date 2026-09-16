<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import WaveSurfer from 'wavesurfer.js'
import {
  Headphones,
  Mic,
  Check,
  Play,
  Pause,
  Square,
  Timer,
  ArrowLeft,
  Menu,
  X,
  Rocket,
  Circle,
} from 'lucide-vue-next'

definePageMeta({ title: 'Studio — Doobleo' })

const route = useRoute()
const router = useRouter()
const code = route.params.code as string

const { connect, getSocket, disconnect } = useSocket()
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
const myCharIds = ref<string[]>([])

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
        await wavesurfer.load(audioToLoad)
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
const showMobileSidebar = ref(false)
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
    if (me?.characterIds && me.characterIds.length > 0) {
      myCharIds.value = me.characterIds
      // Pointer vers la première réplique de l'un de ces personnages
      const firstMine = lines.value.findIndex((l) => myCharIds.value.includes(l.characterId))
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

  // Passer à la prochaine ligne de l'un de mes personnages
  const nextMine = lines.value.findIndex(
    (l, i) => i > activeLineIndex.value && myCharIds.value.includes(l.characterId)
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
  if (!myCharIds.value.length) return []
  return lines.value.filter((l) => myCharIds.value.includes(l.characterId))
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

  if (!myCharIds.value.length) {
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
      characterId: myCharIds.value[0] || '', // Pour retrocompatibilité
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

const leaveStudio = () => {
  stopPreview()
  stop()
  stopRecording()
  disconnect()
  router.push('/')
}
</script>

<template>
  <div class="studio-page new-layout">
    <div v-if="!isStudioReady" class="loading-overlay">
      <div class="spinner" />
      <p>Préparation du studio...</p>
    </div>

    <!-- Sidebar à gauche -->
    <aside class="sidebar-left" :class="{ 'is-open': showMobileSidebar }">
      <div class="sidebar-header">
        <div class="sidebar-title-row">
          <h2 class="scene-title">{{ roomInfo?.scene?.title }}</h2>
          <button class="mobile-close-btn" @click="showMobileSidebar = false">
            <X :size="20" />
          </button>
        </div>
        <span v-if="myCharIds.length > 0" class="progression-pill">
          {{ completedLinesCount }} / {{ myLines.length }} validées
        </span>
      </div>

      <div class="lines-list">
        <div
          v-for="(line, index) in lines"
          :key="line.id"
          class="line-row"
          :class="{
            'is-active': activeLineIndex === index,
            'not-my-turn': myCharIds.length > 0 && !myCharIds.includes(line.characterId),
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
        <button class="mobile-menu-btn" @click="showMobileSidebar = true">
          <Menu :size="16" class="icon" /> Répliques
        </button>
        <button class="btn-sm-ghost btn-leave" title="Retour au lobby" @click="leaveStudio">
          <ArrowLeft :size="16" class="icon" /> Quitter le studio
        </button>
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
          <Rocket :size="16" /> Terminer et Passer au Mix
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
            <span class="char-badge">
              {{ getChar(activeLine.characterId)?.name || 'Personnage' }}
            </span>
            <span v-if="recordedTakes[activeLine.id]" class="validated-tag"
              ><Check :size="12" /> Déjà validé</span
            >
            <span v-else-if="pendingBlob" class="recorded-tag"
              ><Circle :size="12" /> Prise prête</span
            >
          </div>

          <h1 class="main-text">{{ activeLine.text }}</h1>

          <!-- Compte à rebours visuel -->
          <transition name="fade">
            <div v-if="countdown !== null" class="visual-countdown">
              {{ countdown }}
            </div>
          </transition>

          <!-- Contrôles d'action -->
          <div v-if="myCharIds.includes(activeLine.characterId)" class="controls">
            <button
              class="btn-control btn-listen"
              title="Écouter Référence"
              :disabled="isRecording || isReviewing || countdown !== null"
              @click="playReference"
            >
              <span class="icon"><Play :size="16" /></span>
            </button>

            <button
              v-if="!isRecording && countdown === null"
              class="btn-control btn-record"
              :title="currentLineTake ? 'Réenregistrer' : 'Enregistrer'"
              :disabled="isReviewing"
              @click="recordTake"
            >
              <span class="icon"><Mic :size="16" /></span>
            </button>
            <button
              v-else-if="countdown !== null"
              class="btn-control btn-record countdown-btn"
              :title="'Préparez-vous : ' + countdown"
              @click="stopTake"
            >
              <span class="icon"><Timer :size="16" /></span>
            </button>
            <button v-else class="btn-control btn-stop-rec" title="Arrêter" @click="stopTake">
              <span class="icon"><Square :size="16" fill="currentColor" /></span>
            </button>

            <button
              v-if="!isReviewing"
              class="btn-control btn-review"
              title="Écouter ma prise"
              :disabled="!currentLineTake || isRecording || countdown !== null"
              @click="playMyTake"
            >
              <span class="icon"><Headphones :size="16" /></span>
            </button>
            <button
              v-else
              class="btn-control btn-review is-active-review"
              title="Pause"
              @click="stopPreview"
            >
              <span class="icon"><Pause :size="16" /></span>
            </button>

            <button
              class="btn-control btn-validate"
              title="Valider"
              :disabled="!currentLineTake || isRecording || isReviewing || countdown !== null"
              @click="validateTake"
            >
              <span class="icon"><Check :size="16" /></span>
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
  z-index: 50;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  transform: translateX(-100%);
  transition: transform 0.3s ease;
}
.sidebar-left.is-open {
  transform: translateX(0);
}
@media (min-width: 900px) {
  .sidebar-left {
    position: static;
    transform: none;
  }
}

.sidebar-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.mobile-close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.2rem;
  cursor: pointer;
}
@media (min-width: 900px) {
  .mobile-close-btn {
    display: none;
  }
}

.sidebar-header {
  padding: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.scene-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: white;
  margin: 0;
}
.progression-pill {
  display: inline-block;
  background: var(--bg-hover);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
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
  scrollbar-color: var(--border-color) transparent;
}
.line-row {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.line-row:hover {
  background: var(--bg-hover);
}
.line-row.is-active {
  border-color: var(--text-main);
  background: var(--bg-input);
}
.line-row.is-mine {
  border-style: dashed;
}
.line-row.not-my-turn {
  opacity: 0.45;
  filter: grayscale(100%);
}
.line-row.is-done {
  opacity: 0.7;
}
.line-row-char {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  display: flex;
  justify-content: space-between;
  color: var(--text-muted);
}
.status-icon {
  color: var(--text-main);
  font-weight: 800;
}
.line-text {
  font-size: 0.85rem;
  color: var(--text-main);
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
  background: var(--bg-main);
  position: relative;
  overflow: hidden;
}
.workspace-header {
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  flex-wrap: wrap;
  gap: 0.5rem;
}
@media (min-width: 600px) {
  .workspace-header {
    padding: 1rem 2rem;
  }
}

.mobile-menu-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
}
@media (min-width: 900px) {
  .mobile-menu-btn {
    display: none;
  }
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
  background: var(--text-main);
  color: var(--text-inverse);
  border: none;
  padding: 0.6rem 1.25rem;
  border-radius: 4px;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.btn-finish:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
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
  padding: 4rem 1rem 0 1rem; /* more top padding to avoid header on mobile */
  min-height: 0; /* allows shrinking */
}
@media (min-width: 600px) {
  .video-container {
    padding: 4rem 2rem 0 2rem;
  }
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
  padding: 1rem;
  display: flex;
  justify-content: center;
}
@media (min-width: 600px) {
  .active-line-panel {
    padding: 1.5rem 2rem;
  }
}
.active-line-content {
  width: 100%;
  max-width: 900px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}
@media (min-width: 600px) {
  .active-line-content {
    padding: 2rem;
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.char-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-weight: 800;
  font-size: 0.8rem;
  text-transform: uppercase;
  background: var(--bg-hover);
  color: var(--text-main);
  border: 1px solid var(--border-color);
}
.validated-tag,
.recorded-tag {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.main-text {
  font-family: 'DM Sans', sans-serif;
  font-size: 1.2rem;
  font-weight: 600;
  line-height: 1.35;
  color: var(--text-main);
  margin: 0 0 1rem 0;
  text-transform: none;
}
.visual-countdown {
  font-family: 'Cinzel', serif;
  font-size: 3rem;
  font-weight: 800;
  color: var(--theme-accent);
  margin: 0.5rem 0 1.5rem 0;
  animation: pulse-scale 1s infinite;
}
@keyframes pulse-scale {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.7;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
@media (min-width: 600px) {
  .main-text {
    font-size: 1.75rem;
    margin: 0 0 1.5rem 0;
  }
}

.controls,
.turn-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}
.btn-control {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  padding: 0;
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-main);
  background: var(--bg-card);
}
.btn-control:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--text-main);
  transform: translateY(-2px);
}
.btn-control:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  transform: none !important;
  border-color: transparent;
}
.countdown-btn {
  border-color: var(--text-main);
  animation: pulse-border 1s infinite;
}
@keyframes pulse-border {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.2);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(255, 255, 255, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0);
  }
}
.is-active-review {
  border-color: var(--text-main);
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
  color: var(--text-muted);
  text-align: center;
}
.vu-bar {
  height: 6px;
  background: var(--border-color);
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
  background: var(--bg-hover);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  overflow: hidden;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.waveform-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 0.5rem 1rem 0;
}
.label-ref {
  color: var(--text-main);
}
.label-take {
  color: var(--theme-accent);
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
