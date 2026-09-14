<script setup lang="ts">
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const route = useRoute()
const sceneId = route.params.id as string

// ─── Données ──────────────────────────────────────────────────────────────────

const { data: scene, refresh } = await useFetch(`/api/admin/scenes/${sceneId}`)
useHead({ title: computed(() => `${scene.value?.title ?? 'Éditeur'} — Admin`) })

type Character = {
  id: string
  name: string
  color: string
  description?: string | null
  order: number
}
type Line = {
  id: string
  characterId: string
  text: string
  startMs: number
  endMs: number
  order: number
}

// ─── Section active ───────────────────────────────────────────────────────────
const activeTab = ref<'info' | 'characters' | 'lines'>('info')

// ─── Info scène ───────────────────────────────────────────────────────────────
const infoForm = reactive({
  title: scene.value?.title ?? '',
  description: scene.value?.description ?? '',
  thumbnailUrl: scene.value?.thumbnailUrl ?? '',
})
const savingInfo = ref(false)

const saveInfo = async () => {
  savingInfo.value = true
  try {
    await $fetch(`/api/admin/scenes/${sceneId}`, { method: 'PATCH', body: infoForm })
    await refresh()
  } finally {
    savingInfo.value = false
  }
}

// ─── Upload Miniature & Audio ───────────────────────────────────────────────────
const uploadState = reactive({
  thumbnail: { progress: 0, url: scene.value?.thumbnailUrl ?? '', uploading: false },
  audioMe: { progress: 0, url: scene.value?.audioMeUrl ?? '', uploading: false },
})

async function uploadFile(file: File, type: 'thumbnail' | 'audioMe', contentType: string) {
  const slot = uploadState[type]
  slot.uploading = true
  slot.progress = 0

  try {
    const apiType = type === 'audioMe' ? 'audio' : type
    const { presignedUrl, publicUrl } = await $fetch('/api/admin/upload/presign', {
      method: 'POST',
      body: { filename: file.name, contentType, type: apiType },
    })

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) slot.progress = Math.round((e.loaded / e.total) * 100)
      }
      xhr.onload = () =>
        xhr.status === 200 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`))
      xhr.onerror = () => reject(new Error('Upload network error'))
      xhr.open('PUT', presignedUrl)
      xhr.setRequestHeader('Content-Type', contentType)
      xhr.send(file)
    })

    slot.url = publicUrl
    slot.progress = 100
    if (type === 'thumbnail') infoForm.thumbnailUrl = publicUrl
    if (type === 'audioMe') {
      await $fetch(`/api/admin/scenes/${sceneId}`, {
        method: 'PATCH',
        body: { audioMeUrl: publicUrl },
      })
      await refresh()
    }
    if (type === 'thumbnail') await saveInfo()
  } finally {
    slot.uploading = false
  }
}

const onThumbnailChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  let type = file.type || 'image/jpeg'
  if (type === 'image/jpg') type = 'image/jpeg'

  try {
    await uploadFile(file, 'thumbnail', type)
  } catch (err: any) {
    alert(err.message || "Erreur lors de l'upload")
    console.error(err)
  }
}

const onAudioMeChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  let type = file.type || 'audio/wav'
  if (file.name.endsWith('.mp3')) type = 'audio/mpeg'

  try {
    await uploadFile(file, 'audioMe', type)
  } catch (err: any) {
    alert(err.message || "Erreur lors de l'upload")
    console.error(err)
  }
}

const togglePublish = async () => {
  await $fetch(`/api/admin/scenes/${sceneId}`, {
    method: 'PATCH',
    body: { isPublished: !scene.value?.isPublished },
  })
  await refresh()
}

// ─── Personnages ──────────────────────────────────────────────────────────────

const newChar = reactive({ name: '', color: 'var(--theme-accent)', description: '' })
const addingChar = ref(false)

const addCharacter = async () => {
  if (!newChar.name) return
  addingChar.value = true
  try {
    await $fetch(`/api/admin/scenes/${sceneId}/characters`, {
      method: 'POST',
      body: {
        name: newChar.name,
        color: newChar.color,
        description: newChar.description || undefined,
      },
    })
    newChar.name = ''
    newChar.description = ''
    await refresh()
  } finally {
    addingChar.value = false
  }
}

const deleteCharacter = async (charId: string, name: string) => {
  if (!confirm(`Supprimer le personnage "${name}" ?`)) return
  try {
    await $fetch(`/api/admin/scenes/${sceneId}/characters/${charId}`, { method: 'DELETE' })
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    alert(err.data?.message ?? 'Erreur.')
  }
}

// ─── Éditeur de répliques (Timeline) ──────────────────────────────────────────

const videoRef = ref<HTMLVideoElement | null>(null)
const waveformContainerRef = ref<HTMLElement | null>(null)
let wavesurfer: WaveSurfer | null = null
let wsRegions: ReturnType<typeof RegionsPlugin.create> | null = null

const currentSecMs = ref(0)
const isPlaying = ref(false)
const selectedLineId = ref<string | null>(null)
const zoomLevel = ref(100)
const isRegionDragging = ref(false)

let regionUpdateTimer: ReturnType<typeof setTimeout> | null = null

const regionToLine = new Map<string, string>()
const lineToRegion = new Map<string, string>()

// Detect overlapping lines
const overlappingLines = computed(() => {
  const lines = (scene.value?.lines as Line[]) ?? []
  const overlaps = new Set<string>()
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[i].startMs < lines[j].endMs && lines[j].startMs < lines[i].endMs) {
        overlaps.add(lines[i].id)
        overlaps.add(lines[j].id)
      }
    }
  }
  return overlaps
})

// Build regions from lines
function syncRegionsToLines() {
  if (!wsRegions) return
  wsRegions.clearRegions()
  regionToLine.clear()
  lineToRegion.clear()

  const lines = (scene.value?.lines as Line[]) ?? []
  const chars = (scene.value?.characters as Character[]) ?? []

  for (const line of lines) {
    const char = chars.find((c) => c.id === line.characterId)
    const color = char?.color ?? '#94a3b8'

    const r = parseInt(color.slice(1, 3), 16) || 148
    const g = parseInt(color.slice(3, 5), 16) || 163
    const b = parseInt(color.slice(5, 7), 16) || 184

    const region = wsRegions.addRegion({
      start: line.startMs / 1000,
      end: line.endMs / 1000,
      color: `rgba(${r}, ${g}, ${b}, 0.25)`,
      drag: true,
      resize: true,
      content: char?.name ?? '?',
    })

    regionToLine.set(region.id, line.id)
    lineToRegion.set(line.id, region.id)
  }
}

// Init WaveSurfer
watch(
  [videoRef, waveformContainerRef],
  async ([videoEl, containerEl]) => {
    if (videoEl && containerEl && scene.value?.videoUrl && !wavesurfer) {
      wsRegions = RegionsPlugin.create()

      wavesurfer = WaveSurfer.create({
        container: containerEl,
        waveColor: '#4c1d95',
        progressColor: '#8b5cf6',
        cursorColor: '#c4b5fd',
        height: 140,
        normalize: true,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        minPxPerSec: zoomLevel.value,
        autoScroll: true,
        media: videoEl,
        plugins: [wsRegions],
      })

      try {
        await wavesurfer.load(scene.value.videoUrl)
      } catch (err) {
        console.warn('Impossible de dessiner les pics audio (CORS probable).', err)
      }

      wavesurfer.on('ready', () => {
        syncRegionsToLines()
      })

      wsRegions.on('region-clicked', (region, e) => {
        e.stopPropagation()
        const lineId = regionToLine.get(region.id)
        if (lineId) {
          selectedLineId.value = lineId
          scrollToLine(lineId)
        }
      })

      wsRegions.on('region-updated', (region) => {
        isRegionDragging.value = true
        const lineId = regionToLine.get(region.id)
        if (!lineId) return

        if (regionUpdateTimer) clearTimeout(regionUpdateTimer)
        regionUpdateTimer = setTimeout(async () => {
          const newStartMs = Math.round(region.start * 1000)
          const newEndMs = Math.round(region.end * 1000)

          try {
            await $fetch(`/api/admin/scenes/${sceneId}/lines/${lineId}`, {
              method: 'PATCH',
              body: { startMs: newStartMs, endMs: newEndMs },
            })
            await refresh()
          } catch (err) {
            console.error('Failed to update line from region drag:', err)
          }
          isRegionDragging.value = false
        }, 500)
      })
    }
  },
  { immediate: true }
)

watch(zoomLevel, (val) => {
  if (wavesurfer) {
    wavesurfer.zoom(val)
  }
})

watch(
  () => scene.value?.lines,
  () => {
    if (!isRegionDragging.value) {
      syncRegionsToLines()
    }
  },
  { deep: true }
)

onUnmounted(() => {
  if (wavesurfer) {
    wavesurfer.destroy()
    wavesurfer = null
    wsRegions = null
  }
})

// ─── Timeline controls ───────────────────────────────────────────────────────

let linePlayTimer: ReturnType<typeof setTimeout> | null = null

const playLine = (line: Line) => {
  if (!videoRef.value) return
  selectedLineId.value = line.id

  videoRef.value.currentTime = line.startMs / 1000
  videoRef.value.play()

  if (wavesurfer) {
    const duration = wavesurfer.getDuration()
    if (duration > 0) {
      wavesurfer.seekTo(line.startMs / 1000 / duration)
    }
  }

  if (linePlayTimer) clearTimeout(linePlayTimer)
  const dur = line.endMs - line.startMs
  linePlayTimer = setTimeout(() => {
    if (videoRef.value) videoRef.value.pause()
  }, dur)
}

const selectLine = (line: Line) => {
  selectedLineId.value = line.id
  if (videoRef.value) {
    videoRef.value.currentTime = line.startMs / 1000
  }
  if (wavesurfer) {
    const duration = wavesurfer.getDuration()
    if (duration > 0) {
      wavesurfer.seekTo(line.startMs / 1000 / duration)
    }
  }
}

const scrollToLine = (lineId: string) => {
  const el = document.getElementById(`line-${lineId}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

// ─── Keyboard shortcuts ──────────────────────────────────────────────────────

const handleKeydown = (e: KeyboardEvent) => {
  if (activeTab.value !== 'lines') return
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

  const lines = (scene.value?.lines as Line[]) ?? []

  switch (e.code) {
    case 'Space': {
      e.preventDefault()
      if (videoRef.value) {
        if (videoRef.value.paused) videoRef.value.play()
        else videoRef.value.pause()
      }
      break
    }
    case 'ArrowLeft': {
      e.preventDefault()
      if (videoRef.value) {
        if (e.shiftKey) {
          const currentIdx = lines.findIndex((l) => l.id === selectedLineId.value)
          if (currentIdx > 0) {
            selectLine(lines[currentIdx - 1])
            scrollToLine(lines[currentIdx - 1].id)
          }
        } else {
          videoRef.value.currentTime = Math.max(0, videoRef.value.currentTime - 1)
        }
      }
      break
    }
    case 'ArrowRight': {
      e.preventDefault()
      if (videoRef.value) {
        if (e.shiftKey) {
          const currentIdx = lines.findIndex((l) => l.id === selectedLineId.value)
          if (currentIdx < lines.length - 1) {
            selectLine(lines[currentIdx + 1])
            scrollToLine(lines[currentIdx + 1].id)
          }
        } else {
          videoRef.value.currentTime += 1
        }
      }
      break
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

// ─── Line CRUD ────────────────────────────────────────────────────────────────

const newLine = reactive({ characterId: '', text: '', startMs: 0, endMs: 0 })
const addingLine = ref(false)
const lineError = ref('')

const markStart = () => {
  if (videoRef.value) {
    currentSecMs.value = Math.round(videoRef.value.currentTime * 1000)
  }
  newLine.startMs = currentSecMs.value
}
const markEnd = () => {
  if (videoRef.value) {
    currentSecMs.value = Math.round(videoRef.value.currentTime * 1000)
  }
  newLine.endMs = currentSecMs.value
}

const formatMs = (ms: number) => {
  const s = Math.floor(ms / 1000)
  const remaining = ms % 1000
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}.${Math.floor(remaining / 100)}`
}

const addLine = async () => {
  lineError.value = ''
  if (!newLine.characterId) {
    lineError.value = 'Choisissez un personnage.'
    return
  }
  if (!newLine.text) {
    lineError.value = 'Entrez le texte de la réplique.'
    return
  }
  if (newLine.endMs <= newLine.startMs) {
    lineError.value = 'La fin doit être après le début.'
    return
  }

  addingLine.value = true
  try {
    await $fetch(`/api/admin/scenes/${sceneId}/lines`, {
      method: 'POST',
      body: { ...newLine },
    })
    newLine.text = ''
    newLine.startMs = 0
    newLine.endMs = 0
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    lineError.value = err.data?.message ?? 'Erreur.'
  } finally {
    addingLine.value = false
  }
}

const deleteLine = async (lineId: string) => {
  await $fetch(`/api/admin/scenes/${sceneId}/lines/${lineId}`, { method: 'DELETE' })
  if (selectedLineId.value === lineId) selectedLineId.value = null
  await refresh()
}

// ─── Édition de réplique ─────────────────────────────────────────────────────

const editingLineId = ref<string | null>(null)
const editLineForm = reactive({
  characterId: '',
  text: '',
  startMs: 0,
  endMs: 0,
})
const savingLine = ref(false)

const startEditLine = (line: Line) => {
  editingLineId.value = line.id
  editLineForm.characterId = line.characterId
  editLineForm.text = line.text
  editLineForm.startMs = line.startMs
  editLineForm.endMs = line.endMs
}

const cancelEditLine = () => {
  editingLineId.value = null
  lineError.value = ''
}

const saveEditLine = async () => {
  lineError.value = ''
  if (!editingLineId.value) return
  if (!editLineForm.characterId) {
    lineError.value = 'Choisissez un personnage.'
    return
  }
  if (!editLineForm.text) {
    lineError.value = 'Entrez le texte de la réplique.'
    return
  }
  if (editLineForm.endMs <= editLineForm.startMs) {
    lineError.value = 'La fin doit être après le début.'
    return
  }

  savingLine.value = true
  try {
    await $fetch(`/api/admin/scenes/${sceneId}/lines/${editingLineId.value}`, {
      method: 'PATCH',
      body: { ...editLineForm },
    })
    editingLineId.value = null
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    lineError.value = err.data?.message ?? 'Erreur lors de la modification.'
  } finally {
    savingLine.value = false
  }
}

// Export JSON des répliques
const exportLines = () => {
  const exportData = {
    version: 1,
    characters: scene.value?.characters ?? [],
    lines: scene.value?.lines ?? [],
  }
  const data = JSON.stringify(exportData, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${scene.value?.title ?? 'scene'}-lines.json`
  a.click()
  URL.revokeObjectURL(url)
}

// Import JSON des répliques
const importLines = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const parsed = JSON.parse(text)

    let linesToImport = []

    if (Array.isArray(parsed)) {
      linesToImport = parsed
      alert(
        "⚠️ Vous utilisez un ancien fichier d'export (sans noms de personnages). Assurez-vous que les IDs correspondent !"
      )
    } else if (parsed.version === 1 && Array.isArray(parsed.lines)) {
      const importedChars = parsed.characters || []
      const localChars = (scene.value?.characters as any[]) || []

      const missingChars = new Set<string>()

      linesToImport = parsed.lines.map((line: any) => {
        const importedChar = importedChars.find((c: any) => c.id === line.characterId)
        const charName = importedChar?.name

        if (charName) {
          const localMatch = localChars.find(
            (c: any) => c.name.toLowerCase() === charName.toLowerCase()
          )
          if (localMatch) {
            return { ...line, characterId: localMatch.id }
          } else {
            missingChars.add(charName)
          }
        }
        return line
      })

      if (missingChars.size > 0) {
        alert(
          `❌ Les personnages suivants manquent dans cette scène : ${Array.from(missingChars).join(', ')}.\n\nVeuillez les créer d'abord (avec les mêmes noms) avant d'importer !`
        )
        return
      }
    }

    if (
      !confirm(
        `Importer ${linesToImport.length} répliques ? Cela remplacera toutes les répliques actuelles.`
      )
    )
      return

    await $fetch(`/api/admin/scenes/${sceneId}/lines`, {
      method: 'PUT',
      body: { lines: linesToImport },
    })
    await refresh()
  } catch (err: any) {
    alert("Erreur lors de l'import: " + (err.data?.message || err.message))
  } finally {
    ;(e.target as HTMLInputElement).value = ''
  }
}

// Couleur du personnage par id
const charColor = (charId: string) =>
  ((scene.value?.characters as Character[]) ?? []).find((c) => c.id === charId)?.color ??
  'var(--text-main)'
const charName = (charId: string) =>
  ((scene.value?.characters as Character[]) ?? []).find((c) => c.id === charId)?.name ?? '?'

// Ligne active pendant la lecture
const activeLine = computed(() =>
  ((scene.value?.lines as Line[]) ?? []).find(
    (l) => currentSecMs.value >= l.startMs && currentSecMs.value <= l.endMs
  )
)

// Sync isPlaying et timecode réactif
const onTimeUpdate = () => {
  if (videoRef.value) {
    isPlaying.value = !videoRef.value.paused
    currentSecMs.value = Math.round(videoRef.value.currentTime * 1000)
  }
}
</script>

<template>
  <div v-if="scene" class="editor-page">
    <!-- En-tête -->
    <div class="editor-header">
      <NuxtLink to="/admin/scenes" class="back-link">← Scènes</NuxtLink>
      <div class="header-right">
        <span class="status-badge" :class="scene.isPublished ? 'published' : 'draft'">
          {{ scene.isPublished ? '✅ Publié' : '📝 Brouillon' }}
        </span>
        <button class="btn-toggle" @click="togglePublish">
          {{ scene.isPublished ? 'Dépublier' : 'Publier' }}
        </button>
      </div>
    </div>

    <h1 class="editor-title">{{ scene.title }}</h1>

    <!-- Onglets -->
    <div class="tabs">
      <button
        v-for="tab in ['info', 'characters', 'lines'] as const"
        :key="tab"
        class="tab"
        :class="{ active: activeTab === tab }"
        @click="activeTab = tab"
      >
        {{ { info: '📋 Informations', characters: '🎭 Personnages', lines: '📝 Répliques' }[tab] }}
        <span v-if="tab === 'characters'" class="tab-count">{{ scene.characters?.length }}</span>
        <span v-if="tab === 'lines'" class="tab-count">{{ scene.lines?.length }}</span>
      </button>
    </div>

    <!-- Tab : Informations -->
    <div v-if="activeTab === 'info'" class="tab-content">
      <div class="card">
        <div class="form-group">
          <label>Titre</label>
          <input v-model="infoForm.title" type="text" />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea v-model="infoForm.description" rows="3" />
        </div>

        <div class="form-group">
          <label>Miniature</label>
          <div class="upload-zone" :class="{ uploaded: uploadState.thumbnail.url }">
            <input
              id="thumb-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              :disabled="uploadState.thumbnail.uploading"
              @change="onThumbnailChange"
            />
            <label for="thumb-input" class="upload-label">
              <span v-if="uploadState.thumbnail.url">✅ Image uploadée</span>
              <span v-else-if="uploadState.thumbnail.uploading"
                >Upload... {{ uploadState.thumbnail.progress }}%</span
              >
              <span v-else>🖼️ Changer d'image (JPG, PNG, WebP)</span>
            </label>
            <div v-if="uploadState.thumbnail.uploading" class="progress-bar">
              <div class="progress-fill" :style="{ width: `${uploadState.thumbnail.progress}%` }" />
            </div>
            <img
              v-if="uploadState.thumbnail.url"
              :src="uploadState.thumbnail.url"
              class="thumbnail-preview"
            />
          </div>
        </div>

        <div class="form-group">
          <label>Piste M&E (Musique & Effets sans voix)</label>
          <div class="upload-zone" :class="{ uploaded: uploadState.audioMe.url }">
            <input
              id="audio-me-input"
              type="file"
              accept="audio/mpeg,audio/wav"
              :disabled="uploadState.audioMe.uploading"
              @change="onAudioMeChange"
            />
            <label for="audio-me-input" class="upload-label">
              <span v-if="uploadState.audioMe.url">✅ Piste audio M&E uploadée</span>
              <span v-else-if="uploadState.audioMe.uploading"
                >Upload... {{ uploadState.audioMe.progress }}%</span
              >
              <span v-else>🎵 Uploader la piste M&E (.mp3, .wav) générée localement</span>
            </label>
            <div v-if="uploadState.audioMe.uploading" class="progress-bar">
              <div class="progress-fill" :style="{ width: `${uploadState.audioMe.progress}%` }" />
            </div>
            <audio
              v-if="uploadState.audioMe.url"
              :src="uploadState.audioMe.url"
              controls
              class="audio-preview"
            />
          </div>
        </div>

        <button class="btn-primary" :disabled="savingInfo" @click="saveInfo">
          {{ savingInfo ? 'Sauvegarde...' : 'Sauvegarder' }}
        </button>
      </div>
    </div>

    <!-- Tab : Personnages -->
    <div v-if="activeTab === 'characters'" class="tab-content">
      <div class="card">
        <h3 class="section-title">Ajouter un personnage</h3>
        <div class="char-form">
          <input
            v-model="newChar.name"
            type="text"
            placeholder="Nom du personnage"
            class="char-name-input"
          />
          <div class="color-field">
            <label>Couleur</label>
            <input v-model="newChar.color" type="color" class="color-picker" />
          </div>
          <input
            v-model="newChar.description"
            type="text"
            placeholder="Description (optionnel)"
            class="char-desc-input"
          />
          <button class="btn-primary" :disabled="addingChar || !newChar.name" @click="addCharacter">
            {{ addingChar ? '...' : '+ Ajouter' }}
          </button>
        </div>
      </div>

      <div v-if="(scene.characters as Character[]).length === 0" class="empty-state">
        Aucun personnage. Ajoutez-en un pour commencer.
      </div>

      <div v-else class="chars-list">
        <div v-for="char in scene.characters as Character[]" :key="char.id" class="char-row">
          <div class="char-color-dot" :style="{ background: char.color }" />
          <div class="char-info">
            <p class="char-name">{{ char.name }}</p>
            <p v-if="char.description" class="char-desc">{{ char.description }}</p>
          </div>
          <button class="btn-danger-sm" @click="deleteCharacter(char.id, char.name)">
            Supprimer
          </button>
        </div>
      </div>
    </div>

    <!-- Tab : Répliques (éditeur timeline) -->
    <div v-if="activeTab === 'lines'" class="tab-content lines-layout">
      <!-- Shortcuts bar -->
      <div class="shortcuts-bar">
        <span class="shortcut-item">⏯ <kbd>Espace</kbd></span>
        <span class="shortcut-item">◀ <kbd>←</kbd> 1s</span>
        <span class="shortcut-item">▶ <kbd>→</kbd> 1s</span>
        <span class="shortcut-item">⏮ <kbd>Shift+←</kbd> Répl. préc.</span>
        <span class="shortcut-item">⏭ <kbd>Shift+→</kbd> Répl. suiv.</span>
      </div>

      <!-- Vidéo + Ajouter réplique -->
      <div class="lines-top-split">
        <div class="video-wrapper">
          <video
            ref="videoRef"
            :src="scene.videoUrl"
            class="video-player"
            controls
            @timeupdate="onTimeUpdate"
          />
          <div class="timecode-display">
            ⏱ {{ formatMs(currentSecMs) }}
            <span
              v-if="activeLine"
              class="active-line-preview"
              :style="{ color: charColor(activeLine.characterId) }"
            >
              ● {{ charName(activeLine.characterId) }}
            </span>
          </div>
        </div>

        <div class="add-line-form card">
          <h3 class="section-title">Nouvelle réplique</h3>
          <select v-model="newLine.characterId" class="char-select">
            <option value="">— Personnage —</option>
            <option v-for="c in scene.characters as Character[]" :key="c.id" :value="c.id">
              {{ c.name }}
            </option>
          </select>
          <textarea
            v-model="newLine.text"
            rows="2"
            placeholder="Texte de la réplique..."
            class="line-text-input"
          />
          <div class="timecode-row">
            <div class="tc-field">
              <span class="tc-label">Début</span>
              <span class="tc-value">{{ formatMs(newLine.startMs) }}</span>
              <button class="btn-mark" @click="markStart">📍 Marquer</button>
            </div>
            <div class="tc-field">
              <span class="tc-label">Fin</span>
              <span class="tc-value">{{ formatMs(newLine.endMs) }}</span>
              <button class="btn-mark" @click="markEnd">📍 Marquer</button>
            </div>
          </div>
          <p v-if="lineError" class="form-error">{{ lineError }}</p>
          <button class="btn-primary w-full" :disabled="addingLine" @click="addLine">
            {{ addingLine ? '...' : '+ Ajouter la réplique' }}
          </button>
        </div>
      </div>

      <!-- Waveform + Zoom -->
      <div class="waveform-section">
        <div class="waveform-toolbar">
          <span class="zoom-label">🔍 Zoom</span>
          <input
            v-model.number="zoomLevel"
            type="range"
            min="20"
            max="500"
            step="10"
            class="zoom-slider"
          />
          <span class="zoom-value">{{ zoomLevel }}px/s</span>
        </div>
        <div class="waveform-full-wrapper">
          <div ref="waveformContainerRef" class="waveform-container" />
        </div>
        <p class="waveform-hint">
          Glissez et redimensionnez les régions colorées pour ajuster les timecodes directement sur
          la timeline.
        </p>
      </div>

      <!-- Liste des répliques -->
      <div class="lines-panel card">
        <div class="lines-header">
          <h3 class="section-title">Répliques ({{ (scene.lines as Line[]).length }})</h3>
          <div class="lines-actions">
            <button class="btn-sm-ghost" @click="exportLines">⬇ Export JSON</button>
            <label class="btn-sm-ghost" style="cursor: pointer">
              ⬆ Import JSON
              <input type="file" accept=".json" style="display: none" @change="importLines" />
            </label>
          </div>
        </div>

        <div v-if="overlappingLines.size > 0" class="overlap-warning">
          ⚠️ {{ overlappingLines.size }} réplique(s) se chevauchent ! Elles sont indiquées en rouge.
        </div>

        <div v-if="(scene.lines as Line[]).length === 0" class="empty-state">
          Aucune réplique. Utilisez le lecteur vidéo pour en ajouter.
        </div>

        <div v-else class="lines-list">
          <div
            v-for="line in scene.lines as Line[]"
            :id="`line-${line.id}`"
            :key="line.id"
            class="line-row"
            :class="{
              'is-active': activeLine?.id === line.id,
              'is-selected': selectedLineId === line.id,
              'is-overlapping': overlappingLines.has(line.id),
            }"
            @click="selectLine(line)"
          >
            <!-- Vue Edition -->
            <div v-if="editingLineId === line.id" class="line-edit-form" @click.stop>
              <select v-model="editLineForm.characterId" class="char-select">
                <option v-for="c in scene.characters as Character[]" :key="c.id" :value="c.id">
                  {{ c.name }}
                </option>
              </select>
              <textarea v-model="editLineForm.text" rows="2" class="line-text-input" />
              <div class="timecode-row">
                <div class="tc-field">
                  <span class="tc-label">Début (ms)</span>
                  <input v-model.number="editLineForm.startMs" type="number" class="tc-input" />
                </div>
                <div class="tc-field">
                  <span class="tc-label">Fin (ms)</span>
                  <input v-model.number="editLineForm.endMs" type="number" class="tc-input" />
                </div>
              </div>
              <div class="edit-actions">
                <button class="btn-ghost" @click="cancelEditLine">Annuler</button>
                <button class="btn-primary" :disabled="savingLine" @click="saveEditLine">
                  {{ savingLine ? '...' : 'Sauvegarder' }}
                </button>
              </div>
            </div>

            <!-- Vue Lecture -->
            <template v-else>
              <div class="line-char-dot" :style="{ background: charColor(line.characterId) }" />
              <div class="line-content">
                <p class="line-char-name" :style="{ color: charColor(line.characterId) }">
                  {{ charName(line.characterId) }}
                </p>
                <p class="line-text-display">{{ line.text }}</p>
                <p class="line-times">{{ formatMs(line.startMs) }} → {{ formatMs(line.endMs) }}</p>
              </div>
              <div class="line-actions">
                <button class="btn-play" title="Jouer cette réplique" @click.stop="playLine(line)">
                  ▶
                </button>
                <button class="btn-edit" @click.stop="startEditLine(line)">Éditer</button>
                <button class="btn-del" @click.stop="deleteLine(line.id)">✕</button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-page {
  max-width: 1100px;
}
.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}
.back-link {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.875rem;
}
.back-link:hover {
  color: var(--theme-accent);
}
.header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.status-badge {
  font-size: 0.75rem;
  padding: 4px 12px;
  border-radius: 20px;
  font-weight: 600;
}
.status-badge.published {
  background: rgba(16, 185, 129, 0.1);
  color: #34d399;
}
.status-badge.draft {
  background: var(--bg-hover);
  color: var(--theme-accent);
}
.btn-toggle {
  background: var(--bg-hover);
  color: #94a3b8;
  border: 1px solid var(--border-color);
  padding: 5px 14px;
  border-radius: 7px;
  font-size: 0.8rem;
  cursor: pointer;
}
.btn-toggle:hover {
  border-color: var(--theme-accent);
  color: var(--theme-accent);
}
.editor-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 1.5rem;
}

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}
.tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0.6rem 1rem;
  font-size: 0.875rem;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.15s;
}
.tab:hover {
  color: var(--text-main);
}
.tab.active {
  color: var(--theme-accent);
  border-bottom-color: var(--theme-accent);
}
.tab-count {
  background: var(--border-color);
  color: #94a3b8;
  font-size: 0.7rem;
  padding: 1px 7px;
  border-radius: 10px;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
}
.section-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 1rem;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1rem;
}
label {
  font-size: 0.85rem;
  color: #94a3b8;
}
input[type='text'],
textarea,
select {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-main);
  padding: 0.6rem 0.875rem;
  font-size: 0.875rem;
  outline: none;
  font-family: inherit;
  transition: border-color 0.15s;
  resize: vertical;
  width: 100%;
  box-sizing: border-box;
}
.audio-preview {
  margin-top: 10px;
  width: 100%;
  height: 36px;
}
input:focus,
textarea:focus,
select:focus {
  border-color: var(--theme-accent);
}

.upload-zone {
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
  position: relative;
  transition: all 0.2s;
  background: var(--bg-input);
}
.upload-zone:hover {
  border-color: var(--text-muted);
  background: var(--bg-hover);
}
.upload-zone.uploaded {
  border-style: solid;
}
.upload-zone input[type='file'] {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
}
.upload-label {
  font-size: 0.9rem;
  color: #94a3b8;
  cursor: pointer;
  pointer-events: none;
}
.progress-bar {
  background: var(--bg-hover);
  border-radius: 4px;
  height: 6px;
  margin-top: 0.75rem;
  overflow: hidden;
}
.progress-fill {
  background: var(--theme-accent);
  height: 100%;
  border-radius: 4px;
  transition: width 0.2s;
}
.thumbnail-preview {
  margin-top: 1rem;
  max-width: 100%;
  max-height: 200px;
  border-radius: 8px;
  object-fit: cover;
  display: block;
}

.char-form {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto;
  gap: 0.75rem;
  align-items: end;
}

/* ─── Lines Tab ────────────────────────────────────────────────────────────── */

.lines-layout {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.shortcuts-bar {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background: rgba(139, 92, 246, 0.08);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 10px;
  font-size: 0.75rem;
  color: var(--text-muted);
  flex-wrap: wrap;
}
.shortcut-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
kbd {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 0.7rem;
  font-family: monospace;
  color: var(--text-main);
}

.lines-top-split {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 1.5rem;
  align-items: start;
}

.video-wrapper {
  position: relative;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
}
.video-player {
  width: 100%;
  aspect-ratio: 16/9;
  display: block;
}

.waveform-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.waveform-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
}
.zoom-label {
  font-size: 0.8rem;
  color: var(--text-muted);
}
.zoom-slider {
  flex: 1;
  max-width: 200px;
  accent-color: var(--theme-accent);
  height: 4px;
}
.zoom-value {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: monospace;
  min-width: 60px;
}

.waveform-full-wrapper {
  width: 100%;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
  padding: 1rem 0;
}
.waveform-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-style: italic;
  text-align: center;
}

.timecode-display {
  position: absolute;
  top: 1rem;
  left: 1rem;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 0.5rem 0.875rem;
  font-size: 0.875rem;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 1rem;
}
.color-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  align-items: center;
}
.color-picker {
  width: 40px;
  height: 36px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: none;
  cursor: pointer;
  padding: 2px;
}
.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.chars-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.char-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 0.875rem 1rem;
}
.char-color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
}
.char-info {
  flex: 1;
}
.char-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-main);
}
.char-desc {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 2px;
}

.add-line-form {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.char-select,
.line-text-input {
  width: 100%;
}
.timecode-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
.tc-field {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0.6rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tc-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
}
.tc-value {
  font-size: 0.9rem;
  font-family: monospace;
  color: var(--text-main);
}
.btn-mark {
  background: var(--bg-hover);
  border: 1px solid #3730a3;
  color: var(--theme-accent);
  padding: 3px 8px;
  border-radius: 5px;
  font-size: 0.7rem;
  cursor: pointer;
  margin-top: 2px;
}
.btn-mark:hover {
  background: #2d1f5e;
}

.lines-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.lines-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.lines-actions {
  display: flex;
  gap: 0.5rem;
}

.overlap-warning {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  font-size: 0.8rem;
  color: #f87171;
}

.lines-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 70vh;
  overflow-y: auto;
}
.line-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 0.875rem;
  transition: all 0.15s;
  cursor: pointer;
  position: relative;
}
.line-row:hover {
  background: var(--bg-hover);
}
.line-row.is-active {
  border-color: var(--theme-accent);
  background: var(--bg-hover);
}
.line-row.is-selected {
  border-color: #c4b5fd;
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
}
.line-row.is-overlapping {
  border-color: #ef4444 !important;
  background: rgba(239, 68, 68, 0.05);
}
.line-char-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: 4px;
  flex-shrink: 0;
}
.line-content {
  flex: 1;
}
.line-char-name {
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: 3px;
}
.line-text-display {
  font-size: 0.9rem;
  color: var(--text-main);
  line-height: 1.4;
  margin-bottom: 4px;
}
.line-times {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.line-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.btn-play {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #34d399;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.15s;
}
.btn-play:hover {
  background: rgba(16, 185, 129, 0.2);
  border-color: #34d399;
}
.btn-edit {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  width: auto;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-edit:hover {
  border-color: var(--text-main);
  color: var(--text-main);
}
.btn-del {
  background: transparent;
  border: none;
  color: #ef4444;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-del:hover {
  background: rgba(239, 68, 68, 0.1);
}

.line-edit-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}
.tc-input {
  background: var(--bg-main);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-main);
  padding: 0.4rem 0.5rem;
  width: 100%;
  font-size: 0.85rem;
  font-family: inherit;
  outline: none;
}
.tc-input:focus {
  border-color: var(--theme-accent);
}
.edit-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.btn-primary {
  background: var(--theme-accent);
  color: var(--text-main);
  padding: 0.6rem 1.25rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
}
.btn-primary:hover:not(:disabled) {
  background: #6d28d9;
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-primary.w-full {
  width: 100%;
}
.btn-ghost {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
}
.btn-ghost:hover {
  border-color: var(--text-main);
  color: var(--text-main);
}
.btn-danger-sm {
  background: #1c1010;
  color: #f87171;
  border: 1px solid #7f1d1d;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
}
.btn-danger-sm:hover {
  background: #2d1515;
}
.btn-sm-ghost {
  background: var(--bg-hover);
  color: #94a3b8;
  border: 1px solid var(--border-color);
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
}
.btn-sm-ghost:hover {
  border-color: var(--text-muted);
  color: var(--text-main);
}
.form-error {
  color: #f87171;
  font-size: 0.8rem;
}
</style>
