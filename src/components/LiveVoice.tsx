import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';
import { SpeechRecognition as CapSpeechRecognition } from '@capacitor-community/speech-recognition';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Button } from './ui/button';
import { 
  Mic, MicOff, Loader2, Sparkles, AlertCircle, RefreshCw, Volume2, MessageSquare,
  Copy, FileText, Trash2, Check, X, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { SIERRA_CORE_PERSONA } from '../lib/persona';
import { streamChat } from '../lib/providers';

interface TranscriptItem {
  id: string;
  sender: 'user' | 'sierra';
  text: string;
  timestamp: number;
}

import { formatDebugLogs, type DebugLogEvent } from '../lib/debugLogs';
export { formatDebugLogs, type DebugLogEvent };

export default function LiveVoice() {
  const [user] = useAuthState(auth);
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [mode, setMode] = useState<'continuous' | 'push'>('continuous');
  const [isPushing, setIsPushing] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [userSpeechDetected, setUserSpeechDetected] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<'Aoede' | 'Zephyr' | 'Kore' | 'Puck'>('Aoede');
  const [debugLogs, setDebugLogs] = useState<{ id: string; time: string; stage: string; detail: string }[]>([]);
  const [isCopied, setIsCopied] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isFallbackModalOpen, setIsFallbackModalOpen] = useState(false);
  const [fallbackLogText, setFallbackLogText] = useState('');
  const fallbackTextareaRef = useRef<HTMLTextAreaElement>(null);
  const debugScrollRef = useRef<HTMLDivElement>(null);

  const addDebugLog = (stage: string, detail: string) => {
    const time = new Date().toLocaleTimeString();
    console.log(`[VoiceDebug] [${time}] [${stage}] ${detail}`);
    setDebugLogs(prev => [
      ...prev.slice(-49),
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, time, stage, detail }
    ]);
  };

  const withNativeTimeout = async <T,>(
    promise: Promise<T>,
    ms: number = 2000,
    fallbackValue?: T,
    opName: string = 'Native operation'
  ): Promise<T | undefined> => {
    let timeoutId: any = null;
    let didTimeout = false;
    const timeoutPromise = new Promise<T | undefined>((resolve) => {
      timeoutId = setTimeout(() => {
        didTimeout = true;
        console.warn(`[Native STT] ${opName} timed out after ${ms}ms, continuing`);
        addDebugLog('STT:Timeout', `${opName} timed out after ${ms}ms`);
        resolve(fallbackValue);
      }, ms);
    });

    try {
      const result = await Promise.race([
        promise.then((res) => {
          if (!didTimeout) {
            console.log(`[Native STT] ${opName} completed normally`);
          }
          return res;
        }),
        timeoutPromise
      ]);
      return result;
    } catch (err: any) {
      console.warn(`[Native STT] ${opName} threw error:`, err);
      addDebugLog('STT:Error', `${opName} error: ${err?.message || String(err)}`);
      return fallbackValue;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };

  useEffect(() => {
    debugScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [debugLogs]);

  useEffect(() => {
    if (isFallbackModalOpen && fallbackTextareaRef.current) {
      fallbackTextareaRef.current.focus();
      fallbackTextareaRef.current.select();
    }
  }, [isFallbackModalOpen]);

  const copyDebugLogs = async (count?: number) => {
    if (debugLogs.length === 0) {
      toast.info("No debug events logged yet. Speak or tap the orb first.");
      return;
    }

    const textToCopy = formatDebugLogs(debugLogs, count);
    let copied = false;

    // 1. Native Capacitor Clipboard
    if (Capacitor.isNativePlatform()) {
      try {
        await Clipboard.write({ string: textToCopy });
        copied = true;
      } catch (nativeErr: any) {
        console.warn("[Clipboard] Capacitor Clipboard.write failed, falling back:", nativeErr);
      }
    }

    // 2. Browser Navigator Clipboard API
    if (!copied && typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(textToCopy);
        copied = true;
      } catch (webErr: any) {
        console.warn("[Clipboard] navigator.clipboard.writeText failed:", webErr);
      }
    }

    // 3. Fallback: execCommand('copy') with off-screen textarea
    if (!copied && typeof document !== 'undefined') {
      try {
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = textToCopy;
        tempTextArea.style.position = 'fixed';
        tempTextArea.style.left = '-9999px';
        tempTextArea.style.top = '0';
        tempTextArea.setAttribute('readonly', '');
        document.body.appendChild(tempTextArea);
        tempTextArea.focus();
        tempTextArea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(tempTextArea);
      } catch (execErr: any) {
        console.warn("[Clipboard] document.execCommand('copy') failed:", execErr);
      }
    }

    if (copied) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      toast.success("Debug log copied. Paste it into ChatGPT.");
    } else {
      toast.error("Could not write to clipboard automatically. Select and copy from the box below.");
      setFallbackLogText(textToCopy);
      setIsFallbackModalOpen(true);
    }
  };

  const handleClearConfirm = () => {
    setDebugLogs([]);
    setShowClearConfirm(false);
    toast.info("Debug log cleared.");
  };

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const speechRecognitionRef = useRef<any>(null);
  const nativeListenerRef = useRef<any>(null);
  const nativeStateListenerRef = useRef<any>(null);
  const nativeListenersAttachedRef = useRef<boolean>(false);
  const currentCycleIdRef = useRef<number>(0);
  const isStartingRef = useRef<boolean>(false);
  const isNativeListeningRef = useRef<boolean>(false);
  const isSpeakingRef = useRef<boolean>(false);
  const isRespondingRef = useRef<boolean>(false);
  const isActiveRef = useRef<boolean>(false);
  const transcriptsRef = useRef<TranscriptItem[]>([]);
  const currentTranscriptRef = useRef<string>('');
  const silenceTimerRef = useRef<any>(null);
  const cooldownTimerRef = useRef<any>(null);
  const retryTimerRef = useRef<any>(null);
  const recognitionTimeoutRef = useRef<any>(null);
  const consecutiveFailuresRef = useRef<number>(0);
  const MAX_RECOGNITION_RETRIES = 3;
  const RECOGNITION_TIMEOUT_MS = 12000;
  const PLAYBACK_COOLDOWN_MS = 750;

  // Keep refs synchronized with state
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    transcriptsRef.current = transcripts;
  }, [transcripts]);

  // Auto-scroll transcript container
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Clean up Web Audio and media stream on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  const persistVoiceMessage = async (sender: 'user' | 'sierra', text: string) => {
    if (!text.trim() || !user) return;
    try {
      await addDoc(collection(db, `users/${user.uid}/sessions/live-voice-session/messages`), {
        role: sender === 'user' ? 'user' : 'model',
        content: text,
        timestamp: Date.now(),
        isVoice: true,
        modelName: 'Sierra Live Neural Voice',
      });
    } catch (err) {
      console.warn("Could not save live voice transcript to Firestore:", err);
    }
  };

  const scheduleListeningRestart = (delayMs: number = PLAYBACK_COOLDOWN_MS) => {
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
    }
    cooldownTimerRef.current = setTimeout(() => {
      cooldownTimerRef.current = null;
      if (isActiveRef.current && !isSpeakingRef.current && !isRespondingRef.current && mode === 'continuous') {
        startSpeechToText();
      }
    }, delayMs);
  };

  const playTextToSpeech = async (text: string) => {
    if (!text.trim()) return;

    // Properly stop and fully release native speech recognition plugin before TTS playback begins
    await stopSpeechToText();

    if (typeof window === 'undefined' || !window.speechSynthesis) {
      if (isActiveRef.current && mode === 'continuous') {
        scheduleListeningRestart(PLAYBACK_COOLDOWN_MS);
      }
      return;
    }

    try {
      window.speechSynthesis.cancel();

      // Clean markdown symbols for natural TTS speech
      const cleanText = text.replace(/[*#_`~>]/g, '').trim();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';

      // Pick natural voice if available
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const preferred = voices.find(v => 
          v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Female'))
        ) || voices.find(v => v.lang.startsWith('en'));
        if (preferred) {
          utterance.voice = preferred;
        }
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        isSpeakingRef.current = true;
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        // Resume continuous listening ONLY after playback fully completes, with a short cooldown buffer
        // to avoid catching playback tail audio from the device speaker
        if (isActiveRef.current && mode === 'continuous') {
          scheduleListeningRestart(PLAYBACK_COOLDOWN_MS);
        }
      };

      utterance.onerror = (e) => {
        console.warn("TTS playback error:", e);
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        if (isActiveRef.current && mode === 'continuous') {
          scheduleListeningRestart(PLAYBACK_COOLDOWN_MS);
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch (ttsErr) {
      console.warn("TTS execution error:", ttsErr);
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      if (isActiveRef.current && mode === 'continuous') {
        scheduleListeningRestart(PLAYBACK_COOLDOWN_MS);
      }
    }
  };

  const commitCurrentUtterance = async () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
      recognitionTimeoutRef.current = null;
    }

    const textToCommit = currentTranscriptRef.current.trim();
    currentTranscriptRef.current = '';
    setUserSpeechDetected(false);

    const cycleId = currentCycleIdRef.current;
    addDebugLog('commitCurrentUtterance', `[Cycle #${cycleId}] captured: "${textToCommit}" (isSpeaking=${isSpeakingRef.current}, isResponding=${isRespondingRef.current})`);

    if (!textToCommit) {
      console.log(`[Native STT:Commit:Cycle#${cycleId}] Buffer empty, no speech to commit.`);
      return;
    }

    if (isSpeakingRef.current || isRespondingRef.current) {
      console.log(`[Native STT:Commit:Cycle#${cycleId}] Ignored: Sierra is currently speaking or generating response.`);
      return;
    }

    console.log(`[Native STT:FinalResult:Cycle#${cycleId}] Complete user utterance captured:`, textToCommit);
    console.log(`[Native STT:Handoff:Cycle#${cycleId}] Dispatching utterance to handleUserUtterance...`);
    consecutiveFailuresRef.current = 0;
    await stopSpeechToText();
    await handleUserUtterance(textToCommit);
  };

  const handleSilenceOrEmpty = () => {
    const cycleId = currentCycleIdRef.current;
    addDebugLog('STT:SilenceOrEmpty', `[Cycle #${cycleId}] Round completed without speech (failures: ${consecutiveFailuresRef.current + 1}/${MAX_RECOGNITION_RETRIES})`);
    console.log(`[Native STT:Cycle#${cycleId}] Listening round completed with no speech captured`);
    isNativeListeningRef.current = false;
    isStartingRef.current = false;
    setUserSpeechDetected(false);

    if (isActiveRef.current && !isSpeakingRef.current && !isRespondingRef.current && mode === 'continuous') {
      consecutiveFailuresRef.current++;
      console.log(`[Native STT:Cycle#${cycleId}] Consecutive silence/empty count: ${consecutiveFailuresRef.current}/${MAX_RECOGNITION_RETRIES}`);
      if (consecutiveFailuresRef.current >= MAX_RECOGNITION_RETRIES) {
        console.warn(`[Native STT:Cycle#${cycleId}] Continuous listening paused after maximum inactivity.`);
        addDebugLog('STT:Paused', `Continuous listening paused after ${MAX_RECOGNITION_RETRIES} empty cycles. Tap mic to resume.`);
        toast.info("Listening paused. Tap microphone to resume.");
        return;
      }
      const backoff = Math.min(600 * consecutiveFailuresRef.current, 3000);
      addDebugLog('STT:Retry', `[Cycle #${cycleId}] Scheduling listening retry with ${backoff}ms backoff (attempt ${consecutiveFailuresRef.current}/${MAX_RECOGNITION_RETRIES})`);
      scheduleListeningRestart(backoff);
    }
  };

  const handleUserUtterance = async (userText: string) => {
    addDebugLog('handleUserUtterance', `captured: "${userText}" (isResponding=${isRespondingRef.current})`);
    console.log("[Voice:Handoff] handleUserUtterance triggered with text:", userText);
    if (!userText.trim() || isRespondingRef.current) {
      addDebugLog('handleUserUtterance', `Ignored: empty or already responding`);
      console.log("[Voice:Handoff] Utterance discarded: empty or isRespondingRef is true");
      return;
    }
    isRespondingRef.current = true;

    // 1. Render user speech in transcript UI
    const userItem: TranscriptItem = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: userText,
      timestamp: Date.now(),
    };
    setTranscripts(prev => [...prev.slice(-20), userItem]);
    persistVoiceMessage('user', userText);

    // 2. Render Sierra placeholder in transcript UI
    const sierraId = 'sierra-' + (Date.now() + 1);
    setTranscripts(prev => [...prev, {
      id: sierraId,
      sender: 'sierra',
      text: '',
      timestamp: Date.now(),
    }]);

    let accumulatedText = '';

    // Stop and fully release STT while model is thinking/speaking to avoid picking up speaker output
    console.log("[Voice:handleUserUtterance] Stopping and releasing STT before streamChat");
    await stopSpeechToText();

    try {
      const history = transcriptsRef.current.slice(-6).map(t => ({
        role: t.sender === 'user' ? 'user' : 'model',
        content: t.text,
      }));

      // 3. Send captured transcript to native direct Gemini streamChat
      addDebugLog('streamChat', `called with prompt: "${userText}"`);
      console.log("[Voice:streamChat] Initiating direct streamChat call with prompt:", userText);
      await streamChat({
        messages: [
          ...history,
          { role: 'user', content: userText }
        ],
        systemInstruction: `${SIERRA_CORE_PERSONA}\n\nYou are Sierra in Continuous Voice Chat. Speak warmly, directly, and concisely (1-2 short natural sentences). Do not use markdown, bullet points, asterisks, or formatting because your response is being spoken aloud through Text-to-Speech.`,
      }, {
        onChunk: (chunk: string) => {
          accumulatedText += chunk;
          if (accumulatedText.length === chunk.length) {
            addDebugLog('streamChat:Chunk', `First chunk received (${chunk.length} chars)`);
          }
          console.log("[Voice:streamChat:Chunk] Chunk received length:", chunk.length);
          // Render streamed response into transcript UI
          setTranscripts(prev => prev.map(item => item.id === sierraId ? { ...item, text: accumulatedText } : item));
        },
        onDone: async () => {
          addDebugLog('streamChat:Done', `Completed (${accumulatedText.length} chars)`);
          console.log("[Voice:streamChat:Done] Stream finished successfully. Full text:", accumulatedText.trim());
          isRespondingRef.current = false;
          if (accumulatedText.trim()) {
            persistVoiceMessage('sierra', accumulatedText.trim());
            // 4. Trigger Text-to-Speech playback for the response (releases STT and enforces cooldown)
            console.log("[Voice:playTextToSpeech] Triggering TTS for model response");
            await playTextToSpeech(accumulatedText.trim());
          } else {
            console.log("[Voice:streamChat:Done] Response text was empty, resuming listening");
            if (isActiveRef.current && mode === 'continuous') {
              scheduleListeningRestart(PLAYBACK_COOLDOWN_MS);
            }
          }
        },
        onError: (err: Error) => {
          addDebugLog('streamChat:Error', `${err.message}`);
          isRespondingRef.current = false;
          console.error("[Voice:streamChat:Error] Stream chat error occurred:", err);
          toast.error(`Voice error: ${err.message}`);
          if (isActiveRef.current && mode === 'continuous') {
            scheduleListeningRestart(PLAYBACK_COOLDOWN_MS);
          }
        }
      });
    } catch (err: any) {
      addDebugLog('streamChat:Catch', `${err.message}`);
      isRespondingRef.current = false;
      console.error("[Voice:streamChat:Catch] Failed to generate voice response:", err);
      toast.error(`Failed to generate voice response: ${err.message}`);
      if (isActiveRef.current && mode === 'continuous') {
        scheduleListeningRestart(PLAYBACK_COOLDOWN_MS);
      }
    }
  };

  const startSession = async () => {
    const sessionStartTime = new Date().toISOString();
    addDebugLog('Session', `Starting voice session... [${sessionStartTime}]`);
    console.log(`[Session] Starting voice session... [${sessionStartTime}]`);
    setIsConnecting(true);
    setConnectionError(null);

    try {
      if (!Capacitor.isNativePlatform()) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              channelCount: 1,
              sampleRate: 16000,
            },
          });
          mediaStreamRef.current = stream;
          await startAudioCapture();
        } catch (micErr: any) {
          if (micErr.name === 'NotAllowedError' || micErr.name === 'PermissionDeniedError') {
            throw new Error("Microphone access denied. Please allow microphone permissions in your browser or device settings.");
          }
          throw new Error("Unable to access microphone: " + (micErr.message || "Device error"));
        }
      } else {
        // Native Android: CapSpeechRecognition manages microphone hardware directly.
        // Stop any active Web Audio capture so Android SpeechRecognizer has exclusive mic access.
        stopAudioCapture();
      }

      setIsActive(true);
      isActiveRef.current = true;
      setIsConnecting(false);
      setConnectionError(null);
      consecutiveFailuresRef.current = 0;
      addDebugLog('Session', 'Session active, starting speech-to-text');
      startSpeechToText();
      toast.success("Sierra is listening!");
    } catch (error: any) {
      addDebugLog('Session:Error', error.message || 'Failed to start session');
      console.error("Failed to start voice session:", error);
      setIsConnecting(false);
      setConnectionError(error.message || "Failed to establish voice connection.");
      toast.error(error.message || "Failed to start live voice session");
      stopAudioCapture();
    }
  };

  const stopSession = () => {
    addDebugLog('Session', 'Session stopped');
    setIsActive(false);
    isActiveRef.current = false;
    isRespondingRef.current = false;
    setIsConnecting(false);
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    setUserSpeechDetected(false);
    consecutiveFailuresRef.current = 0;
    isStartingRef.current = false;
    currentTranscriptRef.current = '';

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
      recognitionTimeoutRef.current = null;
    }

    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {
        // ignore
      }
      sessionRef.current = null;
    }

    stopAudioCapture();
    stopSpeechToText();
    teardownNativeListeners();
    stopPlayback();
  };

  const setupNativeListeners = async () => {
    if (nativeListenersAttachedRef.current) {
      return;
    }

    addDebugLog('STT:Listeners', 'Setting up native partialResults and listeningState listeners...');
    console.log("[Native STT:Listeners] Setting up native partialResults and listeningState listeners...");

    try {
      // 1. partialResults listener
      nativeListenerRef.current = await withNativeTimeout(
        CapSpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
          const cycleId = currentCycleIdRef.current;
          addDebugLog('partialResults', `[Cycle #${cycleId}] matches: ${JSON.stringify(data?.matches)}`);
          console.log(`[Native STT:partialResults:Cycle#${cycleId}] Matches:`, data?.matches);

          if (isSpeakingRef.current || isRespondingRef.current) {
            addDebugLog('partialResults', `[Cycle #${cycleId}] Ignored: Sierra currently speaking/responding`);
            return;
          }

          if (data?.matches && Array.isArray(data.matches) && data.matches.length > 0) {
            const topMatch = data.matches[0].trim();
            if (topMatch) {
              currentTranscriptRef.current = topMatch;
              setUserSpeechDetected(true);
              consecutiveFailuresRef.current = 0;
              addDebugLog('partialResults:Buffer', `[Cycle #${cycleId}] Buffer updated: "${topMatch}"`);
              console.log(`[Native STT:Buffer:Cycle#${cycleId}] "${topMatch}"`);

              // Debounce silence: after 1200ms of no further speech updates, commit the utterance
              if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
              }
              silenceTimerRef.current = setTimeout(() => {
                addDebugLog('STT:SilenceDebounce', `[Cycle #${cycleId}] Silence debounce fired (1200ms), committing: "${topMatch}"`);
                console.log(`[Native STT:SilenceDebounce:Cycle#${cycleId}] Committing utterance...`);
                commitCurrentUtterance();
              }, 1200);
            }
          }
        }),
        2000,
        null,
        'CapSpeechRecognition.addListener("partialResults")'
      );

      // 2. listeningState listener
      nativeStateListenerRef.current = await withNativeTimeout(
        CapSpeechRecognition.addListener('listeningState', (data: { status: 'started' | 'stopped'; error?: string; errorCode?: number }) => {
          const cycleId = currentCycleIdRef.current;
          addDebugLog('listeningState', `[Cycle #${cycleId}] status: "${data?.status}", payload: ${JSON.stringify(data)}, buffer: "${currentTranscriptRef.current}"`);
          console.log(`[Native STT:listeningState:Cycle#${cycleId}] status=${data?.status}`, data);

          if (data?.status === 'started') {
            isNativeListeningRef.current = true;
          } else if (data?.status === 'stopped') {
            isNativeListeningRef.current = false;
            if (data?.error) {
              addDebugLog('STT:NativeError', `[Cycle #${cycleId}] Native recognizer reported: "${data.error}" (code: ${data.errorCode})`);
              console.warn(`[Native STT:NativeError:Cycle#${cycleId}]`, data.error, data.errorCode);
            }
            if (currentTranscriptRef.current.trim()) {
              commitCurrentUtterance();
            } else {
              handleSilenceOrEmpty();
            }
          }
        }),
        2000,
        null,
        'CapSpeechRecognition.addListener("listeningState")'
      );

      nativeListenersAttachedRef.current = true;
      addDebugLog('STT:Listeners', 'Native listeners active and ready');
      console.log("[Native STT:Listeners] Native listeners active and ready");
    } catch (err: any) {
      nativeListenersAttachedRef.current = false;
      addDebugLog('STT:Listeners:Error', `Listener registration error: ${err?.message || String(err)}`);
      console.error("[Native STT:Listeners:Error] Registration error:", err);
    }
  };

  const startSpeechToText = async () => {
    if (!isActiveRef.current || isSpeakingRef.current || isRespondingRef.current) {
      console.log("[Native STT] startSpeechToText aborted: active=", isActiveRef.current, "speaking=", isSpeakingRef.current, "responding=", isRespondingRef.current);
      return;
    }

    // 1. Native Capacitor Speech Recognition on Android / iOS
    if (Capacitor.isNativePlatform()) {
      if (isStartingRef.current || isNativeListeningRef.current) {
        addDebugLog('STT:Start', `Already starting/listening (starting=${isStartingRef.current}, listening=${isNativeListeningRef.current}), skipping duplicate start`);
        console.log(`[Native STT] Duplicate start prevented (starting=${isStartingRef.current}, listening=${isNativeListeningRef.current})`);
        return;
      }
      isStartingRef.current = true;

      try {
        addDebugLog('STT:Start', 'Checking availability and permissions...');
        console.log("[Native STT:Start] Checking speech recognition availability...");
        const available = await withNativeTimeout(
          CapSpeechRecognition.available(),
          2000,
          { available: false },
          'CapSpeechRecognition.available()'
        );
        addDebugLog('STT:Start', `available: ${available?.available}`);
        if (!available?.available) {
          addDebugLog('STT:Start', 'Native speech recognition unavailable');
          console.warn("[Native STT:Start] Native speech recognition unavailable on device");
          toast.error("Device speech recognition engine not available");
          isStartingRef.current = false;
          return;
        }

        const permStatus = await withNativeTimeout(
          CapSpeechRecognition.checkPermissions(),
          2000,
          { speechRecognition: 'prompt' as const },
          'CapSpeechRecognition.checkPermissions()'
        );
        addDebugLog('STT:Start', `permStatus: ${JSON.stringify(permStatus)}`);
        if (permStatus?.speechRecognition !== 'granted') {
          addDebugLog('STT:Start', 'Requesting speech recognition permissions...');
          console.log("[Native STT:Start] Requesting speech recognition permissions...");
          const reqStatus = await withNativeTimeout(
            CapSpeechRecognition.requestPermissions(),
            15000,
            { speechRecognition: 'denied' as const },
            'CapSpeechRecognition.requestPermissions()'
          );
          addDebugLog('STT:Start', `reqStatus: ${JSON.stringify(reqStatus)}`);
          if (reqStatus?.speechRecognition !== 'granted') {
            addDebugLog('STT:Start', 'Microphone permission denied by user');
            console.warn("[Native STT:Start] Microphone permission denied by user");
            toast.error("Microphone permission required for speech recognition");
            isStartingRef.current = false;
            return;
          }
        }

        // Setup persistent listeners
        await setupNativeListeners();

        // Increment cycle session identifier and clear buffer
        const cycleId = ++currentCycleIdRef.current;
        currentTranscriptRef.current = '';

        // Recognition cycle timeout (12 seconds)
        if (recognitionTimeoutRef.current) {
          clearTimeout(recognitionTimeoutRef.current);
        }
        recognitionTimeoutRef.current = setTimeout(async () => {
          recognitionTimeoutRef.current = null;
          addDebugLog('STT:Timeout', `[Cycle #${cycleId}] 12s cycle timeout reached (buffer: "${currentTranscriptRef.current}")`);
          console.warn(`[Native STT:Timeout:Cycle#${cycleId}] 12s recognition cycle timeout reached`);
          if (currentTranscriptRef.current.trim()) {
            commitCurrentUtterance();
          } else {
            if (isNativeListeningRef.current) {
              try {
                await withNativeTimeout(
                  CapSpeechRecognition.stop(),
                  1500,
                  undefined,
                  'CapSpeechRecognition.stop()'
                );
              } catch (_) {}
            }
            handleSilenceOrEmpty();
          }
        }, RECOGNITION_TIMEOUT_MS);

        const startTime = Date.now();
        addDebugLog('STT:Start', `[Cycle #${cycleId}] Invoking CapSpeechRecognition.start({ language: "en-US", partialResults: true })...`);
        console.log(`[Native STT:Start:Cycle#${cycleId}] Invoking start...`);

        let result: any = null;
        try {
          result = await CapSpeechRecognition.start({
            language: 'en-US',
            maxResults: 1,
            prompt: '',
            popup: false,
            partialResults: true,
          });
          const elapsed = Date.now() - startTime;
          addDebugLog('STT:Start', `[Cycle #${cycleId}] CapSpeechRecognition.start resolved in ${elapsed}ms with: ${JSON.stringify(result)}`);
          console.log(`[Native STT:Start:Cycle#${cycleId}] Resolved in ${elapsed}ms:`, result);
        } catch (startErr: any) {
          const elapsed = Date.now() - startTime;
          addDebugLog('STT:Start', `[Cycle #${cycleId}] CapSpeechRecognition.start rejected in ${elapsed}ms: ${startErr?.message || JSON.stringify(startErr)}`);
          console.error(`[Native STT:Start:Cycle#${cycleId}] Rejected in ${elapsed}ms:`, startErr);
          throw startErr;
        }

        isNativeListeningRef.current = true;
        isStartingRef.current = false;

        // If the platform returns matches directly in the start resolution
        if (result?.matches && Array.isArray(result.matches) && result.matches.length > 0 && result.matches[0].trim()) {
          addDebugLog('STT:Start', `[Cycle #${cycleId}] Direct matches returned on resolve: "${result.matches[0]}"`);
          console.log(`[Native STT:Start:Cycle#${cycleId}] Direct matches:`, result.matches[0]);
          currentTranscriptRef.current = result.matches[0].trim();
        }

        return;
      } catch (nativeErr: any) {
        isStartingRef.current = false;
        if (recognitionTimeoutRef.current) {
          clearTimeout(recognitionTimeoutRef.current);
          recognitionTimeoutRef.current = null;
        }
        isNativeListeningRef.current = false;
        setUserSpeechDetected(false);
        addDebugLog('STT:Error', `Exception: ${nativeErr?.message || JSON.stringify(nativeErr)}`);
        console.error("[Native STT:Error] CapSpeechRecognition.start caught exception:", nativeErr);

        if (currentTranscriptRef.current.trim()) {
          console.log("[Native STT:Error] Rescuing buffered transcript after error:", currentTranscriptRef.current);
          commitCurrentUtterance();
          return;
        }

        if (isActiveRef.current && !isSpeakingRef.current && !isRespondingRef.current && mode === 'continuous') {
          consecutiveFailuresRef.current++;
          console.log(`[Native STT:Error] Retry counter: ${consecutiveFailuresRef.current}/${MAX_RECOGNITION_RETRIES}`);
          if (consecutiveFailuresRef.current >= MAX_RECOGNITION_RETRIES) {
            console.warn("[Native STT:Error] Continuous recognition halted: max error retries reached.");
            toast.error("Speech recognition paused due to repeated device errors.");
            return;
          }
          const backoff = Math.min(800 * consecutiveFailuresRef.current, 3000);
          scheduleListeningRestart(backoff);
        }
        return;
      }
    }

    // 2. Web browser fallback for development environment
    console.log("[Web STT:Start] Initializing browser SpeechRecognition fallback");
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("[Web STT:Start] Speech recognition is not supported in this environment");
      return;
    }

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.abort();
      } catch (_) {}
      speechRecognitionRef.current = null;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        if (isSpeakingRef.current || isRespondingRef.current) return;

        let interimText = '';
        let finalPhrase = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalPhrase += text;
          } else {
            interimText += text;
          }
        }

        if (interimText.trim()) {
          setUserSpeechDetected(true);
        }

        if (finalPhrase.trim()) {
          const userText = finalPhrase.trim();
          addDebugLog('WebSTT:Result', `Captured final phrase: "${userText}"`);
          console.log("[Web STT:Result] Captured final phrase:", userText);
          setUserSpeechDetected(false);
          consecutiveFailuresRef.current = 0;
          console.log("[Web STT:Handoff] Passing to handleUserUtterance:", userText);
          handleUserUtterance(userText);
        }
      };

      recognition.onerror = (event: any) => {
        addDebugLog('WebSTT:Error', `error: ${event.error}`);
        if (event.error === 'no-speech' || event.error === 'audio-capture') {
          return;
        }
        console.warn("[Web STT:Error] Browser speech recognition error:", event.error);
      };

      recognition.onend = () => {
        console.log("[Web STT:End] Browser speech recognition ended");
        if (isActiveRef.current && !isSpeakingRef.current && !isRespondingRef.current && mode === 'continuous') {
          scheduleListeningRestart(400);
        }
      };

      recognition.start();
      speechRecognitionRef.current = recognition;
    } catch (e) {
      console.warn("[Web STT:Error] Web Speech recognition STT init error:", e);
    }
  };

  const teardownNativeListeners = async () => {
    if (nativeListenerRef.current) {
      try {
        await withNativeTimeout(nativeListenerRef.current.remove(), 1000, undefined, 'nativeListener.remove()');
      } catch (_) {}
      nativeListenerRef.current = null;
    }
    if (nativeStateListenerRef.current) {
      try {
        await withNativeTimeout(nativeStateListenerRef.current.remove(), 1000, undefined, 'nativeStateListener.remove()');
      } catch (_) {}
      nativeStateListenerRef.current = null;
    }
    nativeListenersAttachedRef.current = false;
  };

  const stopSpeechToText = async () => {
    console.log("[Native STT:Stop] stopSpeechToText called");
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
      recognitionTimeoutRef.current = null;
    }

    if (Capacitor.isNativePlatform()) {
      isNativeListeningRef.current = false;
      isStartingRef.current = false;
      setUserSpeechDetected(false);
      try {
        await withNativeTimeout(CapSpeechRecognition.stop(), 1500, undefined, 'CapSpeechRecognition.stop()');
      } catch (_) {}
      console.log("[Native STT:Stop] Native recognizer stopped");
      return;
    }

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.abort();
      } catch (e) {
        // ignore
      }
      speechRecognitionRef.current = null;
    }
  };

  const startAudioCapture = async () => {
    try {
      const stream = mediaStreamRef.current || await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000,
        },
      });
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      // ScriptProcessorNode buffers 4096 mono frames at 16000Hz for Gemini Live PCM
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        // Push mode check
        if (mode === 'push' && !isPushing) {
          setUserSpeechDetected(false);
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        let sum = 0;
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          sum += Math.abs(sample);
          pcmData[i] = sample * 0x7FFF;
        }

        const avg = sum / inputData.length;
        setUserSpeechDetected(avg > 0.02);

        // Acoustic Echo Guard: If Sierra is speaking, suppress mic unless user speaks loudly (barge-in)
        if (isSpeakingRef.current && avg < 0.08) {
          return;
        }

        const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));

        if (sessionRef.current) {
          try {
            sessionRef.current.sendRealtimeInput({
              audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' },
            });
          } catch (sendErr) {
            console.warn("Failed sending audio chunk:", sendErr);
          }
        }
      };

      // CRITICAL FIX: Connect to an isolated zero-gain node so microphone audio
      // NEVER plays back into the room through the speakers, avoiding any audio feedback loop!
      const muteNode = audioCtx.createGain();
      muteNode.gain.setValueAtTime(0, audioCtx.currentTime);

      source.connect(processor);
      processor.connect(muteNode);
      muteNode.connect(audioCtx.destination);
    } catch (error: any) {
      console.error("Audio capture initialization error:", error);
      setConnectionError("Microphone hardware error: " + (error.message || "Failed to initialize audio."));
    }
  };

  const stopAudioCapture = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        // ignore
      }
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  };

  // CRITICAL FIX: Single persistent AudioContext and timeline queue to eliminate AudioContext leaks and freezing
  const playAudio = async (base64Data: string) => {
    setIsSpeaking(true);
    isSpeakingRef.current = true;

    try {
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const pcmData = new Int16Array(bytes.buffer);
      const floatData = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        floatData[i] = pcmData[i] / 0x7FFF;
      }

      // Re-use single persistent playback AudioContext
      if (!playbackContextRef.current || playbackContextRef.current.state === 'closed') {
        playbackContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const audioCtx = playbackContextRef.current;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const buffer = audioCtx.createBuffer(1, floatData.length, 24000);
      buffer.getChannelData(0).set(floatData);

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);

      activeSourcesRef.current.push(source);

      // Schedule continuously on timeline for gap-free playback
      const startTime = Math.max(audioCtx.currentTime, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + buffer.duration;

      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
        if (activeSourcesRef.current.length === 0) {
          setIsSpeaking(false);
          isSpeakingRef.current = false;
        }
      };
    } catch (playbackErr) {
      console.error("Audio playback error:", playbackErr);
      setIsSpeaking(false);
      isSpeakingRef.current = false;
    }
  };

  const stopPlayback = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
    activeSourcesRef.current.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // ignore
      }
    });
    activeSourcesRef.current = [];
    nextPlayTimeRef.current = 0;
    setIsSpeaking(false);
    isSpeakingRef.current = false;
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-6 bg-zinc-950 relative overflow-hidden font-sans">
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none">
        <div className={cn(
          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full blur-[140px] transition-all duration-1000",
          isActive ? (isSpeaking ? "bg-purple-600/25 scale-110" : "bg-indigo-600/15 scale-100") : "bg-zinc-900/20 scale-90"
        )} />
      </div>

      {/* Header Bar */}
      <div className="max-w-md w-full relative z-10 text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">Sierra Neural Voice</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-100">Natural Voice</h1>
        <p className="text-zinc-400 text-xs sm:text-sm">Real-time, zero-latency natural spoken conversation.</p>

        {/* Voice & Mode Bar */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {/* Voice Character Select */}
          <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 text-xs">
            <span className="text-[10px] font-bold text-zinc-500 uppercase px-2">Voice:</span>
            {(['Aoede', 'Zephyr', 'Kore', 'Puck'] as const).map(v => (
              <button
                key={v}
                onClick={() => setSelectedVoice(v)}
                disabled={isActive}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
                  selectedVoice === v ? "bg-purple-600/30 text-purple-300 border border-purple-500/40" : "text-zinc-400 hover:text-zinc-200",
                  isActive ? "opacity-50 cursor-not-allowed" : ""
                )}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Mode Switch */}
          <div className="bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 flex text-xs">
            <button
              onClick={() => setMode('continuous')}
              className={cn(
                "px-3 py-1 rounded-lg font-bold uppercase tracking-wider transition-all text-[11px]",
                mode === 'continuous' ? "bg-zinc-800 text-white shadow-inner" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              Continuous
            </button>
            <button
              onClick={() => setMode('push')}
              className={cn(
                "px-3 py-1 rounded-lg font-bold uppercase tracking-wider transition-all text-[11px]",
                mode === 'push' ? "bg-zinc-800 text-white shadow-inner" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              Push-to-Talk
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Mic Orb */}
      <div className="relative flex flex-col items-center justify-center my-6 z-10">
        <AnimatePresence mode="wait">
          {(isActive && (mode === 'continuous' || isPushing)) && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    scale: isSpeaking ? [1, 1.8, 1] : (userSpeechDetected ? [1, 1.4, 1] : [1, 1.2, 1]),
                    opacity: isSpeaking ? [0.4, 0, 0.4] : [0.2, 0, 0.2],
                  }}
                  transition={{
                    duration: isSpeaking ? 1.4 : 2.0,
                    repeat: Infinity,
                    delay: i * 0.4,
                  }}
                  className={cn(
                    "absolute w-44 h-44 rounded-full border",
                    isSpeaking ? "border-purple-500/50 bg-purple-500/5" : "border-indigo-500/30"
                  )}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onMouseDown={() => mode === 'push' && setIsPushing(true)}
          onMouseUp={() => mode === 'push' && setIsPushing(false)}
          onMouseLeave={() => mode === 'push' && setIsPushing(false)}
          onTouchStart={() => mode === 'push' && setIsPushing(true)}
          onTouchEnd={() => mode === 'push' && setIsPushing(false)}
          onClick={() => mode === 'continuous' && (isActive ? stopSession() : startSession())}
          disabled={isConnecting}
          aria-label={isActive ? "End voice session" : "Start voice session"}
          className={cn(
            "w-36 h-36 rounded-full flex flex-col items-center justify-center transition-all duration-500 relative z-20 shadow-2xl focus:outline-none",
            isActive 
              ? (isSpeaking 
                  ? "bg-purple-950/80 border-2 border-purple-400 text-purple-300 shadow-purple-500/30 scale-105" 
                  : (userSpeechDetected || isPushing
                      ? "bg-zinc-900 border-2 border-indigo-400 text-indigo-300 shadow-indigo-500/20" 
                      : "bg-zinc-900 border border-zinc-700 text-zinc-300"))
              : "bg-zinc-900 border border-zinc-800 text-zinc-500 hover:border-purple-500/50 hover:text-purple-400"
          )}
        >
          {isConnecting ? (
            <Loader2 className="w-12 h-12 animate-spin text-purple-400" />
          ) : isActive ? (
            <>
              {isSpeaking ? (
                <Volume2 className="w-12 h-12 animate-pulse text-purple-400" />
              ) : (
                <Mic className={cn("w-12 h-12", userSpeechDetected ? "text-indigo-400 animate-pulse" : "text-zinc-300")} />
              )}
              <span className="text-[10px] font-bold uppercase tracking-wider mt-1 text-zinc-400">
                {isSpeaking ? "Speaking" : (userSpeechDetected ? "Hearing you" : "Listening")}
              </span>
            </>
          ) : (
            <>
              <MicOff className="w-12 h-12 text-zinc-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider mt-1 text-zinc-500">Tap to Start</span>
            </>
          )}
        </button>

        {/* Connection Error Notification */}
        {connectionError && (
          <div className="mt-4 p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-300 text-xs flex items-center gap-2 max-w-sm">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <p className="flex-1">{connectionError}</p>
            <Button size="sm" variant="ghost" onClick={startSession} className="h-6 px-2 text-xs text-red-200 hover:bg-red-900/50">
              <RefreshCw className="w-3 h-3 mr-1" /> Retry
            </Button>
          </div>
        )}
      </div>

      {/* Live Transcript & Conversation History Feed */}
      <div className="max-w-md w-full relative z-10 space-y-3">
        {mode === 'push' && !isActive && (
          <div className="text-center">
            <Button 
              onClick={startSession}
              variant="outline"
              className="border-zinc-800 text-zinc-300 hover:bg-zinc-900 rounded-xl px-6 py-5 font-semibold text-xs uppercase tracking-wider"
            >
              Start Sierra Voice Channel
            </Button>
          </div>
        )}

        {/* Live Subtitle Transcript Box */}
        <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-md max-h-48 overflow-y-auto space-y-2">
          <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest pb-1 border-b border-zinc-800/50">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3 text-purple-400" />
              <span>Live Dialogue & Transcripts</span>
            </div>
            {isActive && (
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live Link Active
              </span>
            )}
          </div>

          {transcripts.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-4 italic">
              {isActive ? "Speak naturally. Real-time words and Sierra's answers will appear here." : "Start session to begin speaking with Sierra."}
            </p>
          ) : (
            <div className="space-y-2">
              {transcripts.map(t => (
                <div 
                  key={t.id} 
                  className={cn(
                    "text-xs p-2.5 rounded-xl transition-all",
                    t.sender === 'user' 
                      ? "bg-zinc-800/60 text-zinc-200 border border-zinc-700/40 ml-4" 
                      : "bg-purple-950/40 text-purple-200 border border-purple-800/40 mr-4"
                  )}
                >
                  <span className="text-[10px] font-extrabold block uppercase tracking-wider text-zinc-400 mb-0.5">
                    {t.sender === 'user' ? 'You' : 'Sierra'}
                  </span>
                  <p className="leading-relaxed">{t.text}</p>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          )}
        </div>

        {/* Real-Time On-Screen Pipeline Diagnostics Output */}
        <div className="bg-zinc-950/90 border border-amber-500/40 rounded-2xl p-3 shadow-xl backdrop-blur-md space-y-2.5 text-left">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider pb-1.5 border-b border-zinc-800">
            <div className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Pipeline Stage Debug Output</span>
              <span className="text-zinc-500 font-mono text-[9px]">({debugLogs.length} events)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFallbackLogText(formatDebugLogs(debugLogs));
                  setIsFallbackModalOpen(true);
                }}
                disabled={debugLogs.length === 0}
                className="text-[10px] text-zinc-400 hover:text-zinc-200 underline font-sans flex items-center gap-1 disabled:opacity-30 disabled:no-underline"
              >
                <FileText className="w-3 h-3" />
                <span>View Text</span>
              </button>
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                disabled={debugLogs.length === 0}
                className="text-[10px] text-zinc-400 hover:text-red-300 underline font-sans disabled:opacity-30 disabled:no-underline"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="font-mono text-[10.5px] leading-relaxed max-h-40 overflow-y-auto space-y-1 pr-1 bg-black/40 p-2 rounded-xl border border-zinc-900">
            {debugLogs.length === 0 ? (
              <p className="text-zinc-500 italic py-2 text-center font-sans text-xs">
                No pipeline events logged yet. Tap the orb to trigger speech recognition.
              </p>
            ) : (
              debugLogs.map((log) => (
                <div key={log.id} className="border-b border-zinc-900/80 pb-0.5">
                  <span className="text-zinc-500">[{log.time}]</span>{' '}
                  <span className={cn(
                    "font-bold",
                    log.stage.includes('Error') || log.stage.includes('Catch') ? "text-red-400" :
                    log.stage.includes('partialResults') ? "text-cyan-300" :
                    log.stage.includes('listeningState') ? "text-yellow-300" :
                    log.stage.includes('commit') ? "text-emerald-400" :
                    log.stage.includes('streamChat') ? "text-purple-300" : "text-amber-300"
                  )}>
                    [{log.stage}]
                  </span>{' '}
                  <span className="text-zinc-300 break-all">{log.detail}</span>
                </div>
              ))
            )}
            <div ref={debugScrollRef} />
          </div>

          {/* Clear confirmation prompt */}
          {showClearConfirm && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-red-950/70 border border-red-500/50 rounded-xl text-xs">
              <div className="flex items-center gap-1.5 text-red-200 font-medium">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>Clear all {debugLogs.length} events?</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearConfirm}
                  className="min-h-[48px] px-3.5 py-2 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-lg font-semibold text-xs flex items-center justify-center transition-all active:scale-95 shadow-sm"
                >
                  Yes, Clear
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="min-h-[48px] px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-750 text-zinc-300 rounded-lg text-xs flex items-center justify-center transition-all active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Diagnostic Export and Management Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              onClick={() => copyDebugLogs()}
              disabled={debugLogs.length === 0}
              className={cn(
                "min-h-[48px] px-3 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm",
                debugLogs.length === 0
                  ? "bg-zinc-900/50 border border-zinc-800 text-zinc-600 cursor-not-allowed"
                  : "bg-amber-500/20 hover:bg-amber-500/30 active:bg-amber-500/40 border border-amber-500/50 text-amber-300"
              )}
              title="Copy all debug events to clipboard"
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span className="text-emerald-300">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>Copy Debug Log</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => copyDebugLogs(20)}
              disabled={debugLogs.length === 0}
              className={cn(
                "min-h-[48px] px-3 py-2.5 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all active:scale-95",
                debugLogs.length === 0
                  ? "bg-zinc-900/50 border border-zinc-800 text-zinc-600 cursor-not-allowed"
                  : "bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-750 border border-zinc-700/60 text-zinc-200"
              )}
              title="Copy the most recent 20 events"
            >
              <FileText className="w-4 h-4 shrink-0 text-zinc-400" />
              <span>Copy Last 20</span>
            </button>

            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              disabled={debugLogs.length === 0}
              className={cn(
                "min-h-[48px] px-3 py-2.5 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all active:scale-95",
                debugLogs.length === 0
                  ? "bg-zinc-900/50 border border-zinc-800 text-zinc-600 cursor-not-allowed"
                  : "bg-zinc-900 hover:bg-red-950/40 active:bg-red-950/60 border border-zinc-800 hover:border-red-500/40 text-zinc-400 hover:text-red-300"
              )}
              title="Clear all recorded events"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>Clear Debug Log</span>
            </button>
          </div>
        </div>

        {/* Selectable-Text Fallback Modal Dialog */}
        {isFallbackModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
          >
            <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl w-full max-w-lg p-4 shadow-2xl flex flex-col max-h-[85vh] space-y-3 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Copy className="w-4 h-4 text-amber-400" />
                    Diagnostic Debug Log
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Select all and copy to paste into ChatGPT:
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFallbackModalOpen(false)}
                  className="min-h-[48px] min-w-[48px] p-2 flex items-center justify-center text-zinc-400 hover:text-white rounded-lg active:bg-zinc-800"
                  aria-label="Close dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <textarea
                ref={fallbackTextareaRef}
                readOnly
                value={fallbackLogText}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                className="flex-1 w-full min-h-[220px] font-mono text-[11px] leading-relaxed bg-black/90 text-zinc-200 p-3 rounded-xl border border-zinc-800 focus:outline-none focus:ring-1 focus:ring-amber-500 select-all resize-none"
              />

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (fallbackTextareaRef.current) {
                      fallbackTextareaRef.current.focus();
                      fallbackTextareaRef.current.select();
                      try {
                        document.execCommand('copy');
                        toast.success("Debug log copied. Paste it into ChatGPT.");
                      } catch (_) {
                        toast.info("Text selected! Use your device's copy option.");
                      }
                    }
                  }}
                  className="min-h-[48px] px-4 py-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-semibold text-xs rounded-xl flex items-center gap-2 active:scale-95 transition-all shadow-sm"
                >
                  <Copy className="w-4 h-4" />
                  Select & Copy All
                </button>
                <button
                  type="button"
                  onClick={() => setIsFallbackModalOpen(false)}
                  className="min-h-[48px] px-4 py-2 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-750 text-zinc-200 text-xs font-medium rounded-xl active:scale-95 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-zinc-500">
          {isConnecting ? "Connecting to Sierra neural model..." : 
           isActive ? (
             mode === 'push' 
               ? (isPushing ? "Listening to your voice..." : "Hold the orb to speak, release to hear Sierra.") 
               : (isSpeaking ? "Sierra is speaking..." : "Listening continuously. Talk whenever you're ready.")
           ) : "Tap the orb above to begin a natural conversation."}
        </p>
      </div>
    </div>
  );
}
