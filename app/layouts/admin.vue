<script setup lang="ts">
import { ref } from 'vue'
import { LayoutDashboard, Clapperboard, Globe, LogOut, Menu, X } from 'lucide-vue-next'

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
        <span class="brand-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 280.624 280.624"
            fill="#4a3b32"
          >
            <path
              d="M202.376,165.176c0.055-0.032,0.109-0.064,0.163-0.099c9.956-6.175,15.9-16.857,15.9-28.575V33.686 c0-12.398-6.473-23.391-17.314-29.405c-6.198-3.44-13.021-4.795-19.694-4.108c-9.302-0.029-33.595-0.042-40.714-0.042 c-6.875,0-13.115,1.708-18.548,5.078L78.144,31.44c-0.044,0.026-0.087,0.053-0.131,0.08c-9.911,6.183-15.829,16.85-15.829,28.532 v102.789c0,8.98,3.352,17.261,9.439,23.315c6.113,6.08,14.71,9.558,23.614,9.558c0.091,0,0.168,0,0.285,0 c1.604,0,10.936,0.153,21.255,0.331v8.534c-28.185,4.381-45.574,15.811-45.574,30.121c0,0.675,0,8.375,0,14 c0,20.958,35.022,31.923,69.618,31.923s69.618-10.965,69.618-31.923c0-5.791,0-13.216,0-14c0-14.489-17.379-25.821-45.745-30.151 v-17.303L202.376,165.176z M193.849,17.397c6.006,3.332,9.591,9.421,9.591,16.289v1.217l-17.966,10.755 c-3.554,2.128-4.71,6.733-2.583,10.288c1.406,2.348,3.893,3.648,6.442,3.648c1.312,0,2.639-0.344,3.846-1.065l10.261-6.143v8.089 L185.474,71.23c-3.554,2.128-4.71,6.733-2.583,10.288c1.406,2.348,3.893,3.648,6.442,3.648c1.312,0,2.639-0.344,3.846-1.065 l10.261-6.143v8.09l-17.965,10.754c-3.555,2.128-4.711,6.733-2.584,10.287c1.405,2.349,3.892,3.649,6.442,3.649 c1.311,0,2.639-0.344,3.845-1.066l10.262-6.142v32.972c0,6.462-3.263,12.354-8.732,15.782l-44.884,26.287 c-0.056,0.032-0.109,0.064-0.164,0.099c-2.757,1.71-5.79,2.639-8.855,2.801c-0.721-0.014-1.588-0.029-2.582-0.047 c-2.552-0.23-5.079-0.991-7.44-2.306c-5.992-3.334-9.57-9.42-9.57-16.277v-11.114l35.687-20.971 c3.571-2.098,4.765-6.694,2.666-10.266c-2.098-3.571-6.695-4.767-10.266-2.666l-28.087,16.505v-8.176l35.687-20.971 c3.571-2.098,4.765-6.694,2.666-10.266c-2.098-3.571-6.695-4.764-10.266-2.666l-28.087,16.505v-8.175L156.9,79.611 c3.571-2.098,4.765-6.694,2.666-10.266c-2.098-3.571-6.695-4.765-10.266-2.666l-28.087,16.505V60.052 c0-6.441,3.246-12.323,8.688-15.756l44.876-26.31c0.06-0.034,0.118-0.07,0.177-0.106c2.361-1.474,4.928-2.369,7.544-2.703 c0.191,0.001,0.384,0.001,0.556,0.002v-0.073C186.714,14.753,190.45,15.512,193.849,17.397z M106.213,113.093H77.184v-10.572h29.029 V113.093z M77.184,128.093h29.029v10.573H77.184V128.093z M85.893,44.284l44.016-26.224c0.044-0.026,0.087-0.053,0.13-0.08 c3.074-1.917,6.567-2.849,10.68-2.849c1.984,0,5.31,0.001,9.268,0.003l-27.768,16.279c-0.06,0.034-0.118,0.07-0.177,0.106 c-9.911,6.183-15.829,16.85-15.829,28.532v27.469H77.184V60.052C77.184,53.604,80.438,47.714,85.893,44.284z M95.46,180.714 c-0.092,0-0.155,0-0.228,0c-4.965,0-9.71-1.89-13.031-5.193c-3.282-3.265-5.018-7.649-5.018-12.68v-9.175h29.029v9.175 c0,6.621,1.863,12.834,5.237,18.111C103.566,180.819,96.92,180.714,95.46,180.714z M142.777,196.389 c2.334-0.208,4.649-0.669,6.918-1.378v27.87c0,4.94-4.018,8.959-8.958,8.959c-4.94,0-8.959-4.018-8.959-8.959V196.31 C133.661,196.344,142.777,196.389,142.777,196.389z M195.44,234.701c0,0.269-0.077,0.644-0.196,1.023 c-2.12,6.11-22.392,15.9-54.422,15.9c-32.411,0-52.888-10.023-54.596-16.116c-0.042-0.409-0.022-0.773-0.022-0.807 c0-3.528,9.039-11.161,30.574-14.92v3.101c0,13.211,10.748,23.959,23.959,23.959c13.211,0,23.958-10.748,23.958-23.959v-3.133 C186.072,223.454,195.44,231.159,195.44,234.701z"
            />
          </svg>
        </span>
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
