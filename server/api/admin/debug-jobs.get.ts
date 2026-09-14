import { mixingQueue, audioSeparationQueue } from '../../services/queue'

export default defineEventHandler(async (_event) => {
  const mixingCounts = await mixingQueue.getJobCounts()
  const audioCounts = await audioSeparationQueue.getJobCounts()

  return {
    success: true,
    mixing: mixingCounts,
    audioSeparation: audioCounts,
  }
})
