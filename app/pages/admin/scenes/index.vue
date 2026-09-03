<script setup lang="ts">
import { Clapperboard } from 'lucide-vue-next'

definePageMeta({ layout: 'admin', middleware: 'admin', title: 'Scènes — Admin' })

const { data: scenes, refresh } = await useFetch('/api/admin/scenes')

const deleting = ref<string | null>(null)
const error = ref('')

const togglePublish = async (scene: { id: string; isPublished: boolean }) => {
  await $fetch(`/api/admin/scenes/${scene.id}`, {
    method: 'PATCH',
    body: { isPublished: !scene.isPublished },
  })
  await refresh()
}

const deleteScene = async (id: string, title: string) => {
  if (!confirm(`Supprimer la scène "${title}" ? Cette action est irréversible.`)) return
  deleting.value = id
  error.value = ''
  try {
    await $fetch(`/api/admin/scenes/${id}`, { method: 'DELETE' })
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    error.value = err.data?.message ?? 'Erreur lors de la suppression.'
  } finally {
    deleting.value = null
  }
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}m${(s % 60).toString().padStart(2, '0')}s`
}
</script>

<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">
        Scènes <span class="count">({{ scenes?.length ?? 0 }})</span>
      </h1>
      <NuxtLink to="/admin/scenes/create" class="btn-primary">+ Nouvelle scène</NuxtLink>
    </div>

    <p v-if="error" class="form-error">{{ error }}</p>

    <div v-if="scenes?.length === 0" class="empty-state">
      Aucune scène. <NuxtLink to="/admin/scenes/create">Créer la première →</NuxtLink>
    </div>

    <div v-else class="scenes-table">
      <div class="table-header">
        <span>Scène</span>
        <span>Durée</span>
        <span>Personnages</span>
        <span>Statut</span>
        <span>Actions</span>
      </div>

      <div v-for="scene in scenes" :key="scene.id" class="table-row">
        <div class="scene-cell">
          <img
            v-if="scene.thumbnailUrl"
            :src="scene.thumbnailUrl"
            :alt="scene.title"
            class="thumb"
          />
          <div v-else class="thumb-placeholder">
            <Clapperboard :size="24" class="placeholder-icon" />
          </div>
          <div>
            <p class="scene-title">{{ scene.title }}</p>
            <p v-if="scene.description" class="scene-desc">{{ scene.description }}</p>
          </div>
        </div>
        <span class="cell-muted">{{ formatDuration(scene.durationMs) }}</span>
        <span class="cell-muted">{{ scene.characterCount ?? 0 }}</span>
        <div>
          <button
            class="badge-btn"
            :class="scene.isPublished ? 'published' : 'draft'"
            @click="togglePublish(scene)"
          >
            {{ scene.isPublished ? '✅ Publié' : '📝 Brouillon' }}
          </button>
        </div>
        <div class="actions-cell">
          <NuxtLink :to="`/admin/scenes/${scene.id}`" class="btn-sm btn-edit">Éditer</NuxtLink>
          <button
            class="btn-sm btn-delete"
            :disabled="deleting === scene.id"
            @click="deleteScene(scene.id, scene.title)"
          >
            {{ deleting === scene.id ? '...' : 'Suppr.' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}
.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-main);
  font-family: 'Cinzel', serif;
}
.count {
  color: var(--text-muted);
  font-size: 1.25rem;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--text-muted);
}
.empty-state a {
  color: var(--theme-accent);
  text-decoration: none;
}

.scenes-table {
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
}
.table-header {
  display: grid;
  grid-template-columns: 2fr 0.7fr 0.7fr 1fr 1fr;
  padding: 0.75rem 1rem;
  background: var(--bg-card);
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}
.table-row {
  display: grid;
  grid-template-columns: 2fr 0.7fr 0.7fr 1fr 1fr;
  padding: 0.875rem 1rem;
  border-top: 1px solid var(--border-color);
  align-items: center;
  transition: background 0.1s;
}
.table-row:hover {
  background: var(--bg-hover);
}

.scene-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.thumb {
  width: 64px;
  width: 56px;
  height: 36px;
  object-fit: cover;
  border-radius: 6px;
  flex-shrink: 0;
}
.thumb-placeholder {
  width: 56px;
  height: 36px;
  border-radius: 6px;
  background: var(--bg-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.placeholder-icon {
  color: var(--text-muted);
  opacity: 0.5;
}
.scene-title {
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 2px;
}
.scene-desc {
  font-size: 0.8rem;
  color: var(--text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.cell-muted {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.badge-btn {
  border: none;
  border-radius: 20px;
  padding: 4px 12px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.badge-btn.published {
  color: #4ade80;
}
.badge-btn.draft {
  background: #1e1b4b;
  color: #818cf8;
}
.badge-btn:hover {
  opacity: 0.8;
}

.actions-cell {
  display: flex;
  gap: 0.5rem;
}
.btn-sm {
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  text-decoration: none;
  display: inline-block;
}
.btn-edit {
  background: var(--bg-hover);
  color: var(--theme-accent);
  border: 1px solid #3730a3;
}
.btn-edit:hover {
  background: #2d1f5e;
}
.btn-delete {
  background: #1c1010;
  color: #f87171;
  border: 1px solid #7f1d1d;
}
.btn-delete:hover:not(:disabled) {
  background: #2d1515;
}
.btn-delete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-primary {
  background: var(--theme-accent);
  color: #fff;
  padding: 0.6rem 1.25rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
}
.btn-primary:hover {
  background: #6d28d9;
}
.form-error {
  color: #f87171;
  margin-bottom: 1rem;
}
</style>
