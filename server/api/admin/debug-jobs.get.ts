import { Queue } from 'bullmq'
import { getRedisConnection } from '../../utils/redis'

export default defineEventHandler(async (_event) => {
  const queue = new Queue('audio_separation', { connection: getRedisConnection() })

  const failedJobs = await queue.getFailed(0, 10)
  const activeJobs = await queue.getActive(0, 10)
  const waitingJobs = await queue.getWaiting(0, 10)

  return {
    failed: failedJobs.map((j) => ({ id: j.id, failedReason: j.failedReason, data: j.data })),
    active: activeJobs.map((j) => ({ id: j.id, data: j.data })),
    waiting: waitingJobs.map((j) => ({ id: j.id, data: j.data })),
  }
})
