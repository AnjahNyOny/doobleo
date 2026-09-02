import { ref, type Ref } from 'vue'

export const usePlaybackSync = (videoElement: Ref<HTMLVideoElement | null>) => {
  const isPlaying = ref(false)
  const currentTimeMs = ref(0)
  const durationMs = ref(0)
  const isRecordingMode = ref(false) // Si true, on mute les vocals originaux

  // Audio sources
  const audioContext = ref<AudioContext | null>(null)

  let meBuffer: AudioBuffer | null = null
  let meSource: AudioBufferSourceNode | null = null

  let vocalsBuffer: AudioBuffer | null = null
  let vocalsSource: AudioBufferSourceNode | null = null

  let voiceBuffer: AudioBuffer | null = null
  let voiceSource: AudioBufferSourceNode | null = null

  let segmentEndTimer: ReturnType<typeof setTimeout> | null = null

  const initContext = () => {
    if (!audioContext.value && typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (AudioContextClass) {
        audioContext.value = new AudioContextClass()
      }
    }
    if (audioContext.value && audioContext.value.state === 'suspended') {
      audioContext.value.resume()
    }
  }

  const loadTrack = async (url: string): Promise<AudioBuffer | null> => {
    if (!url) return null
    initContext()
    if (!audioContext.value) return null
    try {
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      return await audioContext.value.decodeAudioData(arrayBuffer)
    } catch (e) {
      console.warn('Failed to load audio track:', url, e)
      return null
    }
  }

  const loadMeTrack = async (url: string) => {
    meBuffer = await loadTrack(url)
  }

  const loadVocalsTrack = async (url: string) => {
    vocalsBuffer = await loadTrack(url)
  }

  const loadVoiceTrack = async (blob: Blob) => {
    initContext()
    if (!audioContext.value) return
    try {
      const arrayBuffer = await blob.arrayBuffer()
      voiceBuffer = await audioContext.value.decodeAudioData(arrayBuffer)
    } catch (e) {
      console.warn('Failed to load Voice track via decodeAudioData:', e)
    }
  }

  const clearVoiceTrack = () => {
    voiceBuffer = null
  }

  const playSegment = (
    startMs: number,
    endMs: number,
    recording: boolean = false,
    onEndedCallback?: () => void
  ) => {
    initContext()
    if (!videoElement.value) return

    stopAudioSources()
    if (segmentEndTimer) {
      clearTimeout(segmentEndTimer)
      segmentEndTimer = null
    }

    isRecordingMode.value = recording
    const startTimeSec = Math.max(0, startMs / 1000)
    const durationSec = Math.max(0.3, (endMs - startMs) / 1000)

    videoElement.value.currentTime = startTimeSec

    // Si on a des pistes audio séparées (Web Audio API)
    if (meBuffer || vocalsBuffer) {
      videoElement.value.muted = true

      if (audioContext.value) {
        // M&E track (joue toujours si dispo)
        if (meBuffer) {
          meSource = audioContext.value.createBufferSource()
          meSource.buffer = meBuffer
          meSource.connect(audioContext.value.destination)
          meSource.start(0, startTimeSec, durationSec)
        }

        // Vocals track (seulement si pas en enregistrement)
        if (vocalsBuffer && !recording) {
          vocalsSource = audioContext.value.createBufferSource()
          vocalsSource.buffer = vocalsBuffer
          vocalsSource.connect(audioContext.value.destination)
          vocalsSource.start(0, startTimeSec, durationSec)
        }

        // Voice track (review)
        if (voiceBuffer && !recording) {
          voiceSource = audioContext.value.createBufferSource()
          voiceSource.buffer = voiceBuffer
          voiceSource.connect(audioContext.value.destination)
          voiceSource.start(0, 0, durationSec)
        }
      }
    } else {
      // Fallback si pas de pistes séparées :
      // En écoute de référence -> on unmute la vidéo originale pour entendre les voix
      // En enregistrement -> on mute la vidéo pour que le micro n'attrape pas la voix d'origine
      videoElement.value.muted = recording
    }

    videoElement.value
      .play()
      .then(() => {
        isPlaying.value = true
      })
      .catch((err) => {
        console.warn('Erreur lecture vidéo:', err)
      })

    segmentEndTimer = setTimeout(() => {
      pause()
      if (onEndedCallback) {
        onEndedCallback()
      }
    }, durationSec * 1000)
  }

  const play = () => {
    initContext()
    if (!videoElement.value) return
    stopAudioSources()

    const startTimeSec = videoElement.value.currentTime

    if (meBuffer && audioContext.value) {
      meSource = audioContext.value.createBufferSource()
      meSource.buffer = meBuffer
      meSource.connect(audioContext.value.destination)
      meSource.start(0, startTimeSec)
    }

    if (vocalsBuffer && !isRecordingMode.value && audioContext.value) {
      vocalsSource = audioContext.value.createBufferSource()
      vocalsSource.buffer = vocalsBuffer
      vocalsSource.connect(audioContext.value.destination)
      vocalsSource.start(0, startTimeSec)
    }

    videoElement.value.play().catch((err) => console.warn('Erreur play:', err))
    isPlaying.value = true
  }

  const pause = () => {
    if (videoElement.value) {
      videoElement.value.pause()
      videoElement.value.muted = true
    }
    stopAudioSources()
    if (segmentEndTimer) {
      clearTimeout(segmentEndTimer)
      segmentEndTimer = null
    }
    isPlaying.value = false
    isRecordingMode.value = false
  }

  const stop = () => {
    if (videoElement.value) {
      videoElement.value.pause()
      videoElement.value.currentTime = 0
      videoElement.value.muted = true
    }
    stopAudioSources()
    if (segmentEndTimer) {
      clearTimeout(segmentEndTimer)
      segmentEndTimer = null
    }
    isPlaying.value = false
    isRecordingMode.value = false
  }

  const seek = (timeSeconds: number) => {
    if (videoElement.value) videoElement.value.currentTime = timeSeconds
    if (isPlaying.value) play()
  }

  const stopAudioSources = () => {
    ;[meSource, vocalsSource, voiceSource].forEach((source) => {
      if (source) {
        try {
          source.stop()
        } catch {
          /* ignore */
        }
        source.disconnect()
      }
    })
    meSource = null
    vocalsSource = null
    voiceSource = null
  }

  const updateTime = () => {
    if (videoElement.value) currentTimeMs.value = Math.round(videoElement.value.currentTime * 1000)
  }

  const updateDuration = () => {
    if (videoElement.value) durationMs.value = Math.round(videoElement.value.duration * 1000)
  }

  const onEnded = () => {
    pause()
  }

  return {
    isPlaying,
    currentTimeMs,
    durationMs,
    isRecordingMode,
    hasMeTrack: () => !!meBuffer,
    hasVocalsTrack: () => !!vocalsBuffer,
    loadMeTrack,
    loadVocalsTrack,
    loadVoiceTrack,
    clearVoiceTrack,
    play,
    playSegment,
    pause,
    stop,
    seek,
    updateTime,
    updateDuration,
    onEnded,
  }
}
