<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'

definePageMeta({ title: 'Bibliothèque — Doobleo' })

const router = useRouter()
const { data: scenes, pending, error } = useFetch('/api/scenes')
const { loggedIn, user } = useUserSession()

const loadingSceneId = ref<string | null>(null)

const getCurrentUser = () => {
  if (loggedIn.value && user.value) return user.value

  const guestName = sessionStorage.getItem('guestName')
  if (guestName) {
    let guestId = sessionStorage.getItem('guestId')
    if (!guestId) {
      guestId = 'guest_' + Math.random().toString(36).substring(2, 9)
      sessionStorage.setItem('guestId', guestId)
    }
    return { id: guestId, username: guestName, avatarUrl: null }
  }
  return null
}

const hostRoomWithScene = async (sceneId: string) => {
  const currentUser = getCurrentUser()
  if (!currentUser) {
    alert("Veuillez d'abord entrer un pseudo ou vous connecter depuis l'accueil.")
    router.push('/')
    return
  }

  loadingSceneId.value = sceneId
  try {
    const res = await $fetch('/api/rooms', {
      method: 'POST',
      body: {
        sceneId,
        hostUserId: currentUser.id,
        hostUsername: currentUser.username,
        hostAvatarUrl: currentUser.avatarUrl,
      },
    })
    router.push(`/room/${res.room?.code || res.code}`)
  } catch (err: any) {
    console.error(err)
    alert(err.data?.message || 'Erreur lors de la création du salon.')
  } finally {
    loadingSceneId.value = null
  }
}
</script>

<template>
  <div class="library-page">
    <div class="header">
      <NuxtLink
        to="/"
        class="btn-sm-ghost mb-4"
        style="display: inline-flex; align-items: center; gap: 0.5rem"
      >
        <ArrowLeft :size="16" /> Retour à l'accueil
      </NuxtLink>
      <h1 class="title text-gradient">Bibliothèque de Scènes</h1>
      <p class="subtitle">Parcourez le catalogue et créez une partie directement.</p>
    </div>

    <div v-if="pending" class="loading-state">
      <div class="spinner" />
      <p>Chargement des scènes...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <p>Erreur lors du chargement de la bibliothèque.</p>
    </div>

    <div v-else class="scenes-grid">
      <div v-for="scene in scenes" :key="scene.id" class="scene-card glass-card">
        <div class="thumbnail-wrapper">
          <img v-if="scene.thumbnailUrl" :src="scene.thumbnailUrl" class="thumbnail" />
          <video
            v-else
            :src="`${scene.videoUrl}#t=2`"
            class="thumbnail video-thumbnail"
            preload="metadata"
            muted
            playsinline
          />
          <div class="duration-badge">{{ Math.round(scene.durationMs / 1000) }}s</div>
        </div>
        <div class="scene-info">
          <h2 class="scene-title">{{ scene.title }}</h2>
          <p class="scene-desc">{{ scene.description || 'Aucune description disponible.' }}</p>
          <button
            class="btn-primary w-full mt-4"
            :disabled="loadingSceneId === scene.id"
            @click="hostRoomWithScene(scene.id)"
          >
            {{ loadingSceneId === scene.id ? 'Création...' : 'Jouer cette scène' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.library-page {
  padding: 2rem 1rem;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100vh;
}
@media (min-width: 768px) {
  .library-page {
    padding: 3rem 2rem;
  }
}

.header {
  margin-bottom: 3rem;
}
.title {
  font-size: 2.5rem;
  font-weight: 800;
  margin-bottom: 0.5rem;
}
.subtitle {
  color: var(--text-muted);
  font-size: 1.1rem;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 40vh;
  color: var(--text-muted);
}
.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-left-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.scenes-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}
@media (min-width: 600px) {
  .scenes-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }
}

.scene-card {
  padding: 0; /* Override glass-card padding */
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}
.scene-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
  border-color: rgba(255, 255, 255, 0.1);
}

.thumbnail-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 16/9;
  background: #000;
  overflow: hidden;
}
.thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.duration-badge {
  position: absolute;
  bottom: 0.5rem;
  right: 0.5rem;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  backdrop-filter: blur(4px);
}

.scene-info {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  flex: 1;
}
.scene-title {
  font-size: 1.2rem;
  color: white;
  margin-bottom: 0.5rem;
}
.scene-desc {
  font-size: 0.9rem;
  color: var(--text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
}
.w-full {
  width: 100%;
}
.mt-4 {
  margin-top: 1rem;
}
.mb-4 {
  margin-bottom: 1rem;
  display: inline-block;
}
</style>
