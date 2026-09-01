import { Queue } from 'bullmq'

// BullMQ Queue Configuration
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
}

export const mixingQueue = new Queue('mixing', { connection })

export interface MixJobData {
  roomCode: string
  sceneId: string
  blobs: { userId: string; characterId: string; blobKey: string }[]
}

export const addMixJob = async (roomCode: string, sceneId: string, blobs: MixJobData['blobs']) => {
  await mixingQueue.add('mix_scene', { roomCode, sceneId, blobs })
}
