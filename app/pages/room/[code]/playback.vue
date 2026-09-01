<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

definePageMeta({ title: 'Résultat — Doobleo' })

const route = useRoute()
const code = route.params.code as string

const { getSocket, disconnect } = useSocket()
const socket = getSocket()

const isMixing = ref(true)
const finalVideoUrl = ref<string | null>(null)
const errorMsg = ref('')

onMounted(() => {
  if (!socket) {
    // Si on arrive ici sans socket (refresh manuel), on pourrait le recréer
    // Mais pour le PoC on va juste dire qu'il y a une erreur
    errorMsg.value = 'Connexion au salon perdue.'
    isMixing.value = false
    return
  }

  socket.on('mix_ready', ({ url }: { url: string }) => {
    finalVideoUrl.value = url
    isMixing.value = false
  })
})

onUnmounted(() => {
  disconnect()
})

const downloadVideo = () => {
  if (!finalVideoUrl.value) return
  const a = document.createElement('a')
  a.href = finalVideoUrl.value
  a.download = `Doobleo_${code}.mp4`
  a.target = '_blank'
  a.click()
}
</script>

<template>
  <div class="playback-page">
    <div v-if="errorMsg" class="error-container glass-card">
      <h2>Oops!</h2>
      <p>{{ errorMsg }}</p>
      <NuxtLink to="/" class="btn-primary mt-4">Retour à l'accueil</NuxtLink>
    </div>

    <div v-else-if="isMixing" class="mixing-container">
      <div class="loader-ring" />
      <h2 class="text-gradient">Mixage en cours...</h2>
      <p class="subtitle">Nos serveurs assemblent vos voix avec la vidéo originale.</p>
    </div>

    <div v-else-if="finalVideoUrl" class="result-container">
      <div class="glass-card main-card">
        <h1 class="title">C'est dans la boîte ! 🎬</h1>

        <div class="video-wrapper">
          <video :src="finalVideoUrl" controls playsinline class="final-video" />
        </div>

        <div class="actions">
          <button class="btn-primary w-full download-btn" @click="downloadVideo">
            ⬇ Télécharger le chef-d'œuvre
          </button>

          <div class="warning-box">
            <span class="warning-icon">⚠️</span>
            <p>
              Le fichier sera supprimé de nos serveurs d'ici 30 minutes. Pensez à le sauvegarder !
            </p>
          </div>

          <NuxtLink to="/" class="btn-secondary w-full mt-4"> Quitter le salon </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.playback-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.mixing-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1.5rem;
  animation: fadeIn 1s;
}

.loader-ring {
  width: 80px;
  height: 80px;
  border: 6px solid rgba(124, 58, 237, 0.2);
  border-left-color: var(--primary);
  border-radius: 50%;
  animation:
    spin 1s linear infinite,
    glow 2s ease-in-out infinite alternate;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes glow {
  from {
    box-shadow: 0 0 10px var(--primary-glow);
  }
  to {
    box-shadow: 0 0 30px var(--primary);
  }
}

.subtitle {
  color: var(--text-muted);
  max-width: 400px;
}

.result-container {
  width: 100%;
  max-width: 800px;
  animation: fadeInUp 0.8s ease-out;
}

.main-card {
  padding: 2.5rem;
}

.title {
  text-align: center;
  font-size: 2.5rem;
  margin-bottom: 2rem;
  color: white;
}

.video-wrapper {
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  border: 1px solid var(--border-color);
  margin-bottom: 2rem;
  background: black;
  aspect-ratio: 16/9;
}

.final-video {
  width: 100%;
  height: 100%;
  display: block;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.download-btn {
  font-size: 1.1rem;
  padding: 1rem;
}

.warning-box {
  display: flex;
  gap: 1rem;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  padding: 1rem;
  border-radius: var(--radius);
  color: #fcd34d;
  font-size: 0.9rem;
  align-items: center;
}
.warning-icon {
  font-size: 1.5rem;
}

.mt-4 {
  margin-top: 1rem;
}
.w-full {
  width: 100%;
}
.error-container {
  text-align: center;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
