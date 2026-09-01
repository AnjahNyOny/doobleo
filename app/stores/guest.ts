// Store pour la gestion du mode invité
// Les données sont stockées en sessionStorage (perdues à la fermeture du navigateur)

import { defineStore } from 'pinia'

interface GuestUser {
  id: string
  username: string
  isGuest: true
}

export const useGuestStore = defineStore('guest', () => {
  const guest = ref<GuestUser | null>(null)

  // Charger depuis sessionStorage au démarrage
  const init = () => {
    if (import.meta.client) {
      const stored = sessionStorage.getItem('doobleo_guest')
      if (stored) {
        try {
          guest.value = JSON.parse(stored)
        } catch {
          sessionStorage.removeItem('doobleo_guest')
        }
      }
    }
  }

  // Créer une session invité
  const setGuest = (username: string) => {
    const newGuest: GuestUser = {
      id: `guest_${crypto.randomUUID()}`,
      username,
      isGuest: true,
    }
    guest.value = newGuest
    if (import.meta.client) {
      sessionStorage.setItem('doobleo_guest', JSON.stringify(newGuest))
    }
    return newGuest
  }

  // Effacer la session invité
  const clearGuest = () => {
    guest.value = null
    if (import.meta.client) {
      sessionStorage.removeItem('doobleo_guest')
    }
  }

  const isGuest = computed(() => guest.value !== null)

  return { guest, isGuest, init, setGuest, clearGuest }
})
