export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const targetUrl = query.url as string
  if (!targetUrl) throw createError({ statusCode: 400, statusMessage: 'Missing url parameter' })

  try {
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
