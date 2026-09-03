<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'
const colorMode = useColorMode()

const toggleTheme = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <ClientOnly>
    <button class="btn-sm-ghost btn-theme" title="Changer de thème" @click="toggleTheme">
      <Sun v-if="colorMode.value === 'dark'" :size="16" />
      <Moon v-else :size="16" />
    </button>
  </ClientOnly>
</template>

<style scoped>
.btn-theme {
  border-radius: 50%;
  width: 40px;
  height: 40px;
  padding: 0;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  color: var(--text-main);
}
.btn-theme:hover {
  background: var(--bg-hover);
}
</style>
