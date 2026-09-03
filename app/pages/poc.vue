<script setup lang="ts">
// NOTE: Cette page est un PoC de développement. Elle ne sera pas dans le produit final.
import { ref, onUnmounted, computed, watch } from 'vue'

definePageMeta({ title: 'PoC Multimédia — Doobleo' })

const { data: scenes } = await useFetch('/api/admin/scenes')
const publishedScenes = computed(() => scenes.value?.filter((s) => s.isPublished) || [])
const selectedSceneId = ref('')

const currentScene = computed(() =>
  publishedScenes.value.find((s) => s.id === selectedSceneId.value)
)

// ─── MICROPHONE ─────────────────────────────────────────────────────────────

const {
  isRecording,
  hasPermission,
  error: micError,
  audioLevel,
  recordedBlob,
  requestPermission,
  startRecording,
  stopRecording,
  cleanup: cleanupMic,
} = useMicrophone()

// ─── PLAYBACK SYNC ──────────────────────────────────────────────────────────

const videoRef = ref<HTMLVideoElement | null>(null)

const {
  isPlaying,
  currentTimeMs,
  durationMs,
  loadMeTrack,
  loadVoiceTrack,
  clearVoiceTrack,
  play,
  pause,
  stop,
  seek,
  updateTime,
  updateDuration,
  onEnded,
} = usePlaybackSync(videoRef)

// ─── ACTIONS ────────────────────────────────────────────────────────────────

// Chargement de la scène
const loadScene = async () => {
  if (!currentScene.value) return

  // Load M&E track
  await loadMeTrack(currentScene.value.audioMeUrl)

  // Stop existing playback
  stop()
  clearVoiceTrack()
}

watch(selectedSceneId, () => {
  loadScene()
})

const togglePlay = () => {
  if (isPlaying.value) pause()
  else play()
}

const toggleRecording = () => {
  if (isRecording.value) {
    stopRecording()
  } else {
    // Seek to start and play
    seek(0)
    startRecording()
    play()
  }
}

// Load voice track into playback when recording is finished
watch(recordedBlob, async (blob) => {
  if (blob) {
    await loadVoiceTrack(blob)
  } else {
    clearVoiceTrack()
  }
})

// ─── UPLOAD ─────────────────────────────────────────────────────────────────

const uploadStatus = ref('')
const isUploading = ref(false)

const handleUpload = async () => {
  if (!recordedBlob.value) return

  isUploading.value = true
  uploadStatus.value = "Demande d'URL présignée..."

  try {
    const filename = `recording_${Date.now()}.${recordedBlob.value.type.includes('mp4') ? 'mp4' : 'webm'}`
    const { presignedUrl } = await $fetch('/api/recordings/upload', {
      method: 'POST',
      body: {
        filename,
        contentType: recordedBlob.value.type,
      },
    })

    uploadStatus.value = 'Upload en cours...'

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.onload = () =>
        xhr.status === 200 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`))
      xhr.onerror = () => reject(new Error('Network error'))
      xhr.open('PUT', presignedUrl)
      xhr.setRequestHeader('Content-Type', recordedBlob.value.type)
      xhr.send(recordedBlob.value!)
    })

    uploadStatus.value = '✅ Upload terminé !'
  } catch (e: unknown) {
    const err = e as Error
    uploadStatus.value = `❌ Erreur: ${err.message}`
  } finally {
    isUploading.value = false
  }
}

// ─── LIFECYCLE ──────────────────────────────────────────────────────────────

onUnmounted(() => {
  cleanupMic()
  stop()
})

const formatMs = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="poc-container">
    <div class="poc-header">
      <h1>PoC Multimédia 🎙️</h1>
      <p>Test d'enregistrement micro et synchronisation vidéo + piste M&E.</p>
    </div>

    <div v-if="publishedScenes.length === 0" class="alert error">
      Aucune scène publiée trouvée. Créez-en une dans le
      <NuxtLink to="/admin">Panel Admin</NuxtLink>.
    </div>

    <div v-else class="poc-grid">
      <!-- PANEL GAUCHE : SÉLECTION & LECTEUR -->
      <div class="panel">
        <h2>1. Scène</h2>
        <select v-model="selectedSceneId" class="scene-select">
          <option value="" disabled>-- Choisir une scène --</option>
          <option v-for="scene in publishedScenes" :key="scene.id" :value="scene.id">
            {{ scene.title }}
          </option>
        </select>

        <div v-if="currentScene" class="video-container">
          <video
            ref="videoRef"
            :src="currentScene.videoUrl"
            controlsList="nodownload"
            muted
            @timeupdate="updateTime"
            @loadedmetadata="updateDuration"
            @ended="onEnded"
          />

          <div class="video-controls">
            <button class="btn-icon" @click="togglePlay">
              {{ isPlaying ? '⏸' : '▶️' }}
            </button>
            <button class="btn-icon" @click="stop">⏹</button>
            <span class="time">{{ formatMs(currentTimeMs) }} / {{ formatMs(durationMs) }}</span>
          </div>
        </div>
      </div>

      <!-- PANEL DROITE : MICRO & ENREGISTREMENT -->
      <div class="panel">
        <h2>2. Microphone</h2>

        <div v-if="!hasPermission" class="mic-request">
          <p>L'accès au microphone est requis pour enregistrer.</p>
          <button class="btn-primary" @click="requestPermission">Autoriser le micro</button>
          <p v-if="micError" class="error">{{ micError }}</p>
        </div>

        <div v-else class="mic-ready">
          <div class="vu-meter">
            <div class="vu-meter-bar">
              <div
                class="vu-meter-fill"
                :style="{
                  width: `${audioLevel}%`,
                  backgroundColor: audioLevel > 80 ? '#f87171' : '#4ade80',
                }"
              />
            </div>
            <span>Niveau: {{ audioLevel }}%</span>
          </div>

          <div class="record-controls">
            <button
              class="btn-record"
              :class="{ recording: isRecording }"
              :disabled="!currentScene"
              @click="toggleRecording"
            >
              <span class="record-dot" />
              {{ isRecording ? "Arrêter l'enregistrement" : 'Enregistrer (Synchronisé)' }}
            </button>
          </div>
          <p class="hint">Lance la vidéo et enregistre en même temps.</p>
        </div>

        <!-- RÉSULTAT -->
        <div v-if="recordedBlob" class="result-panel">
          <h2>3. Résultat</h2>
          <p>Taille: {{ Math.round(recordedBlob.size / 1024) }} KB ({{ recordedBlob.type }})</p>

          <div class="review-controls">
            <button
              class="btn-primary"
              @click="
                () => {
                  seek(0)
                  play()
                }
              "
            >
              ▶️ Écouter le rendu (Vidéo + M&E + Voix)
            </button>
          </div>

          <div class="upload-controls">
            <button :disabled="isUploading" class="btn-secondary" @click="handleUpload">
              ☁️ Uploader vers S3/R2
            </button>
            <span v-if="uploadStatus" class="status-text">{{ uploadStatus }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.poc-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
  color: var(--text-main);
  font-family: 'Inter', sans-serif;
}

.poc-header {
  margin-bottom: 2rem;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 1rem;
}

.poc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.panel {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

h2 {
  font-size: 1.1rem;
  color: var(--theme-accent);
  margin-bottom: 0.5rem;
}

.scene-select {
  background: var(--bg-input);
  color: white;
  border: 1px solid var(--border-color);
  padding: 0.5rem;
  border-radius: 6px;
  width: 100%;
}

.video-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

video {
  width: 100%;
  border-radius: 8px;
  background: #000;
  aspect-ratio: 16/9;
}

.video-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-input);
  padding: 0.5rem;
  border-radius: 8px;
}

.btn-icon {
  background: var(--border-color);
  border: none;
  color: white;
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
}

.time {
  font-family: monospace;
  font-size: 0.85rem;
  margin-left: auto;
}

.btn-primary {
  background: var(--theme-accent);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}
.btn-primary:hover {
  background: #6d28d9;
}

.btn-secondary {
  background: var(--bg-hover);
  color: var(--theme-accent);
  border: 1px solid #3730a3;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.alert.error {
  background: #2d1515;
  border: 1px solid #7f1d1d;
  color: #f87171;
  padding: 1rem;
  border-radius: 8px;
}
.alert a {
  color: #fff;
  text-decoration: underline;
}

.mic-request {
  text-align: center;
  padding: 2rem 0;
}

.vu-meter {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}
.vu-meter-bar {
  flex: 1;
  height: 12px;
  background: var(--bg-input);
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}
.vu-meter-fill {
  height: 100%;
  transition:
    width 0.1s ease-out,
    background-color 0.2s;
}

.btn-record {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-hover);
  color: white;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}
.btn-record:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.record-dot {
  width: 12px;
  height: 12px;
  background: #ef4444;
  border-radius: 50%;
}
.btn-record.recording {
  border-color: #ef4444;
  background: #2d1515;
  color: #f87171;
}
.btn-record.recording .record-dot {
  animation: pulse 1s infinite;
}
@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.5;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.hint {
  font-size: 0.8rem;
  color: var(--text-muted);
  text-align: center;
  margin-top: -0.5rem;
}

.result-panel {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px dashed var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.upload-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.status-text {
  font-size: 0.85rem;
  color: #4ade80;
}
</style>
