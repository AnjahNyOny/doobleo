<script setup lang="ts">
import { ref } from 'vue'
import { LayoutDashboard, Clapperboard, Globe, LogOut, Mic2, Menu, X } from 'lucide-vue-next'

const { logout } = useAuth()
const route = useRoute()

const isSidebarCollapsed = ref(false)
const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}
</script>

<template>
  <div class="admin-shell" :class="{ 'sidebar-collapsed': isSidebarCollapsed }">
    <aside class="admin-sidebar">
      <div class="sidebar-brand">
        <span class="brand-icon"><Mic2 :size="24" /></span>
        <span v-show="!isSidebarCollapsed" class="brand-name">Doobleo <em>Admin</em></span>
        <button class="toggle-btn" @click="toggleSidebar">
          <Menu v-if="isSidebarCollapsed" :size="20" />
          <X v-else :size="20" />
        </button>
      </div>

      <nav class="sidebar-nav">
        <NuxtLink
          to="/admin"
          class="nav-item"
          :class="{ active: route.path === '/admin' }"
          title="Dashboard"
        >
          <span class="nav-icon"><LayoutDashboard :size="18" /></span>
          <span v-show="!isSidebarCollapsed">Dashboard</span>
        </NuxtLink>
        <NuxtLink
          to="/admin/scenes"
          class="nav-item"
          :class="{ active: route.path.startsWith('/admin/scenes') }"
          title="Scènes"
        >
          <span class="nav-icon"><Clapperboard :size="18" /></span>
          <span v-show="!isSidebarCollapsed">Scènes</span>
        </NuxtLink>
      </nav>

      <div class="sidebar-footer">
        <NuxtLink to="/" class="nav-item" title="Voir le site">
          <span class="nav-icon"><Globe :size="18" /></span>
          <span v-show="!isSidebarCollapsed">Voir le site</span>
        </NuxtLink>
        <button class="nav-item nav-logout" title="Déconnexion" @click="logout">
          <span class="nav-icon"><LogOut :size="18" /></span>
          <span v-show="!isSidebarCollapsed">Déconnexion</span>
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
  background: var(--bg-main);
  color: var(--text-main);
}

.admin-sidebar {
  width: 240px;
  flex-shrink: 0;
  background: var(--bg-card);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  padding: 1.5rem 0;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow-x: hidden;
}

.sidebar-collapsed .admin-sidebar {
  width: 72px;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 1rem;
  position: relative;
}

.sidebar-collapsed .sidebar-brand {
  justify-content: center;
  padding: 0 0 1.5rem;
}

.toggle-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.2s;
  margin-left: auto;
}

.sidebar-collapsed .toggle-btn {
  position: absolute;
  bottom: -32px;
  right: 50%;
  transform: translateX(50%);
  background: var(--bg-hover);
}

.toggle-btn:hover {
  color: var(--text-main);
  background: var(--bg-hover);
}

.brand-icon {
  color: var(--text-main);
}
.brand-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-main);
  font-family: 'Cinzel', serif;
}
.brand-name em {
  color: var(--theme-accent);
  font-style: normal;
  font-family: 'Montserrat', sans-serif;
  font-size: 0.8rem;
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
  padding: 0.75rem 1rem;
  border-radius: 6px;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  font-family: 'DM Sans', sans-serif;
  white-space: nowrap;
}

.sidebar-collapsed .nav-item {
  justify-content: center;
  padding: 0.75rem;
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-main);
}

.nav-item.active {
  background: var(--bg-hover);
  color: var(--text-main);
  font-weight: 600;
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-footer {
  padding: 1rem 0.75rem 0;
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-logout {
  color: #ef4444;
}
.nav-logout:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
}

.admin-main {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  position: relative;
}
</style>
