import { z } from 'zod'
import { requireAdmin } from '../../../utils/guards'
import { useDb } from '../../../utils/db'
import { scenes } from '../../../db/schema/index'

const createSceneSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().optional(),
  thumbnailUrl: z.string().url().optional(),
  videoUrl: z.string().url('URL vidéo invalide'),
  audioMeUrl: z.string().url('URL audio M&E invalide'),
  durationMs: z.number().int().positive(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readValidatedBody(event, createSceneSchema.parse)
  const db = useDb()

  const [scene] = await db.insert(scenes).values(body).returning()
  return scene
})
