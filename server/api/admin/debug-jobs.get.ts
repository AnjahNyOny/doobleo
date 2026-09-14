import { mixingQueue } from '../../services/queue'

export default defineEventHandler(async (_event) => {
  const mixingCounts = await mixingQueue.getJobCounts()

  return {
    success: true,
    mixing: mixingCounts,
  }
})
