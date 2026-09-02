import { Queue } from 'bullmq'
import { getRedisConnection } from '../../utils/redis'

export default defineEventHandler(async (_event) => {
  const audioQueue = new Queue('audio_separation', { connection: getRedisConnection() })
  const mixQueue = new Queue('mixing', { connection: getRedisConnection() })

  const failedAudio = await audioQueue.getFailed(0, 10)
  const failedMix = await mixQueue.getFailed(0, 10)

  return {
    audio: {
      failed: failedAudio.map((j) => ({ id: j.id, failedReason: j.failedReason, data: j.data })),
    },
    mix: {
      failed: failedMix.map((j) => ({ id: j.id, failedReason: j.failedReason, data: j.data })),
    },
  }
})
