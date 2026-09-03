<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'
const colorMode = useColorMode()

const toggleTheme = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <button class="btn-sm-ghost btn-theme" title="Changer de thème" @click="toggleTheme">
    <Sun v-if="colorMode.value === 'dark'" :size="16" />
    <Moon v-else :size="16" />
  </button>
</template>

<style scoped>
.btn-theme {
  border-radius: 50%;
  width: 36px;
  height: 36px;
  padding: 0;
  display: inline-flex;
  justify-content: center;
  align-items: center;
}
</style>
