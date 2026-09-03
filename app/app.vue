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
  top: 1.5rem;
  right: 1.5rem;
  z-index: 9999;
  background: var(--bg-card);
  border-radius: 50%;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-color);
}
</style>
