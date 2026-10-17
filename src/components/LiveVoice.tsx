import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition as CapSpeechRecognition } from '@capacitor-community/speech-recognition';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Button } from './ui/button';
import { Mic, MicOff, Loader2, Sparkles, AlertCircle, RefreshCw, Volume2, MessageSquare } from 'lucide-react';
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
  const isNativeListeningRef = useRef<boolean>(false);
  const isSpeakingRef = useRef<boolean>(false);
  const isRespondingRef = useRef<boolean>(false);
  const isActiveRef = useRef<boolean>(false);
  const transcriptsRef = useRef<TranscriptItem[]>([]);

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

  const playTextToSpeech = (text: string) => {
    if (!text.trim()) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      if (isActiveRef.current && mode === 'continuous') {
        startSpeechToText();
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
        // Resume continuous listening after Sierra finishes speaking
        if (isActiveRef.current && mode === 'continuous') {
          startSpeechToText();
        }
      };

      utterance.onerror = (e) => {
        console.warn("TTS playback error:", e);
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        if (isActiveRef.current && mode === 'continuous') {
          startSpeechToText();
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch (ttsErr) {
      console.warn("TTS execution error:", ttsErr);
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      if (isActiveRef.current && mode === 'continuous') {
        startSpeechToText();
      }
    }
  };

  const handleUserUtterance = async (userText: string) => {
    if (!userText.trim() || isRespondingRef.current) return;
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

    // Stop STT while model is thinking/speaking to avoid picking up speaker output
    stopSpeechToText();

    try {
      const history = transcriptsRef.current.slice(-6).map(t => ({
        role: t.sender === 'user' ? 'user' : 'model',
        content: t.text,
      }));

      // 3. Send captured transcript to native direct Gemini streamChat
      await streamChat({
        messages: [
          ...history,
          { role: 'user', content: userText }
        ],
        systemInstruction: `${SIERRA_CORE_PERSONA}\n\nYou are Sierra in Continuous Voice Chat. Speak warmly, directly, and concisely (1-2 short natural sentences). Do not use markdown, bullet points, asterisks, or formatting because your response is being spoken aloud through Text-to-Speech.`,
      }, {
        onChunk: (chunk: string) => {
          accumulatedText += chunk;
          // Render streamed response into transcript UI
          setTranscripts(prev => prev.map(item => item.id === sierraId ? { ...item, text: accumulatedText } : item));
        },
        onDone: () => {
          isRespondingRef.current = false;
          if (accumulatedText.trim()) {
            persistVoiceMessage('sierra', accumulatedText.trim());
            // 4. Trigger Text-to-Speech playback for the response
            playTextToSpeech(accumulatedText.trim());
          } else {
            if (isActiveRef.current && mode === 'continuous') {
              startSpeechToText();
            }
          }
        },
        onError: (err: Error) => {
          isRespondingRef.current = false;
          console.error("Continuous voice stream error:", err);
          toast.error(`Voice error: ${err.message}`);
          if (isActiveRef.current && mode === 'continuous') {
            startSpeechToText();
          }
        }
      });
    } catch (err: any) {
      isRespondingRef.current = false;
      toast.error(`Failed to generate voice response: ${err.message}`);
      if (isActiveRef.current && mode === 'continuous') {
        startSpeechToText();
      }
    }
  };

  const startSession = async () => {
    setIsConnecting(true);
    setConnectionError(null);

    try {
      // 1. Request user microphone with hardware Acoustic Echo Cancellation enabled
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
      } catch (micErr: any) {
        if (micErr.name === 'NotAllowedError' || micErr.name === 'PermissionDeniedError') {
          throw new Error("Microphone access denied. Please allow microphone permissions in your browser or device settings.");
        }
        throw new Error("Unable to access microphone: " + (micErr.message || "Device error"));
      }

      // 2. Start audio capture for visual audio monitoring
      await startAudioCapture();

      // 3. Mark session active and start speech recognition
      setIsActive(true);
      isActiveRef.current = true;
      setIsConnecting(false);
      setConnectionError(null);
      startSpeechToText();
      toast.success("Sierra is listening!");
    } catch (error: any) {
      console.error("Failed to start voice session:", error);
      setIsConnecting(false);
      setConnectionError(error.message || "Failed to establish voice connection.");
      toast.error(error.message || "Failed to start live voice session");
      stopAudioCapture();
    }
  };

  const stopSession = () => {
    setIsActive(false);
    isActiveRef.current = false;
    isRespondingRef.current = false;
    setIsConnecting(false);
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    setUserSpeechDetected(false);

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
    stopPlayback();
  };

  const startSpeechToText = async () => {
    // 1. Native Capacitor Speech Recognition on Android / iOS
    if (Capacitor.isNativePlatform()) {
      try {
        const available = await CapSpeechRecognition.available();
        if (!available?.available) {
          console.warn("Native speech recognition not available on this device");
          toast.error("Device speech recognition engine not available");
          return;
        }

        const permStatus = await CapSpeechRecognition.checkPermissions();
        if (permStatus.speechRecognition !== 'granted') {
          const reqStatus = await CapSpeechRecognition.requestPermissions();
          if (reqStatus.speechRecognition !== 'granted') {
            toast.error("Microphone permission required for speech recognition");
            return;
          }
        }

        // Clean up previous listener
        if (nativeListenerRef.current) {
          try {
            await nativeListenerRef.current.remove();
          } catch (_) {}
          nativeListenerRef.current = null;
        }

        // Listen for partial results to update speech detection indicator
        nativeListenerRef.current = await CapSpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
          if (isSpeakingRef.current || isRespondingRef.current) return;
          if (data.matches && data.matches.length > 0 && data.matches[0].trim()) {
            setUserSpeechDetected(true);
          }
        });

        isNativeListeningRef.current = true;

        const result = await CapSpeechRecognition.start({
          language: 'en-US',
          maxResults: 1,
          prompt: '',
          popup: false,
          partialResults: true,
        });

        isNativeListeningRef.current = false;
        setUserSpeechDetected(false);

        const recognizedText = result?.matches?.[0] || '';
        if (recognizedText.trim() && !isSpeakingRef.current && !isRespondingRef.current) {
          handleUserUtterance(recognizedText.trim());
        } else {
          // If no utterance was recognized, restart listening in continuous mode
          if (isActiveRef.current && !isSpeakingRef.current && !isRespondingRef.current && mode === 'continuous') {
            startSpeechToText();
          }
        }
        return;
      } catch (nativeErr: any) {
        isNativeListeningRef.current = false;
        setUserSpeechDetected(false);
        console.warn("Capacitor speech recognition error:", nativeErr);
        if (isActiveRef.current && !isSpeakingRef.current && !isRespondingRef.current && mode === 'continuous') {
          setTimeout(() => {
            if (isActiveRef.current && !isSpeakingRef.current && !isRespondingRef.current) {
              startSpeechToText();
            }
          }, 400);
        }
        return;
      }
    }

    // 2. Web browser fallback for development environment
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition is not supported in this environment");
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
        // If Sierra is speaking or actively responding, suppress transcription
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
          setUserSpeechDetected(false);
          handleUserUtterance(userText);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'audio-capture') {
          return;
        }
        console.warn("Speech recognition error:", event.error);
      };

      recognition.onend = () => {
        // In continuous mode, if still active and not speaking, keep listening
        if (isActiveRef.current && !isSpeakingRef.current && !isRespondingRef.current && mode === 'continuous') {
          try {
            recognition.start();
          } catch (_) {}
        }
      };

      recognition.start();
      speechRecognitionRef.current = recognition;
    } catch (e) {
      console.warn("Speech recognition STT init error:", e);
    }
  };

  const stopSpeechToText = async () => {
    if (Capacitor.isNativePlatform()) {
      isNativeListeningRef.current = false;
      if (nativeListenerRef.current) {
        try {
          await nativeListenerRef.current.remove();
        } catch (_) {}
        nativeListenerRef.current = null;
      }
      try {
        await CapSpeechRecognition.stop();
      } catch (_) {}
      return;
    }

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
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
