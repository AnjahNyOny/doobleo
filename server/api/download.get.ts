export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const url = query.url as string
  if (!url) throw createError({ statusCode: 400, message: 'Missing url' })

  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Failed to fetch')

    // On passe le content-type et on force le téléchargement
    setHeader(event, 'Content-Type', response.headers.get('content-type') || 'video/mp4')
    setHeader(event, 'Content-Disposition', `attachment; filename="doobleo-video.mp4"`)

    return response.body
  } catch {
    throw createError({ statusCode: 500, message: 'Download failed' })
  }
})
