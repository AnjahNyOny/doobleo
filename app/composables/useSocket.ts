import { io, type Socket } from 'socket.io-client'

// État global pour ne pas recréer de connexion si on navigue
let socketInstance: Socket | null = null

export const useSocket = () => {
  const config = useRuntimeConfig()

  const connect = () => {
    if (!socketInstance) {
      socketInstance = io(config.public.socketUrl, {
        autoConnect: true,
        reconnection: true,
      })

      socketInstance.on('connect', () => {
        console.log('🔗 Connected to Socket.io server', socketInstance?.id)
      })

      socketInstance.on('disconnect', () => {
        console.log('🔴 Disconnected from Socket.io server')
      })
    }
    return socketInstance
  }

  const disconnect = () => {
    if (socketInstance) {
      socketInstance.disconnect()
      socketInstance = null
    }
  }

  const getSocket = () => socketInstance

  return {
    connect,
    disconnect,
    getSocket,
  }
}
