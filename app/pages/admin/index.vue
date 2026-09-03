<script setup lang="ts">
import { Film, CheckCircle2, FileEdit, Users, Clapperboard } from 'lucide-vue-next'

definePageMeta({ layout: 'admin', middleware: 'admin', title: 'Dashboard — Admin' })

const { data: scenes } = await useFetch('/api/admin/scenes')

const published = computed(() => scenes.value?.filter((s) => s.isPublished).length ?? 0)
const drafts = computed(() => (scenes.value?.length ?? 0) - published.value)
const totalChars = computed(
  () => scenes.value?.reduce((acc, s) => acc + (s.characterCount ?? 0), 0) ?? 0
)
</script>

<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Dashboard</h1>
      <NuxtLink to="/admin/scenes/create" class="btn-primary">+ Nouvelle scène</NuxtLink>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-icon"><Film :size="24" /></span>
        <div>
          <p class="stat-value">{{ scenes?.length ?? 0 }}</p>
          <p class="stat-label">Scènes totales</p>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon"><CheckCircle2 :size="24" /></span>
        <div>
          <p class="stat-value">{{ published }}</p>
          <p class="stat-label">Publiées</p>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon"><FileEdit :size="24" /></span>
        <div>
          <p class="stat-value">{{ drafts }}</p>
          <p class="stat-label">Brouillons</p>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon"><Users :size="24" /></span>
        <div>
          <p class="stat-value">{{ totalChars }}</p>
          <p class="stat-label">Personnages</p>
        </div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Scènes récentes</h2>
      <div v-if="scenes?.length === 0" class="empty-state">
        Aucune scène pour l'instant.
        <NuxtLink to="/admin/scenes/create">Créer la première →</NuxtLink>
      </div>
      <div v-else class="scenes-list">
        <NuxtLink
          v-for="scene in scenes?.slice(0, 5)"
          :key="scene.id"
          :to="`/admin/scenes/${scene.id}`"
          class="scene-row"
        >
          <img
            v-if="scene.thumbnailUrl"
            :src="scene.thumbnailUrl"
            :alt="scene.title"
            class="scene-thumb"
          />
          <div v-else class="scene-thumb-placeholder">
            <Clapperboard :size="24" class="placeholder-icon" />
          </div>
          <div class="scene-info">
            <p class="scene-title">{{ scene.title }}</p>
            <p class="scene-meta">{{ scene.characterCount }} personnage(s)</p>
          </div>
          <span class="scene-badge" :class="scene.isPublished ? 'published' : 'draft'">
            {{ scene.isPublished ? 'Publié' : 'Brouillon' }}
          </span>
        </NuxtLink>
      </div>
      <NuxtLink v-if="(scenes?.length ?? 0) > 5" to="/admin/scenes" class="see-all">
        Voir toutes les scènes →
      </NuxtLink>
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  padding: 1.5rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stat-icon {
  font-size: 2rem;
  color: var(--theme-accent);
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-main);
  line-height: 1.2;
}

.stat-label {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--text-main);
  font-family: 'Montserrat', sans-serif;
}

.empty-state {
  padding: 3rem;
  text-align: center;
  background: var(--bg-card);
  border: 1px dashed var(--border-color);
  border-radius: 12px;
  color: var(--text-muted);
}
.empty-state a {
  display: block;
  margin-top: 0.5rem;
  color: var(--theme-accent);
  text-decoration: none;
}
.empty-state a:hover {
  text-decoration: underline;
}

.scenes-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.scene-row {
  display: flex;
  align-items: center;
  padding: 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  text-decoration: none;
  transition:
    transform 0.2s,
    border-color 0.2s;
}

.scene-row:hover {
  transform: translateY(-2px);
  border-color: var(--border-focus);
}
.scene-thumb {
  width: 56px;
  height: 36px;
  object-fit: cover;
  border-radius: 6px;
}
.scene-thumb-placeholder {
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
.scene-info {
  flex: 1;
}
.scene-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-main);
}
.scene-meta {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 2px;
}
.scene-badge {
  font-size: 0.7rem;
  padding: 3px 10px;
  border-radius: 20px;
  font-weight: 600;
}
.scene-badge.published {
  background: #14532d;
  color: #4ade80;
}
.scene-badge.draft {
  background: #1e1b4b;
  color: #818cf8;
}

.see-all {
  display: inline-block;
  margin-top: 1rem;
  font-size: 0.85rem;
  color: var(--theme-accent);
  text-decoration: none;
}

.btn-primary {
  background: var(--theme-accent);
  color: #fff;
  padding: 0.6rem 1.25rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  transition: background 0.15s;
}
.btn-primary:hover {
  background: #6d28d9;
}
</style>
