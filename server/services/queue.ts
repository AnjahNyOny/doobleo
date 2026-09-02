import { Queue } from 'bullmq'

// BullMQ Queue Configuration
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
}

export const mixingQueue = new Queue('mixing', { connection })
export const audioSeparationQueue = new Queue('audio_separation', { connection })

export interface MixJobData {
  roomCode: string
  sceneId: string
  blobs: { userId: string; characterId: string; chunks: { key: string; startMs: number }[] }[]
}

export const addMixJob = async (roomCode: string, sceneId: string, blobs: MixJobData['blobs']) => {
  await mixingQueue.add('mix_scene', { roomCode, sceneId, blobs })
}

export const addAudioSeparationJob = async (sceneId: string, videoUrl: string) => {
  await audioSeparationQueue.add('separate_audio', { sceneId, videoUrl })
}
