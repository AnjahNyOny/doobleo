<script setup lang="ts">
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
        <span class="stat-icon">🎬</span>
        <div>
          <p class="stat-value">{{ scenes?.length ?? 0 }}</p>
          <p class="stat-label">Scènes totales</p>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon">✅</span>
        <div>
          <p class="stat-value">{{ published }}</p>
          <p class="stat-label">Publiées</p>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon">📝</span>
        <div>
          <p class="stat-value">{{ drafts }}</p>
          <p class="stat-label">Brouillons</p>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon">🎭</span>
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
          <div v-else class="scene-thumb-placeholder">🎬</div>
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
  color: #fff;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 2.5rem;
}
.stat-card {
  background: #16161d;
  border: 1px solid #2d2d3a;
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}
.stat-icon {
  font-size: 2rem;
}
.stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: #fff;
}
.stat-label {
  font-size: 0.8rem;
  color: #64748b;
  margin-top: 2px;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #e2e8f0;
  margin-bottom: 1rem;
}
.empty-state {
  color: #64748b;
  padding: 2rem;
  text-align: center;
}
.empty-state a {
  color: #a78bfa;
  text-decoration: none;
}

.scenes-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.scene-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1rem;
  background: #16161d;
  border: 1px solid #2d2d3a;
  border-radius: 10px;
  text-decoration: none;
  transition: border-color 0.15s;
}
.scene-row:hover {
  border-color: #a78bfa;
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
  background: #1e1e2e;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}
.scene-info {
  flex: 1;
}
.scene-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: #e2e8f0;
}
.scene-meta {
  font-size: 0.75rem;
  color: #64748b;
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
  color: #a78bfa;
  text-decoration: none;
}

.btn-primary {
  background: #7c3aed;
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
