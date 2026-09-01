<script setup lang="ts">
definePageMeta({ middleware: 'admin' })
const { logout } = useAuth()
const route = useRoute()

const navItems = [
  { label: 'Dashboard', to: '/admin', icon: '📊' },
  { label: 'Scènes', to: '/admin/scenes', icon: '🎬' },
]
</script>

<template>
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <div class="sidebar-brand">
        <span class="brand-icon">🎙️</span>
        <span class="brand-name">Doobleo <em>Admin</em></span>
      </div>

      <nav class="sidebar-nav">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ active: route.path === item.to }"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <div class="sidebar-footer">
        <NuxtLink to="/" class="nav-item">
          <span class="nav-icon">🌐</span>
          <span>Voir le site</span>
        </NuxtLink>
        <button class="nav-item nav-logout" @click="logout">
          <span class="nav-icon">🚪</span>
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>

    <main class="admin-main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.admin-shell {
  display: flex;
  min-height: 100vh;
  background: #0f0f13;
  color: #e2e8f0;
  font-family: 'Inter', sans-serif;
}

.admin-sidebar {
  width: 240px;
  flex-shrink: 0;
  background: #16161d;
  border-right: 1px solid #2d2d3a;
  display: flex;
  flex-direction: column;
  padding: 1.5rem 0;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0 1.25rem 1.5rem;
  border-bottom: 1px solid #2d2d3a;
  margin-bottom: 1rem;
}

.brand-icon {
  font-size: 1.5rem;
}
.brand-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
}
.brand-name em {
  color: #a78bfa;
  font-style: normal;
}

.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 0.75rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  font-size: 0.9rem;
  color: #94a3b8;
  text-decoration: none;
  transition: all 0.15s;
  cursor: pointer;
  background: none;
  border: none;
  width: 100%;
  text-align: left;
}

.nav-item:hover {
  background: #1e1e2e;
  color: #e2e8f0;
}
.nav-item.active {
  background: #2d1f5e;
  color: #a78bfa;
  font-weight: 500;
}
.nav-icon {
  font-size: 1.1rem;
  width: 1.25rem;
  text-align: center;
}

.sidebar-footer {
  padding: 1rem 0.75rem 0;
  border-top: 1px solid #2d2d3a;
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-logout:hover {
  background: #2d1515;
  color: #f87171;
}

.admin-main {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
}
</style>
