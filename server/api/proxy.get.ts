import { generateDownloadPresignedUrl, extractKeyFromUrl } from '../utils/s3'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  let targetUrl = query.url as string
  if (!targetUrl) throw createError({ statusCode: 400, statusMessage: 'Missing url parameter' })

  try {
    if (targetUrl.includes('.r2.cloudflarestorage.com')) {
      targetUrl = await generateDownloadPresignedUrl(extractKeyFromUrl(targetUrl))
    }

    const response = await fetch(targetUrl)
    if (!response.ok) {
      throw createError({ statusCode: response.status, statusMessage: response.statusText })
    }

    // Set permissive CORS headers for the canvas to draw
    setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
    setResponseHeader(
      event,
      'Content-Type',
      response.headers.get('content-type') || 'application/octet-stream'
    )

    // Return the stream directly
    return response.body
  } catch (error: any) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
})
