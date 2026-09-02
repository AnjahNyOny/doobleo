<script setup lang="ts">
import WaveSurfer from 'wavesurfer.js'

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

const togglePublish = async () => {
  await $fetch(`/api/admin/scenes/${sceneId}`, {
    method: 'PATCH',
    body: { isPublished: !scene.value?.isPublished },
  })
  await refresh()
}

// ─── Personnages ──────────────────────────────────────────────────────────────

const newChar = reactive({ name: '', color: '#7c3aed', description: '' })
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

// ─── Éditeur de répliques (timecodes) ─────────────────────────────────────────

const videoRef = ref<HTMLVideoElement | null>(null)
const waveformContainerRef = ref<HTMLElement | null>(null)
let wavesurfer: WaveSurfer | null = null

const currentSecMs = ref(0)
const isPlaying = ref(false)

// Init WaveSurfer when elements are ready
watch(
  [videoRef, waveformContainerRef],
  async ([videoEl, containerEl]) => {
    if (videoEl && containerEl && scene.value?.videoUrl && !wavesurfer) {
      wavesurfer = WaveSurfer.create({
        container: containerEl,
        waveColor: '#4c1d95',
        progressColor: '#8b5cf6',
        cursorColor: '#c4b5fd',
        height: 120, // Plus grand verticalement pour mieux voir
        normalize: true,
        barWidth: 2, // Barres plus fines pour plus de détails
        barGap: 1, // Moins d'espace
        barRadius: 2,
        minPxPerSec: 100, // 100 pixels par seconde : TRES détaillé (ajoute un scroll horizontal)
        autoScroll: true, // Suit automatiquement la lecture
        media: videoEl, // Synchronise avec la vidéo
      })

      // On charge l'URL explicitement via notre proxy local pour éviter les erreurs CORS de Cloudflare R2
      try {
        await wavesurfer.load(scene.value.videoUrl)
      } catch (err) {
        console.warn('Impossible de dessiner les pics audio (CORS probable).', err)
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
})

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
  await refresh()
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
  ((scene.value?.characters as Character[]) ?? []).find((c) => c.id === charId)?.color ?? '#fff'
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

    <!-- Tab : Répliques (éditeur timecodes) -->
    <div v-if="activeTab === 'lines'" class="tab-content">
      <div class="lines-editor">
        <!-- Lecteur vidéo -->
        <div class="video-panel">
          <video
            ref="videoRef"
            :src="scene.videoUrl"
            class="video-player"
            controls
            @timeupdate="onTimeUpdate"
          />
          <!-- Container pour la forme d'onde -->
          <div ref="waveformContainerRef" class="waveform-container" />

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

          <!-- Ajouter une réplique -->
          <div class="add-line-form">
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
              class="line-text"
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

        <!-- Liste des répliques -->
        <div class="lines-panel">
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

          <div v-if="(scene.lines as Line[]).length === 0" class="empty-state">
            Aucune réplique. Utilisez le lecteur vidéo pour en ajouter.
          </div>

          <div v-else class="lines-list">
            <div
              v-for="line in scene.lines as Line[]"
              :key="line.id"
              class="line-row"
              :class="{ 'is-active': activeLine?.id === line.id }"
            >
              <div class="line-char-dot" :style="{ background: charColor(line.characterId) }" />
              <div class="line-content">
                <p class="line-char-name" :style="{ color: charColor(line.characterId) }">
                  {{ charName(line.characterId) }}
                </p>
                <p class="line-text">{{ line.text }}</p>
                <p class="line-times">{{ formatMs(line.startMs) }} → {{ formatMs(line.endMs) }}</p>
              </div>
              <button class="btn-del" @click="deleteLine(line.id)">✕</button>
            </div>
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
  color: #64748b;
  text-decoration: none;
  font-size: 0.875rem;
}
.back-link:hover {
  color: #a78bfa;
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
  background: #14532d;
  color: #4ade80;
}
.status-badge.draft {
  background: #1e1b4b;
  color: #818cf8;
}
.btn-toggle {
  background: #1e1e2e;
  color: #94a3b8;
  border: 1px solid #2d2d3a;
  padding: 5px 14px;
  border-radius: 7px;
  font-size: 0.8rem;
  cursor: pointer;
}
.btn-toggle:hover {
  border-color: #a78bfa;
  color: #a78bfa;
}
.editor-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 1.5rem;
}

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid #2d2d3a;
}
.tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0.6rem 1rem;
  font-size: 0.875rem;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.15s;
}
.tab:hover {
  color: #e2e8f0;
}
.tab.active {
  color: #a78bfa;
  border-bottom-color: #a78bfa;
}
.tab-count {
  background: #2d2d3a;
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
  background: #16161d;
  border: 1px solid #2d2d3a;
  border-radius: 12px;
  padding: 1.5rem;
}
.section-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #e2e8f0;
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
  background: #0f0f13;
  border: 1px solid #2d2d3a;
  border-radius: 8px;
  color: #e2e8f0;
  padding: 0.6rem 0.875rem;
  font-size: 0.875rem;
  outline: none;
  font-family: inherit;
  transition: border-color 0.15s;
  resize: vertical;
  width: 100%;
  box-sizing: border-box;
}
input:focus,
textarea:focus,
select:focus {
  border-color: #7c3aed;
}

.char-form {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto;
  gap: 0.75rem;
  align-items: end;
}
.char-name-input,
.char-desc-input {
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
  border: 1px solid #2d2d3a;
  border-radius: 6px;
  background: none;
  cursor: pointer;
  padding: 2px;
}
.empty-state {
  text-align: center;
  padding: 2rem;
  color: #64748b;
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
  background: #16161d;
  border: 1px solid #2d2d3a;
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
  color: #e2e8f0;
}
.char-desc {
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 2px;
}

.lines-editor {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 1.5rem;
  align-items: start;
}
.video-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: sticky;
  top: 1.5rem;
}
.video-player {
  width: 100%;
  aspect-ratio: 16/9;
  background: #000;
  display: block;
}

.waveform-container {
  width: 100%;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: -4px; /* supprime l'espace sous la vidéo */
}
.timecode-display {
  background: #0f0f13;
  border: 1px solid #2d2d3a;
  border-radius: 8px;
  padding: 0.5rem 0.875rem;
  font-size: 0.875rem;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 1rem;
  font-family: monospace;
}
.active-line-preview {
  font-size: 0.8rem;
  font-weight: 600;
}

.add-line-form {
  background: #16161d;
  border: 1px solid #2d2d3a;
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.char-select,
.line-text {
  width: 100%;
}
.timecode-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
.tc-field {
  background: #0f0f13;
  border: 1px solid #2d2d3a;
  border-radius: 8px;
  padding: 0.6rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tc-label {
  font-size: 0.7rem;
  color: #64748b;
  text-transform: uppercase;
}
.tc-value {
  font-size: 0.9rem;
  font-family: monospace;
  color: #e2e8f0;
}
.btn-mark {
  background: #1e1e2e;
  border: 1px solid #3730a3;
  color: #a78bfa;
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
  background: #16161d;
  border: 1px solid #2d2d3a;
  border-radius: 10px;
  padding: 0.875rem;
  transition: border-color 0.15s;
}
.line-row.is-active {
  border-color: #7c3aed;
  background: #1a1030;
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
.line-text {
  font-size: 0.875rem;
  color: #e2e8f0;
}
.line-times {
  font-size: 0.7rem;
  color: #64748b;
  font-family: monospace;
  margin-top: 4px;
}
.btn-del {
  background: none;
  border: none;
  color: #475569;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}
.btn-del:hover {
  color: #f87171;
  background: #2d1515;
}

.btn-primary {
  background: #7c3aed;
  color: #fff;
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
  background: #1e1e2e;
  color: #94a3b8;
  border: 1px solid #2d2d3a;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
}
.btn-sm-ghost:hover {
  border-color: #64748b;
  color: #e2e8f0;
}
.form-error {
  color: #f87171;
  font-size: 0.8rem;
}
</style>
