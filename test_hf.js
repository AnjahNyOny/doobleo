const fs = require('fs')

async function run() {
  console.log('Starting test...')

  // Create a dummy 1-second silence WAV
  const execSync = require('child_process').execSync
  execSync('ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t 1 test_silence.wav')
  console.log('Created test_silence.wav')

  const blob = new Blob([fs.readFileSync('test_silence.wav')], { type: 'audio/wav' })
  const formData = new FormData()
  formData.append('files', blob, 'test_silence.wav')

  const uploadRes = await fetch(
    'https://ahk-d-spleeter-ht-demucs-stem-separation-2025.hf.space/gradio_api/upload',
    {
      method: 'POST',
      body: formData,
    }
  )

  const uploadData = await uploadRes.json()
  const filePath = uploadData[0]
  console.log('Uploaded to:', filePath)

  const predictRes = await fetch(
    'https://ahk-d-spleeter-ht-demucs-stem-separation-2025.hf.space/gradio_api/call/separate_selected_models',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [{ path: filePath, meta: { _type: 'gradio.FileData' } }, true, false],
      }),
    }
  )

  const predictData = await predictRes.json()
  const eventId = predictData.event_id
  console.log('Event ID:', eventId)

  const pollRes = await fetch(
    `https://ahk-d-spleeter-ht-demucs-stem-separation-2025.hf.space/gradio_api/call/separate_selected_models/${eventId}`,
    {
      headers: { Accept: 'text/event-stream' },
    }
  )

  const reader = pollRes.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() // Keep last incomplete line

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('event: complete')) {
        const dataLine = lines[i + 1]
        console.log('COMPLETE EVENT:')
        console.log(dataLine)
        process.exit(0)
      }
    }
  }
}

run().catch(console.error)
