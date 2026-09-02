import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireAdmin } from '../../../utils/guards'
import { useDb } from '../../../utils/db'
import { scenes } from '../../../db/schema/index'

const updateSceneSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  thumbnailUrl: z.string().url().optional().nullable(),
  videoUrl: z.string().url().optional(),
  audioMeUrl: z.string().url().optional(),
  durationMs: z.number().int().positive().optional(),
  isPublished: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, updateSceneSchema.parse)
  const db = useDb()

  const [existing] = await db.select().from(scenes).where(eq(scenes.id, id)).limit(1)
  if (!existing) throw createError({ statusCode: 404, message: 'Scène introuvable.' })

  const [updated] = await db
    .update(scenes)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(scenes.id, id))
    .returning()

  return updated
})
