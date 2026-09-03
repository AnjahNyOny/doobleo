<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <div class="global-theme-toggle">
      <ColorModeToggle />
    </div>
  </div>
</template>

<style>
.global-theme-toggle {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 9999;
  background: var(--bg-card);
  border-radius: 50%;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
}
</style>
