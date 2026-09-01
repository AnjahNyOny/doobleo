import { ref, type Ref } from 'vue'

export const usePlaybackSync = (videoElement: Ref<HTMLVideoElement | null>) => {
  const isPlaying = ref(false)
  const currentTimeMs = ref(0)
  const durationMs = ref(0)

  // Audio sources
  const audioContext = ref<AudioContext | null>(null)

  // M&E (Music & Effects) track
  let meBuffer: AudioBuffer | null = null
  let meSource: AudioBufferSourceNode | null = null

  // Recorded Voice track (for review)
  let voiceBuffer: AudioBuffer | null = null
  let voiceSource: AudioBufferSourceNode | null = null

  // ─── INIT AUDIO CONTEXT ────────────────────────────────────────────────────

  const initContext = () => {
    if (!audioContext.value) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      audioContext.value = new AudioContextClass()
    }
    if (audioContext.value.state === 'suspended') {
      audioContext.value.resume()
    }
  }

  // ─── LOAD TRACKS ───────────────────────────────────────────────────────────

  const loadMeTrack = async (url: string) => {
    initContext()
    try {
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      meBuffer = await audioContext.value!.decodeAudioData(arrayBuffer)
    } catch (e) {
      console.error('Failed to load M&E track', e)
    }
  }

  const loadVoiceTrack = async (blob: Blob) => {
    initContext()
    try {
      const arrayBuffer = await blob.arrayBuffer()
      voiceBuffer = await audioContext.value!.decodeAudioData(arrayBuffer)
    } catch (e) {
      console.error('Failed to load Voice track', e)
    }
  }

  const clearVoiceTrack = () => {
    voiceBuffer = null
  }

  // ─── PLAYBACK CONTROLS ─────────────────────────────────────────────────────

  const play = () => {
    if (!videoElement.value || !audioContext.value) return

    // Resume context if needed
    if (audioContext.value.state === 'suspended') {
      audioContext.value.resume()
    }

    // Stop existing audio sources if any
    stopAudioSources()

    const startTime = videoElement.value.currentTime

    // Start M&E track
    if (meBuffer) {
      meSource = audioContext.value.createBufferSource()
      meSource.buffer = meBuffer
      meSource.connect(audioContext.value.destination)
      // Start at the current video time
      meSource.start(0, startTime)
    }

    // Start Voice track (for review mode)
    if (voiceBuffer) {
      voiceSource = audioContext.value.createBufferSource()
      voiceSource.buffer = voiceBuffer
      voiceSource.connect(audioContext.value.destination)
      voiceSource.start(0, startTime)
    }

    // Play video
    videoElement.value.play()
    isPlaying.value = true
  }

  const pause = () => {
    if (videoElement.value) {
      videoElement.value.pause()
    }
    stopAudioSources()
    isPlaying.value = false
  }

  const stop = () => {
    if (videoElement.value) {
      videoElement.value.pause()
      videoElement.value.currentTime = 0
    }
    stopAudioSources()
    isPlaying.value = false
  }

  const seek = (timeSeconds: number) => {
    if (videoElement.value) {
      videoElement.value.currentTime = timeSeconds
    }
    if (isPlaying.value) {
      // If we are playing, we need to restart the audio sources at the new time
      play()
    }
  }

  const stopAudioSources = () => {
    if (meSource) {
      try {
        meSource.stop()
      } catch {
        /* ignore */
      }
      meSource.disconnect()
      meSource = null
    }
    if (voiceSource) {
      try {
        voiceSource.stop()
      } catch {
        /* ignore */
      }
      voiceSource.disconnect()
      voiceSource = null
    }
  }

  // ─── SYNC LOGIC ────────────────────────────────────────────────────────────

  // Call this in the video's @timeupdate event
  const updateTime = () => {
    if (videoElement.value) {
      currentTimeMs.value = Math.round(videoElement.value.currentTime * 1000)
    }
  }

  // Call this in the video's @loadedmetadata event
  const updateDuration = () => {
    if (videoElement.value) {
      durationMs.value = Math.round(videoElement.value.duration * 1000)
    }
  }

  // Call this in the video's @ended event
  const onEnded = () => {
    stopAudioSources()
    isPlaying.value = false
  }

  return {
    isPlaying,
    currentTimeMs,
    durationMs,
    loadMeTrack,
    loadVoiceTrack,
    clearVoiceTrack,
    play,
    pause,
    stop,
    seek,
    updateTime,
    updateDuration,
    onEnded,
  }
}
