const fs = require('fs')
const content = fs.readFileSync('app/pages/room/[code]/index.vue', 'utf8')

let newContent = content

// Add fetching scenes if no sceneId is set
if (!newContent.includes('const availableScenes = ref')) {
  newContent = newContent.replace(
    "const socketError = ref('')",
    `const socketError = ref('')\nconst availableScenes = ref<any[]>([])\n\nif (!roomInfo.value?.sceneId) {\n  const scenes = await $fetch('/api/scenes')\n  availableScenes.value = scenes as any[]\n}`
  )
}

// Add function to select scene
if (!newContent.includes('const selectScene = async')) {
  newContent = newContent.replace(
    'const selectCharacter = (charId: string) => {',
    `const selectScene = async (sceneId: string) => {
  if (!isHost.value) return
  try {
    await $fetch(\`/api/rooms/\${code}/scene\`, {
      method: 'PUT',
      body: { sceneId }
    })
  } catch (e: any) {
    socketError.value = e.data?.message || 'Erreur lors du choix de la scène.'
  }
}

const selectCharacter = (charId: string) => {`
  )
}

// Update UI
const scenePanelTarget = `      <!-- PANEL DROITE : Scène & Personnages -->
      <div class="scene-panel glass-card">`

const newScenePanel = `      <!-- PANEL DROITE : Choix Scène OU Personnages -->
      <div class="scene-panel glass-card">
        <!-- ETAT 1 : Pas de scène choisie -->
        <template v-if="!roomInfo?.sceneId">
          <div v-if="isHost" class="scene-selection">
            <h2 class="panel-title mb-4">Choisissez une scène à doubler</h2>
            <div class="scenes-grid">
              <button
                v-for="scene in availableScenes"
                :key="scene.id"
                class="scene-card"
                @click="selectScene(scene.id)"
              >
                <div class="scene-card-content">
                  <h3 class="scene-card-title">{{ scene.title }}</h3>
                  <p class="scene-card-desc">{{ scene.description }}</p>
                </div>
              </button>
            </div>
          </div>
          <div v-else class="guest-msg waiting-scene">
            <h2>En attente de l'hôte...</h2>
            <p>L'hôte est en train de choisir la scène à doubler.</p>
          </div>
        </template>

        <!-- ETAT 2 : Scène choisie, choix des persos -->
        <template v-else>
          <div class="scene-header">
            <h1 class="scene-title">{{ roomInfo?.scene?.title }}</h1>
            <span class="scene-duration">▶ 00:00</span>
          </div>

          <p class="instruction">Choisissez votre personnage :</p>

          <div class="characters-grid">
            <button
              v-for="char in characters"
              :key="char.id"
              class="character-card"
              :class="{
                'is-mine': isMyChar(char.id),
                'is-taken': isCharTakenByOther(char.id),
              }"
              :style="{ '--char-color': char.color }"
              :disabled="isCharTakenByOther(char.id)"
              @click="selectCharacter(char.id)"
            >
              <div class="char-color-dot" :style="{ background: char.color }" />
              <div class="char-content">
                <span class="char-name">{{ char.name }}</span>
                <span v-if="isMyChar(char.id)" class="char-status my-status">Mon choix</span>
                <span v-else-if="isCharTakenByOther(char.id)" class="char-status taken-status">Déjà pris</span>
              </div>
            </button>
          </div>
        </template>
      </div>`

if (!newContent.includes('<!-- ETAT 1 : Pas de scène choisie -->')) {
  // Regex to replace the entire scene-panel div up to the closing div before </div> </div> </div> </template>
  const beforeScenePanel = newContent.split(scenePanelTarget)[0]
  const afterScenePanel = newContent.split(scenePanelTarget)[1]
  const afterScenePanelEnding = afterScenePanel.substring(
    afterScenePanel.indexOf('</div>\n    </div>\n  </div>\n</template>')
  )

  newContent = beforeScenePanel + newScenePanel + afterScenePanelEnding
}

// Add CSS
if (!newContent.includes('.scenes-grid')) {
  newContent = newContent.replace(
    '</style>',
    `
.scenes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.scene-card {
  background: #111111;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 1.5rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  color: white;
}

.scene-card:hover {
  background: #1a1a1a;
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.scene-card-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.scene-card-desc {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.waiting-scene {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-muted);
}
.waiting-scene h2 {
  color: white;
  margin-bottom: 1rem;
}
</style>`
  )
}

fs.writeFileSync('app/pages/room/[code]/index.vue', newContent)
console.log('Patched room UI.')
