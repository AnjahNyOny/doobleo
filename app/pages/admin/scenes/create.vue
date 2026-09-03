<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', title: 'Nouvelle scène — Admin' })

const router = useRouter()

// ─── Upload state ────────────────────────────────────────────────────────────

const uploadState = reactive({
  video: { progress: 0, url: '', uploading: false },
  audio: { progress: 0, url: '', uploading: false },
  thumbnail: { progress: 0, url: '', uploading: false },
})

const form = reactive({
  title: '',
  description: '',
  durationMs: 0,
})

const loading = ref(false)
const error = ref('')

// ─── Upload vers S3 via URL présignée ────────────────────────────────────────

async function uploadFile(file: File, type: 'video' | 'audio' | 'thumbnail', contentType: string) {
  const slot = uploadState[type]
  slot.uploading = true
  slot.progress = 0

  try {
    // 1. Obtenir une URL présignée du serveur
    const { presignedUrl, publicUrl } = await $fetch('/api/admin/upload/presign', {
      method: 'POST',
      body: { filename: file.name, contentType, type },
    })

    // 2. Upload direct vers S3 avec suivi de progression
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
  } finally {
    slot.uploading = false
  }
}

const onVideoChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  // Lire la durée de la vidéo
  const videoEl = document.createElement('video')
  videoEl.src = URL.createObjectURL(file)
  await new Promise((r) => videoEl.addEventListener('loadedmetadata', r))
  form.durationMs = Math.round(videoEl.duration * 1000)
  URL.revokeObjectURL(videoEl.src)

  await uploadFile(file, 'video', 'video/mp4')
}

const onThumbnailChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  await uploadFile(file, 'thumbnail', file.type as 'image/jpeg' | 'image/png' | 'image/webp')
}

// ─── Création de la scène ─────────────────────────────────────────────────────

const handleCreate = async () => {
  error.value = ''
  if (!uploadState.video.url) {
    error.value = 'Veuillez uploader une vidéo.'
    return
  }

  loading.value = true
  try {
    const scene = await $fetch('/api/admin/scenes', {
      method: 'POST',
      body: {
        title: form.title,
        description: form.description || undefined,
        videoUrl: uploadState.video.url,
        thumbnailUrl: uploadState.thumbnail.url || undefined,
        durationMs: form.durationMs,
      },
    })
    await router.push(`/admin/scenes/${scene.id}`)
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    error.value = err.data?.message ?? 'Erreur lors de la création.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="create-page">
    <div class="page-header">
      <NuxtLink to="/admin/scenes" class="back-link">← Retour</NuxtLink>
      <h1 class="page-title">Nouvelle scène</h1>
    </div>

    <form class="create-form" @submit.prevent="handleCreate">
      <!-- Informations de base -->
      <div class="card">
        <h2 class="card-title">Informations</h2>
        <div class="form-group">
          <label for="title">Titre *</label>
          <input
            id="title"
            v-model="form.title"
            type="text"
            maxlength="100"
            required
            placeholder="Ex: Scène du café — Film X"
          />
        </div>
        <div class="form-group">
          <label for="desc">Description</label>
          <textarea
            id="desc"
            v-model="form.description"
            rows="3"
            placeholder="Contexte de la scène..."
          />
        </div>
      </div>

      <!-- Upload vidéo -->
      <div class="card">
        <h2 class="card-title">Vidéo muette (MP4) *</h2>
        <div class="upload-zone" :class="{ uploaded: uploadState.video.url }">
          <input
            id="video-input"
            type="file"
            accept="video/mp4"
            :disabled="uploadState.video.uploading"
            @change="onVideoChange"
          />
          <label for="video-input" class="upload-label">
            <span v-if="uploadState.video.url">✅ Vidéo uploadée</span>
            <span v-else-if="uploadState.video.uploading"
              >Upload... {{ uploadState.video.progress }}%</span
            >
            <span v-else>🎬 Choisir une vidéo MP4</span>
          </label>
          <div v-if="uploadState.video.uploading" class="progress-bar">
            <div class="progress-fill" :style="{ width: `${uploadState.video.progress}%` }" />
          </div>
          <p v-if="form.durationMs > 0" class="duration-hint">
            Durée détectée : {{ Math.floor(form.durationMs / 60000) }}m{{
              Math.floor((form.durationMs % 60000) / 1000)
            }}s
          </p>
        </div>
      </div>

      <!-- Miniature -->
      <div class="card">
        <h2 class="card-title">Miniature (optionnel)</h2>
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
            <span v-else>🖼️ Choisir une image (JPG, PNG, WebP)</span>
          </label>
          <div v-if="uploadState.thumbnail.uploading" class="progress-bar">
            <div class="progress-fill" :style="{ width: `${uploadState.thumbnail.progress}%` }" />
          </div>
        </div>
      </div>

      <p v-if="error" class="form-error">{{ error }}</p>

      <div class="form-actions">
        <NuxtLink to="/admin/scenes" class="btn-ghost">Annuler</NuxtLink>
        <button
          type="submit"
          class="btn-primary"
          :disabled="loading || uploadState.video.uploading || uploadState.thumbnail.uploading"
        >
          {{ loading ? 'Création...' : 'Créer la scène (Séparation Audio par IA)' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.create-page {
  max-width: 720px;
}
.page-header {
  margin-bottom: 2rem;
}
.back-link {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.875rem;
  display: block;
  margin-bottom: 0.75rem;
}
.back-link:hover {
  color: var(--theme-accent);
}
.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-main);
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
}
.card-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 1rem;
}
.card-hint {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: 0.75rem;
  margin-top: -0.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1rem;
}
.form-group:last-child {
  margin-bottom: 0;
}
label {
  font-size: 0.85rem;
  color: #94a3b8;
  font-weight: 500;
}
input[type='text'],
textarea {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-main);
  padding: 0.625rem 0.875rem;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.15s;
  font-family: inherit;
  resize: vertical;
}
input:focus,
textarea:focus {
  border-color: var(--theme-accent);
}

.upload-zone {
  border: 2px dashed var(--border-color);
  border-radius: 10px;
  padding: 1.5rem;
  text-align: center;
  transition: border-color 0.15s;
  position: relative;
}
.upload-zone.uploaded {
  border-color: #14532d;
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
.duration-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.5rem;
}

.form-error {
  color: #f87171;
  font-size: 0.875rem;
}
.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}
.btn-primary {
  background: var(--theme-accent);
  color: var(--text-main);
  padding: 0.6rem 1.5rem;
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
.btn-ghost {
  background: transparent;
  color: var(--text-muted);
  padding: 0.6rem 1.25rem;
  border-radius: 8px;
  font-size: 0.875rem;
  text-decoration: none;
  border: 1px solid var(--border-color);
}
.btn-ghost:hover {
  border-color: var(--text-muted);
  color: #94a3b8;
}
</style>
