import { Server as SocketServer } from 'socket.io'
import type { Server as HttpServer } from 'http'
import { initSocketManager } from '../services/socketManager'

// Extend global obj to prevent multiple initializations in dev mode (HMR)
declare global {
  var __io: SocketServer | undefined
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    if (!global.__io) {
      // Get the underlying HTTP server from the node request socket
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const server = (event.node.req.socket as any)?.server as HttpServer | undefined

      if (server) {
        const io = new SocketServer(server, {
          cors: {
            origin: '*', // En production, restreindre à l'URL front-end
            methods: ['GET', 'POST'],
          },
        })

        global.__io = io
        initSocketManager(io)
      }
    }
  })
})
