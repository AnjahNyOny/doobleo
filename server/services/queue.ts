export class InMemoryQueue<T> {
  name: string
  queue: { id: string; data: T; resolve: (val: any) => void; reject: (err: any) => void }[] = []
  processor?: (job: { id: string; data: T }) => Promise<any>
  isProcessing = false

  constructor(name: string) {
    this.name = name
  }

  process(processor: (job: { id: string; data: T }) => Promise<any>) {
    this.processor = processor
    this.processNext()
  }

  async add(name: string, data: T) {
    return new Promise((resolve, reject) => {
      this.queue.push({ id: Math.random().toString(36).substring(7), data, resolve, reject })
      this.processNext()
    })
  }

  private async processNext() {
    if (this.isProcessing || this.queue.length === 0 || !this.processor) return
    this.isProcessing = true
    const job = this.queue.shift()
    if (job) {
      try {
        const result = await this.processor({ id: job.id, data: job.data })
        job.resolve(result)
      } catch (err) {
        job.reject(err)
      }
    }
    this.isProcessing = false
    this.processNext()
  }

  async getJobCounts() {
    return { waiting: this.queue.length, active: this.isProcessing ? 1 : 0 }
  }
}

export interface MixJobData {
  roomCode: string
  sceneId: string
  blobs: { userId: string; characterId: string; chunks: { key: string; startMs: number }[] }[]
}

export const mixingQueue = new InMemoryQueue<MixJobData>('mixing')

export const addMixJob = async (roomCode: string, sceneId: string, blobs: MixJobData['blobs']) => {
  await mixingQueue.add('mix_scene', { roomCode, sceneId, blobs })
}
