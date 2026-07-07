import { useCallback, useEffect, useRef, useState } from 'react';
import {
  arrayBufferToBase64,
  encodeWav,
  prepareSpeechAudio,
} from '@/modules/dictation/encode-wav';
import { isDesktopApp, waitForDictationApi } from '@/lib/sitescop-api';

export const VOICE_BAR_COUNT = 20;

export type DictationStatus = 'idle' | 'recording' | 'processing';

const MIN_RECORDING_SECONDS = 0.25;

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionResultEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

function emptyLevels(): number[] {
  return Array.from({ length: VOICE_BAR_COUNT }, () => 0);
}

function pickRecorderMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function buildTranscript(finals: string[], interim: string): string {
  return [...finals, interim].filter(Boolean).join(' ').trim();
}

export function useDictation(onComplete: (text: string) => void) {
  const [status, setStatus] = useState<DictationStatus>('idle');
  const [levels, setLevels] = useState<number[]>(emptyLevels);
  const [liveText, setLiveText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [mode, setMode] = useState<'online' | 'offline'>('offline');

  const onCompleteRef = useRef(onComplete);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedBlobsRef = useRef<Blob[]>([]);
  const recorderMimeTypeRef = useRef('');
  const animationFrameRef = useRef(0);
  const recordingStartedAtRef = useRef(0);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const speechFinalsRef = useRef<string[]>([]);
  const speechInterimRef = useRef('');
  const onlineSpeechActiveRef = useRef(false);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let cancelled = false;

    async function detectSupport() {
      if (!isDesktopApp()) {
        setIsSupported(false);
        return;
      }
      const ready = await waitForDictationApi();
      if (!cancelled) setIsSupported(ready);
    }

    void detectSupport();
    return () => {
      cancelled = true;
    };
  }, []);

  const stopOnlineSpeech = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    onlineSpeechActiveRef.current = false;
  }, []);

  const releaseMicrophone = useCallback(() => {
    cancelAnimationFrame(animationFrameRef.current);
    stopOnlineSpeech();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    setLevels(emptyLevels());
    setRecordingSeconds(0);
  }, [stopOnlineSpeech]);

  useEffect(() => {
    return () => {
      releaseMicrophone();
    };
  }, [releaseMicrophone]);

  const startOnlineSpeech = useCallback((stream: MediaStream) => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    speechFinalsRef.current = [];
    speechInterimRef.current = '';

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-AU';

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const piece = result?.[0]?.transcript?.trim() ?? '';
        if (!piece) continue;
        if (result.isFinal) {
          speechFinalsRef.current.push(piece);
          speechInterimRef.current = '';
        } else {
          speechInterimRef.current = piece;
        }
      }
      const preview = buildTranscript(speechFinalsRef.current, speechInterimRef.current);
      if (preview) {
        setLiveText(preview);
        setMode('online');
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'network' || event.error === 'service-not-allowed') {
        onlineSpeechActiveRef.current = false;
        setMode('offline');
        return;
      }
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        onlineSpeechActiveRef.current = false;
      }
    };

    recognition.onend = () => {
      onlineSpeechActiveRef.current = false;
    };

    recognitionRef.current = recognition;
    onlineSpeechActiveRef.current = true;
    setMode('online');

    try {
      recognition.start();
    } catch {
      onlineSpeechActiveRef.current = false;
      setMode('offline');
    }
  }, []);

  const transcribeOffline = useCallback(async (samples: Float32Array, sampleRate: number) => {
    const minSamples = Math.floor(sampleRate * MIN_RECORDING_SECONDS);
    if (samples.length < minSamples) {
      setError('Recording too short. Speak while the voice bar moves, then tap Stop.');
      setStatus('idle');
      return;
    }

    if (!window.sitescop?.speech?.transcribeAudio) {
      setError('Dictation not loaded. Close all SiteScop windows and run START-SITESCOP.bat again.');
      setStatus('idle');
      return;
    }

    try {
      const prepared = prepareSpeechAudio(samples, sampleRate);
      const wav = encodeWav(prepared.samples, prepared.sampleRate);
      const base64 = arrayBufferToBase64(wav);
      const result = await window.sitescop.speech.transcribeAudio(base64);

      if (result.ok) {
        setLiveText(result.text);
        onCompleteRef.current(result.text);
        setNotice('Speech added — review and edit the text below.');
        window.setTimeout(() => setNotice(null), 5000);
      } else {
        setError(result.message);
      }
    } catch {
      setError('Could not transcribe your recording. Try again.');
    } finally {
      setStatus('idle');
    }
  }, []);

  const deliverSpeech = useCallback(
    (text: string, source: 'online' | 'offline') => {
      const trimmed = text.trim();
      if (!trimmed) {
        setError('No speech detected. Speak clearly, then tap Stop.');
        setStatus('idle');
        return;
      }
      setLiveText(trimmed);
      onCompleteRef.current(trimmed);
      setMode(source);
      setNotice(
        source === 'online'
          ? 'Speech added (online) — review and edit the text below.'
          : 'Speech added (offline) — review and edit the text below.',
      );
      window.setTimeout(() => setNotice(null), 5000);
      setStatus('idle');
    },
    [],
  );

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (status !== 'recording' || !recorder) return;

    setStatus('processing');

    if (onlineSpeechActiveRef.current) {
      recognitionRef.current?.stop();
    } else {
      stopOnlineSpeech();
    }

    const finalize = async () => {
      await new Promise((resolve) => setTimeout(resolve, 450));
      const onlineText = buildTranscript(speechFinalsRef.current, speechInterimRef.current);
      releaseMicrophone();

      if (onlineText.trim()) {
        deliverSpeech(onlineText, 'online');
        recordedBlobsRef.current = [];
        return;
      }

      const blobs = recordedBlobsRef.current;
      recordedBlobsRef.current = [];
      const mimeType = recorderMimeTypeRef.current || 'audio/webm';

      if (!blobs.length) {
        setError('No audio was captured. Allow the microphone and try again.');
        setStatus('idle');
        return;
      }

      try {
        const blob = new Blob(blobs, { type: mimeType });
        const arrayBuffer = await blob.arrayBuffer();
        const decodeContext = new AudioContext();
        const audioBuffer = await decodeContext.decodeAudioData(arrayBuffer.slice(0));
        const channel = audioBuffer.numberOfChannels > 1
          ? mixToMono(audioBuffer)
          : audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        await decodeContext.close();
        setMode('offline');
        await transcribeOffline(channel, sampleRate);
      } catch {
        setError('Could not process the recording. Try again.');
        setStatus('idle');
      }
    };

    recorder.onstop = () => {
      void finalize();
    };

    if (recorder.state === 'recording') {
      recorder.stop();
    } else {
      void finalize();
    }
  }, [deliverSpeech, releaseMicrophone, status, stopOnlineSpeech, transcribeOffline]);

  const start = useCallback(async () => {
    if (!isDesktopApp()) {
      setError('Open SiteScop with START-SITESCOP.bat (not in a browser tab).');
      return;
    }

    const apiReady = await waitForDictationApi();
    if (!apiReady) {
      setError('Dictation not loaded. Close all SiteScop windows and run START-SITESCOP.bat again.');
      return;
    }

    const mimeType = pickRecorderMimeType();
    if (!mimeType) {
      setError('Audio recording is not supported in this window.');
      return;
    }

    setError(null);
    setNotice(null);
    setLiveText('');
    setRecordingSeconds(0);
    setMode('offline');
    recordedBlobsRef.current = [];
    recorderMimeTypeRef.current = mimeType;
    speechFinalsRef.current = [];
    speechInterimRef.current = '';
    releaseMicrophone();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      await audioContext.resume();

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser);

      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 });
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedBlobsRef.current.push(event.data);
        }
      };
      recorder.start(200);

      startOnlineSpeech(stream);

      recordingStartedAtRef.current = Date.now();

      const frequencyData = new Uint8Array(analyser.frequencyBinCount);
      const sliceSize = Math.max(1, Math.floor(frequencyData.length / VOICE_BAR_COUNT));

      const updateLevels = () => {
        analyser.getByteFrequencyData(frequencyData);
        const elapsed = (Date.now() - recordingStartedAtRef.current) / 1000;
        setRecordingSeconds(elapsed);

        const next = Array.from({ length: VOICE_BAR_COUNT }, (_, index) => {
          const start = index * sliceSize;
          let sum = 0;
          for (let i = start; i < start + sliceSize && i < frequencyData.length; i += 1) {
            sum += frequencyData[i] ?? 0;
          }
          const average = sum / sliceSize;
          return Math.min(100, Math.round((average / 150) * 100));
        });
        setLevels(next);
        animationFrameRef.current = requestAnimationFrame(updateLevels);
      };
      updateLevels();

      setStatus('recording');
    } catch (err) {
      releaseMicrophone();
      setStatus('idle');
      const name = err instanceof Error ? err.name : '';
      setError(
        name === 'NotAllowedError' || name === 'PermissionDeniedError'
          ? 'Microphone blocked. Allow SiteScop under Settings → Privacy → Microphone.'
          : 'Could not open the microphone.',
      );
    }
  }, [releaseMicrophone, startOnlineSpeech]);

  const toggle = useCallback(() => {
    if (status === 'recording') {
      stop();
      return;
    }
    if (status === 'idle') {
      void start();
    }
  }, [start, status, stop]);

  const peakLevel = levels.reduce((max, level) => Math.max(max, level), 0);

  return {
    status,
    levels,
    peakLevel,
    liveText,
    error,
    notice,
    toggle,
    start,
    stop,
    recordingSeconds,
    mode,
    isRecording: status === 'recording',
    isProcessing: status === 'processing',
    isSupported,
  };
}

function mixToMono(audioBuffer: AudioBuffer): Float32Array {
  const length = audioBuffer.length;
  const output = new Float32Array(length);
  const channels = audioBuffer.numberOfChannels;
  for (let channel = 0; channel < channels; channel += 1) {
    const data = audioBuffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      output[i] = (output[i] ?? 0) + (data[i] ?? 0) / channels;
    }
  }
  return output;
}
