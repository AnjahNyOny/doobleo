import { ref } from 'vue'

export const useMicrophone = () => {
  const stream = ref<MediaStream | null>(null)
  const isRecording = ref(false)
  const hasPermission = ref(false)
  const error = ref<string | null>(null)

  // Audio Level (VU Meter)
  const audioLevel = ref(0)

  // Web Audio API context for VU meter
  let audioContext: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let microphone: MediaStreamAudioSourceNode | null = null
  let animationFrameId: number | null = null

  // MediaRecorder
  let mediaRecorder: MediaRecorder | null = null
  let audioChunks: Blob[] = []
  const recordedBlob = ref<Blob | null>(null)

  // ─── INIT ──────────────────────────────────────────────────────────────────

  const requestPermission = async () => {
    try {
      stream.value = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      hasPermission.value = true
      error.value = null
      setupVuMeter(stream.value)
    } catch (e: unknown) {
      hasPermission.value = false
      error.value = 'Accès au microphone refusé ou introuvable.'
      console.error('Microphone error:', e)
    }
  }

  // ─── VU METER ──────────────────────────────────────────────────────────────

  const setupVuMeter = (mediaStream: MediaStream) => {
    // Safari fallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return

    audioContext = new AudioContextClass()
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 256

    microphone = audioContext.createMediaStreamSource(mediaStream)
    microphone.connect(analyser)

    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    const updateLevel = () => {
      if (!analyser) return
      analyser.getByteFrequencyData(dataArray)

      let sum = 0
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i]
      }

      const average = sum / dataArray.length
      // Normalize to 0 - 100 roughly
      audioLevel.value = Math.min(100, Math.round((average / 128) * 100))

      animationFrameId = requestAnimationFrame(updateLevel)
    }

    updateLevel()
  }

  // ─── RECORDING ─────────────────────────────────────────────────────────────

  const startRecording = () => {
    if (!stream.value) return

    audioChunks = []
    recordedBlob.value = null

    // Choose the best supported codec
    let options = { mimeType: 'audio/webm;codecs=opus' }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'audio/webm' }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        // Fallback for Safari/iOS
        options = { mimeType: 'audio/mp4' }
      }
    }

    try {
      mediaRecorder = new MediaRecorder(stream.value, options)
    } catch (e) {
      console.warn('Could not set mimeType, falling back to default', e)
      mediaRecorder = new MediaRecorder(stream.value)
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunks.push(e.data)
      }
    }

    mediaRecorder.onstop = () => {
      const mimeType = mediaRecorder?.mimeType || 'audio/webm'
      recordedBlob.value = new Blob(audioChunks, { type: mimeType })
    }

    mediaRecorder.start(100) // Collect chunks every 100ms
    isRecording.value = true
  }

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }
    isRecording.value = false
  }

  // ─── CLEANUP ───────────────────────────────────────────────────────────────

  const cleanup = () => {
    stopRecording()
    if (animationFrameId) cancelAnimationFrame(animationFrameId)
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close()
    }
    if (stream.value) {
      stream.value.getTracks().forEach((track) => track.stop())
    }
  }

  return {
    isRecording,
    hasPermission,
    error,
    audioLevel,
    recordedBlob,
    requestPermission,
    startRecording,
    stopRecording,
    cleanup,
  }
}
