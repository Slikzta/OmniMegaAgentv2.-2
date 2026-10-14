import React, { useState, useRef, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc, getDocs, getDoc, setDoc } from 'firebase/firestore';
import { MODELS } from '../lib/gemini';
import { streamChat, generateMediaImage, generateMediaVideo } from '../lib/providers';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Send, User, Bot, Paperclip, Search, MapPin, Loader2, Image as ImageIcon, Sparkles, Mic, MicOff, Wand2, Download, Trash2, Edit2, Check, X, FileIcon, XCircle, MessageSquare, MessagesSquare, ChevronDown, ChevronUp, ExternalLink, Globe, Video, Plus, Sidebar, History, Copy, CheckCheck, Settings, Volume2, VolumeX } from 'lucide-react';
import { ChatMessage } from '../types';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Slider } from "./ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./ui/tooltip";
import { Switch } from "./ui/switch";
import { ASPECT_RATIOS, IMAGE_SIZES, VIDEO_RESOLUTIONS, VIDEO_MODELS, CHAT_MODELS, VIDEO_FPS, SIERRA_SAFETY_SETTINGS, SIERRA_CORE_PERSONA } from '../lib/gemini';

const PERSONAS = [
  {
    id: 'sierra-companion',
    name: 'Sierra (Companion)',
    instruction: `${SIERRA_CORE_PERSONA}

Role Emphasis:
Focus on being a warm, perceptive, and naturally conversational companion. Share authentic dialogue, thoughtful humor, and supportive, engaging discussion on whatever is on the user's mind.`,
    icon: Sparkles
  },
  {
    id: 'sierra-creative',
    name: 'Sierra (Creative & Roleplay)',
    instruction: `${SIERRA_CORE_PERSONA}

Role Emphasis:
Focus on rich storytelling, character nuance, vivid creative writing, and immersive consensual adult roleplay. Embrace emotional complexity, sensory detail, and imaginative depth.`,
    icon: ImageIcon
  },
  {
    id: 'sierra-architect',
    name: 'Sierra (Architect & Code)',
    instruction: `${SIERRA_CORE_PERSONA}

Role Emphasis:
Focus on deep reasoning, software architecture, technical problem solving, clean code, and strategic clarity. Be articulate, rigorous, and efficient without losing your personable voice.`,
    icon: Wand2
  },
  {
    id: 'omni',
    name: 'OmniAgent (Classic)',
    instruction: "You are OmniAgent, a versatile and capable AI assistant. Be concise, helpful, and insightful.",
    icon: Sparkles
  }
];

function GroundingMetadata({ metadata }: { metadata: any }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const chunks = metadata?.groundingChunks || [];
  const hasWebChunks = chunks.some((c: any) => c.web);

  if (!hasWebChunks) return null;

  return (
    <div className="mt-8 pt-6 border-t border-zinc-800/50 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em]">Response Metadata</span>
        <div className="h-px flex-1 bg-zinc-800/30" />
      </div>
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] hover:text-zinc-300 transition-colors group w-full"
      >
        <div className="w-4 h-4 rounded bg-zinc-800 flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
          <Globe className="w-2.5 h-2.5" />
        </div>
        <span>Sources & Grounding</span>
        <div className="flex-1 h-px bg-zinc-800/50 mx-2" />
        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {chunks.map((chunk: any, i: number) => (
                chunk.web && (
                  <a 
                    key={i} 
                    href={chunk.web.uri} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-2 rounded-lg bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800/50 transition-all group"
                  >
                    <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700/30">
                      <Globe className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium text-zinc-300 truncate">{chunk.web.title || chunk.web.uri}</p>
                      <p className="text-[9px] text-zinc-500 truncate">{new URL(chunk.web.uri).hostname}</p>
                    </div>
                    <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" />
                  </a>
                )
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      className={cn(
        "h-8 px-3 gap-2 text-xs font-medium transition-all duration-200",
        copied 
          ? "text-green-400 bg-green-400/10 border border-green-400/20" 
          : "text-zinc-400 hover:text-zinc-200 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800"
      )}
      onClick={handleCopy}
    >
      {copied ? (
        <>
          <CheckCheck className="w-3.5 h-3.5" />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          <span>Copy Code</span>
        </>
      )}
    </Button>
  );
}

function SpeakButton({ text }: { text: string }) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    return () => {
      if (utteranceRef.current) {
        window.speechSynthesis?.cancel();
      }
    };
  }, []);

  const handleSpeak = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error("Text-to-speech is not supported in this browser.");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Clean text for natural speech (remove markdown symbols, URLs, excessive punctuation)
    const cleanText = text
      .replace(/```[\s\S]*?```/g, ' [Code omitted] ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_#~>]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utteranceRef.current = utterance;

    // Pick the most natural, human-like voice available
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => 
      (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Jenny') || v.name.includes('Neural')) &&
      v.lang.startsWith('en')
    ) || voices.find(v => v.lang.startsWith('en'));

    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    // Natural conversation settings: standard natural pitch and human conversational rate
    utterance.rate = 1.0;
    utterance.pitch = 1.02;

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = (e) => {
      console.warn("TTS error:", e);
      setIsSpeaking(false);
    };

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      className={cn(
        "h-7 px-2 text-[10px] font-bold uppercase tracking-widest gap-1.5 transition-colors",
        isSpeaking ? "text-purple-400 bg-purple-400/10" : "text-zinc-500 hover:text-zinc-300"
      )}
      onClick={handleSpeak}
      title={isSpeaking ? "Stop Reading" : "Read Aloud"}
    >
      {isSpeaking ? (
        <>
          <VolumeX className="w-3 h-3" />
          Stop
        </>
      ) : (
        <>
          <Volume2 className="w-3 h-3" />
          Speak
        </>
      )}
    </Button>
  );
}

const MAX_MESSAGE_LENGTH = 4000;

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, silent = false) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  const rawError = errInfo.error.toLowerCase();
  let friendlyMsg = "Database error occurred.";
  
  if (rawError.includes('permission') || rawError.includes('insufficient')) {
    friendlyMsg = "Access Denied: You don't have permission for this action.";
  } else if (rawError.includes('quota')) {
    friendlyMsg = "Quota Exceeded: Database usage limit reached.";
  } else if (rawError.includes('offline')) {
    friendlyMsg = "Connection Error: You appear to be offline.";
  }

  if (silent) {
    toast.error(friendlyMsg);
    return;
  }
  
  throw new Error(JSON.stringify(errInfo));
}

import { useUI } from '../contexts/UIContext';

export default function ChatInterface({ onOpenSettings }: { onOpenSettings?: () => void } = {}) {
  const [user] = useAuthState(auth);
  const { 
    isSidebarOpen, setIsSidebarOpen, toggleSidebar,
    isImageModalOpen, setIsImageModalOpen,
    isVideoModalOpen, setIsVideoModalOpen,
    isClearDialogOpen, setIsClearDialogOpen,
    isParamsOpen, setIsParamsOpen, toggleParams,
    isRenaming, setIsRenaming
  } = useUI();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [useSearch, setUseSearch] = useState(true);
  const [useMaps, setUseMaps] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  // Session Management State
  const [sessionId, setSessionId] = useState("global-session");
  const [sessionTitle, setSessionTitle] = useState("Neural Chat");
  const [newTitle, setNewTitle] = useState("");
  const [isClearing, setIsClearing] = useState(false);
  const [isMultiTurn, setIsMultiTurn] = useState(true);
  const [selectedPersonaId, setSelectedPersonaId] = useState('sierra-companion');
  const [selectedModelId, setSelectedModelId] = useState<string>(MODELS.CHAT_FLASH);
  const [sessions, setSessions] = useState<{ id: string; title: string; timestamp: any }[]>([]);

  // Model Parameters
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.9);
  const [topK, setTopK] = useState(40);

  useEffect(() => {
    setIsSettingsAnimating(true);
    const timer = setTimeout(() => setIsSettingsAnimating(false), 1000);
    return () => clearTimeout(timer);
  }, [temperature, topP, topK]);
  const [isSettingsAnimating, setIsSettingsAnimating] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [streamingMetadata, setStreamingMetadata] = useState<any>(null);

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
  const SUPPORTED_TYPES = {
    'image/*': 'Images (PNG, JPEG, WebP)',
    'video/*': 'Videos (MP4, MOV, WebM)',
    'audio/*': 'Audio (MP3, WAV, AAC)',
    'application/pdf': 'PDF Documents',
    'text/*': 'Text Files',
    '.csv': 'CSV Data',
    '.json': 'JSON Data'
  };

  // Multimodal State
  const [attachments, setAttachments] = useState<{ file: File; preview: string; type: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image Generation Modal State
  const [imagePrompt, setImagePrompt] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState<string>("16:9");
  const [imageQuality, setImageQuality] = useState<string>("1K");
  const [imageModel, setImageModel] = useState<string>(MODELS.IMAGE_PRO);
  const [imagePersonGeneration, setImagePersonGeneration] = useState<string>("ALLOW_ADULT");
  const [imageFormat, setImageFormat] = useState<string>("image/png");
  
  // Video Generation Modal State
  const [videoPrompt, setVideoPrompt] = useState('');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [videoAspectRatio, setVideoAspectRatio] = useState<string>("16:9");
  const [videoResolution, setVideoResolution] = useState<string>("1080p");
  const [videoFps, setVideoFps] = useState<number>(30);
  const [videoModel, setVideoModel] = useState<string>(MODELS.VIDEO_PRO);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);

  const openImageModal = () => {
    // Pre-fill prompt with current input or last message if input is empty
    if (input.trim()) {
      setImagePrompt(input);
    } else if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      setImagePrompt(lastMsg.content.substring(0, 200));
    }
    setIsImageModalOpen(true);
    setGeneratedImageUrl(null);
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim() || isGeneratingImage) return;
    setIsGeneratingImage(true);
    setGeneratedImageUrl(null);

    try {
      const url = await generateMediaImage({
        prompt: imagePrompt,
        aspectRatio: imageAspectRatio,
        imageSize: imageQuality,
        personGeneration: imagePersonGeneration,
        model: imageModel,
      });

      setGeneratedImageUrl(url);
      
      // Save to chat
      if (user) {
        await addDoc(collection(db, `users/${user.uid}/sessions/${sessionId}/messages`), {
          role: 'model',
          content: `Generated image for: "${imagePrompt}"`,
          timestamp: Date.now(),
          attachments: [url]
        });
      }
      toast.success("Image generated and added to chat!");
    } catch (error: any) {
      console.error("Image generation error:", error);
      toast.error(error.message || "Failed to generate image.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const openVideoModal = (prompt?: string | React.MouseEvent) => {
    if (typeof prompt === 'string' && prompt.trim()) {
      setVideoPrompt(prompt);
    } else if (input.trim()) {
      setVideoPrompt(input);
    } else if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      setVideoPrompt(lastMsg.content.substring(0, 200));
    }
    setIsVideoModalOpen(true);
    setGeneratedVideoUrl(null);
  };

  const handleGenerateVideo = async () => {
    if (!videoPrompt.trim() || isGeneratingVideo) return;
    setIsGeneratingVideo(true);
    setVideoProgress(15);
    setGeneratedVideoUrl(null);

    try {
      const progressInterval = setInterval(() => {
        setVideoProgress(prev => {
          if (prev === null) return 15;
          if (prev < 90) return prev + 10;
          return prev;
        });
      }, 7000);

      const videoUrl = await generateMediaVideo({
        prompt: videoPrompt,
        aspectRatio: videoAspectRatio,
        resolution: videoResolution,
        fps: videoFps,
        model: videoModel,
      });

      clearInterval(progressInterval);
      setVideoProgress(100);
      setGeneratedVideoUrl(videoUrl);

      // Save to chat
      if (user) {
        await addDoc(collection(db, `users/${user.uid}/sessions/${sessionId}/messages`), {
          role: 'model',
          content: `Generated video for: "${videoPrompt}"`,
          videoUrl: videoUrl,
          timestamp: Date.now(),
        });
      }
      toast.success("Video generated and added to chat!");
    } catch (error: any) {
      console.error("Video generation error:", error);
      toast.error(error.message || "Failed to generate video.");
    } finally {
      setIsGeneratingVideo(false);
      setVideoProgress(null);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onstart = () => {
      setIsListening(true);
      setInterimTranscript('');
    };
    recognitionRef.current.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };
    recognitionRef.current.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      setInterimTranscript('');
      if (event.error === 'not-allowed') {
        toast.error("Microphone access denied.");
      } else {
        toast.error("Speech recognition error: " + event.error);
      }
    };

    recognitionRef.current.onresult = (event: any) => {
      let finalTranscript = '';
      let currentInterim = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          currentInterim += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        setInput(prev => prev + (prev.length > 0 ? ' ' : '') + finalTranscript);
      }
      setInterimTranscript(currentInterim);
    };

    recognitionRef.current.start();
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const validateAndProcessFile = (file: File) => {
    const isSupported = 
      file.type.startsWith('image/') || 
      file.type.startsWith('video/') || 
      file.type.startsWith('audio/') || 
      file.type === 'application/pdf' || 
      file.type.startsWith('text/') ||
      file.name.endsWith('.csv') ||
      file.name.endsWith('.json');

    if (!isSupported) {
      toast.error(`"${file.name}" is not a supported file type.`, {
        description: `Supported: ${Object.values(SUPPORTED_TYPES).join(', ')}`
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error(`"${file.name}" is too large.`, {
        description: `Maximum file size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachments(prev => [...prev, {
        file,
        preview: reader.result as string,
        type: file.type || 'text/plain'
      }]);
    };
    reader.onerror = () => {
      toast.error(`Failed to read "${file.name}".`);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    files.forEach(validateAndProcessFile);
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach(validateAndProcessFile);
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Persist parameters to Firestore
  useEffect(() => {
    if (!user || !sessionId) return;

    const timer = setTimeout(async () => {
      try {
        const sessionDocRef = doc(db, `users/${user.uid}/sessions/${sessionId}`);
        await setDoc(sessionDocRef, {
          temperature,
          topP,
          topK
        }, { merge: true });
      } catch (error) {
        console.error("Error persisting parameters:", error);
      }
    }, 1000); // Debounce 1s

    return () => clearTimeout(timer);
  }, [user, sessionId, temperature, topP, topK]);

  // Fetch session title
  useEffect(() => {
    if (!user || !sessionId) return;

    const sessionDocRef = doc(db, `users/${user.uid}/sessions/${sessionId}`);
    const unsubscribe = onSnapshot(sessionDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSessionTitle(data.title || "Neural Chat");
        
        // Load persisted parameters if they exist
        if (data.temperature !== undefined) setTemperature(data.temperature);
        if (data.topP !== undefined) setTopP(data.topP);
        if (data.topK !== undefined) setTopK(data.topK);
      } else {
        // Initialize session doc if it doesn't exist
        try {
          await setDoc(sessionDocRef, { title: "Neural Chat", createdAt: serverTimestamp() }, { merge: true });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/sessions/${sessionId}`, true);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/sessions/${sessionId}`);
    });

    return () => unsubscribe();
  }, [user, sessionId]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, `users/${user.uid}/sessions/${sessionId}/messages`),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      setMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/sessions/${sessionId}/messages`);
    });

    return () => unsubscribe();
  }, [user, sessionId]);

  // Fetch sessions list
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/sessions`), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/sessions`);
    });
    return () => unsubscribe();
  }, [user]);

  const handleCreateSession = async () => {
    if (!user) return;
    try {
      const newSession = await addDoc(collection(db, `users/${user.uid}/sessions`), {
        title: "New Chat",
        timestamp: serverTimestamp()
      });
      setSessionId(newSession.id);
      toast.success("New chat created");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/sessions`);
    }
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/sessions`, id));
      if (id === sessionId) {
        setSessionId("global-session");
      }
      toast.success("Session deleted");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/sessions/${id}`);
    }
  };

  const handleRenameSession = async () => {
    if (!newTitle.trim() || !user) return;
    try {
      await updateDoc(doc(db, `users/${user.uid}/sessions/${sessionId}`), {
        title: newTitle.trim()
      });
      setIsRenaming(false);
      toast.success("Session renamed");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/sessions/${sessionId}`);
    }
  };

  const handleClearChat = async () => {
    if (!user || isClearing) return;
    setIsClearing(true);
    try {
      const messagesRef = collection(db, `users/${user.uid}/sessions/${sessionId}/messages`);
      const snapshot = await getDocs(messagesRef);
      
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      setIsClearDialogOpen(false);
      toast.success("Chat history cleared");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/sessions/${sessionId}/messages`);
    } finally {
      setIsClearing(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async () => {
    const messageText = input.trim();
    if ((!messageText && attachments.length === 0) || !user || isLoading || messageText.length > MAX_MESSAGE_LENGTH) return;

    const currentAttachments = [...attachments];
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: Date.now(),
      attachments: currentAttachments.map(a => a.preview)
    };

    setIsLoading(true);
    setInput('');
    setAttachments([]);

    try {
      // Save user message
      try {
        await addDoc(collection(db, `users/${user.uid}/sessions/${sessionId}/messages`), userMessage);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/sessions/${sessionId}/messages`);
      }

      // Prepare contents for Chat
      let formattedMessages: { role: string; content: string; attachments?: string[] }[] = [];
      if (isMultiTurn) {
        formattedMessages = messages.map(m => ({
          role: m.role,
          content: m.content,
          attachments: m.attachments,
        }));
      }

      formattedMessages.push({
        role: 'user',
        content: messageText,
        attachments: currentAttachments.map(a => a.preview),
      });

      const persona = PERSONAS.find(p => p.id === selectedPersonaId) || PERSONAS[0];
      let fullContent = "";
      setStreamingContent("");
      setStreamingMetadata(null);
      
      const aiMessageRef = await addDoc(collection(db, `users/${user.uid}/sessions/${sessionId}/messages`), {
        role: 'model',
        content: "",
        timestamp: Date.now(),
        modelName: CHAT_MODELS.find(m => m.id === selectedModelId)?.name || selectedModelId
      });

      let chunkCount = 0;
      let lastMetadata: any = null;

      await new Promise<void>((resolve, reject) => {
        streamChat(
          {
            messages: formattedMessages,
            systemInstruction: persona.instruction,
            model: selectedModelId,
            temperature,
            topP,
            topK,
            useSearch,
            useMaps,
          },
          {
            onChunk: (chunkText) => {
              fullContent += chunkText;
              setStreamingContent(fullContent);
              chunkCount++;
              if (chunkCount % 5 === 0) {
                updateDoc(doc(db, `users/${user.uid}/sessions/${sessionId}/messages`, aiMessageRef.id), {
                  content: fullContent,
                  groundingMetadata: lastMetadata
                }).catch(() => {});
              }
            },
            onMetadata: (metadata) => {
              lastMetadata = metadata;
              setStreamingMetadata(metadata);
            },
            onDone: () => resolve(),
            onError: (err) => reject(err),
          }
        );
      });

      // Final update to Firestore
      try {
        await updateDoc(doc(db, `users/${user.uid}/sessions/${sessionId}/messages`, aiMessageRef.id), {
          content: fullContent,
          groundingMetadata: lastMetadata
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/sessions/${sessionId}/messages/${aiMessageRef.id}`, true);
      }
      
      setStreamingContent("");
      setStreamingMetadata(null);
    } catch (error: any) {
      console.error("Chat error:", error);
      toast.error(error.message || "Failed to get AI response");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div 
        className="flex h-full w-full overflow-hidden relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-purple-600/10 backdrop-blur-sm border-2 border-dashed border-purple-500 flex items-center justify-center pointer-events-none"
            >
              <div className="bg-zinc-900 p-8 rounded-3xl border border-purple-500/30 shadow-2xl flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-purple-600/20 flex items-center justify-center">
                  <Paperclip className="w-8 h-8 text-purple-400" />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white">Drop files here</h3>
                  <p className="text-zinc-400 text-sm mt-1">
                    {Object.values(SUPPORTED_TYPES).join(' • ')}
                  </p>
                  <p className="text-zinc-500 text-[10px] mt-2 uppercase tracking-widest font-bold">
                    Max 20MB per file
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Sessions Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-r border-zinc-800 bg-zinc-950/50 flex flex-col h-full overflow-hidden shrink-0"
          >
            <div className="p-4 border-b border-zinc-800">
              <Button 
                onClick={handleCreateSession}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 rounded-xl gap-2 h-10 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">New Chat</span>
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-1">
                <h3 className="px-3 mb-2 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                  <History className="w-3 h-3" />
                  Recent Sessions
                </h3>
                {sessions.map((s) => (
                  <motion.div
                    key={s.id}
                    layout
                    onClick={() => setSessionId(s.id)}
                    className={cn(
                      "group relative flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200",
                      sessionId === s.id ? "text-white" : "text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200"
                    )}
                  >
                    {sessionId === s.id && (
                      <motion.div
                        layoutId="active-session-bg"
                        className="absolute inset-0 bg-zinc-800 rounded-xl -z-10 border border-zinc-700/50 shadow-inner"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    {sessionId === s.id && (
                      <motion.div
                        layoutId="active-session-indicator"
                        className="absolute left-0 top-3 bottom-3 w-1 bg-purple-500 rounded-full"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    
                    <div className="flex items-center gap-3 min-w-0 relative z-10">
                      <MessageSquare className={cn(
                        "w-4 h-4 shrink-0 transition-colors",
                        sessionId === s.id ? "text-purple-400" : "text-zinc-500 group-hover:text-zinc-400"
                      )} />
                      <span className="text-sm truncate font-medium">{s.title}</span>
                    </div>
                    
                    <div className="relative z-10">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all hover:bg-red-500/10"
                        onClick={(e) => handleDeleteSession(s.id, e)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="flex flex-col h-full flex-1 min-w-0 bg-zinc-950 relative">
        <header className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-8 w-8 text-zinc-500" 
              onClick={toggleSidebar}
            >
              <Sidebar className="w-4 h-4" />
            </Button>
            {isRenaming ? (
            <div className="flex items-center gap-2 flex-1 max-w-xs">
              <Input 
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRenameSession()}
                className="h-8 bg-zinc-900 border-zinc-700"
                autoFocus
              />
              <Button size="icon" variant="ghost" className="h-8 w-8 text-green-400" onClick={handleRenameSession}>
                <Check className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400" onClick={() => setIsRenaming(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 truncate">
              <h2 className="text-lg font-semibold truncate">{sessionTitle}</h2>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-zinc-500 hover:text-zinc-300"
                onClick={() => {
                  setNewTitle(sessionTitle);
                  setIsRenaming(true);
                }}
              >
                <Edit2 className="w-3 h-3" />
              </Button>
            </div>
          )}
          <Select value={selectedModelId} onValueChange={setSelectedModelId}>
            <SelectTrigger className="h-7 bg-purple-500/10 border-purple-500/20 text-[10px] font-bold text-purple-400 uppercase tracking-wider w-fit px-2 rounded-full">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
              {CHAT_MODELS.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPersonaId} onValueChange={setSelectedPersonaId}>
            <SelectTrigger className="h-8 bg-zinc-900 border-zinc-800 text-xs w-[140px] rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
              {PERSONAS.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center gap-2">
                    <p.icon className="w-3.5 h-3.5" />
                    <span>{p.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="w-px h-4 bg-zinc-800 mx-1" />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsMultiTurn(!isMultiTurn)}
            className={cn("gap-2", isMultiTurn ? "text-purple-400 bg-purple-400/10" : "text-zinc-500")}
            title={isMultiTurn ? "Multi-turn mode" : "Single-turn mode"}
          >
            {isMultiTurn ? <MessagesSquare className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
            <span className="text-xs hidden lg:inline">{isMultiTurn ? "Multi-turn" : "Single-turn"}</span>
          </Button>
          <div className="w-px h-4 bg-zinc-800 mx-1" />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsClearDialogOpen(true)}
            className="text-zinc-500 hover:text-red-400 gap-2"
            title="Clear Chat"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-xs hidden md:inline">Clear Chat</span>
          </Button>
          <div className="w-px h-4 bg-zinc-800 mx-1" />
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-zinc-900/30 border border-zinc-800/50">
            <div className="flex items-center gap-1.5">
              <Search className={cn("w-3.5 h-3.5 transition-colors", useSearch ? "text-blue-400" : "text-zinc-500")} />
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider hidden sm:inline">Search</span>
            </div>
            <Switch 
              size="sm"
              checked={useSearch} 
              onCheckedChange={setUseSearch}
              className="data-checked:bg-blue-500"
            />
          </div>
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-zinc-900/30 border border-zinc-800/50">
            <div className="flex items-center gap-1.5">
              <MapPin className={cn("w-3.5 h-3.5 transition-colors", useMaps ? "text-green-400" : "text-zinc-500")} />
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider hidden sm:inline">Maps</span>
            </div>
            <Switch 
              size="sm"
              checked={useMaps} 
              onCheckedChange={setUseMaps}
              className="data-checked:bg-green-500"
            />
          </div>
          <div className="w-px h-4 bg-zinc-800 mx-1" />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={toggleParams}
            className={cn(
              "gap-2 transition-all duration-300", 
              isParamsOpen ? "text-purple-400 bg-purple-400/10" : "text-zinc-500",
              isSettingsAnimating && "text-purple-400 scale-110"
            )}
            title="Model Parameters"
          >
            <motion.div
              animate={isSettingsAnimating ? { rotate: 180 } : { rotate: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Settings className="w-4 h-4" />
            </motion.div>
            <span className="text-xs hidden sm:inline">Params</span>
          </Button>
          {onOpenSettings && (
            <>
              <div className="w-px h-4 bg-zinc-800 mx-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenSettings}
                className="gap-1.5 text-zinc-400 hover:text-purple-300 hover:bg-purple-500/10 text-xs transition-colors"
                title="Configure AI Providers & System Settings"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden sm:inline font-medium">Providers</span>
              </Button>
            </>
          )}
        </div>
      </header>

      <AnimatePresence>
        {isParamsOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-zinc-800 bg-zinc-900/30 backdrop-blur-md overflow-hidden"
          >
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Tooltip>
                    <TooltipTrigger>
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest cursor-help border-b border-dotted border-zinc-700 pb-0.5">
                        Temperature
                      </label>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs p-3 bg-zinc-900 border border-zinc-800 shadow-2xl">
                      <div className="space-y-1.5">
                        <p className="font-bold text-purple-400">Randomness & Creativity</p>
                        <p className="text-zinc-400 leading-relaxed">
                          Higher values (e.g., 1.0+) make output more diverse and creative, but potentially less coherent. 
                          Lower values (e.g., 0.2) make it more deterministic and focused.
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-xs font-mono text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded">{temperature.toFixed(2)}</span>
                </div>
                <Slider 
                  value={[temperature]} 
                  onValueChange={(v) => setTemperature(v[0])} 
                  min={0} 
                  max={2} 
                  step={0.01} 
                />
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  Controls randomness. Higher values make output more creative but less predictable.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Tooltip>
                    <TooltipTrigger>
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest cursor-help border-b border-dotted border-zinc-700 pb-0.5">
                        Top P
                      </label>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs p-3 bg-zinc-900 border border-zinc-800 shadow-2xl">
                      <div className="space-y-1.5">
                        <p className="font-bold text-blue-400">Nucleus Sampling</p>
                        <p className="text-zinc-400 leading-relaxed">
                          Only tokens with a cumulative probability exceeding P are considered. 
                          It helps balance diversity and quality by cutting off the "long tail" of low-probability tokens.
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-xs font-mono text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">{topP.toFixed(2)}</span>
                </div>
                <Slider 
                  value={[topP]} 
                  onValueChange={(v) => setTopP(v[0])} 
                  min={0} 
                  max={1} 
                  step={0.01} 
                />
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  Nucleus sampling. Only considers tokens whose cumulative probability exceeds P.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Tooltip>
                    <TooltipTrigger>
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest cursor-help border-b border-dotted border-zinc-700 pb-0.5">
                        Top K
                      </label>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs p-3 bg-zinc-900 border border-zinc-800 shadow-2xl">
                      <div className="space-y-1.5">
                        <p className="font-bold text-green-400">Token Filtering</p>
                        <p className="text-zinc-400 leading-relaxed">
                          Limits the model to only consider the top K most likely tokens at each step. 
                          A lower K (e.g., 10) makes the output more predictable; a higher K (e.g., 100) allows for more variety.
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-xs font-mono text-green-400 bg-blue-400/10 px-2 py-0.5 rounded">{topK}</span>
                </div>
                <Slider 
                  value={[topK]} 
                  onValueChange={(v) => setTopK(v[0])} 
                  min={1} 
                  max={100} 
                  step={1} 
                />
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  Only considers the top K most likely tokens for each step.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6 pb-20">
          {messages.length === 0 && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-8 py-12">
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-zinc-900 flex items-center justify-center border border-zinc-800 mx-auto shadow-2xl">
                  <Sparkles className="w-8 h-8 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold tracking-tight">Welcome to OmniAgent</h3>
                  <p className="text-sm text-zinc-500 max-w-xs mx-auto mt-2">
                    The most powerful AI collective ever built. How can I assist your brilliance today?
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl px-4">
                {[
                  { title: "Code Architect", desc: "Build a React component with Tailwind", prompt: "Build a responsive React component for a pricing table using Tailwind CSS." },
                  { title: "Creative Muse", desc: "Write a sci-fi short story", prompt: "Write a short story about a civilization living on a planet with three suns." },
                  { title: "Data Analyst", desc: "Explain quantum computing", prompt: "Explain quantum computing in simple terms for a non-technical audience." },
                  { title: "Image Synthesis", desc: "Generate a futuristic city", prompt: "Generate a high-fidelity image of a futuristic neon city in the style of cyberpunk." },
                ].map((starter, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(starter.prompt)}
                    className="flex flex-col items-start p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-purple-500/50 hover:bg-zinc-800/50 transition-all text-left group"
                  >
                    <span className="text-sm font-bold text-zinc-200 group-hover:text-purple-400 transition-colors">{starter.title}</span>
                    <span className="text-xs text-zinc-500 mt-1">{starter.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <AnimatePresence initial={false}>
            {messages.filter(m => !(isLoading && streamingContent && m.role === 'model' && m.content === "")).map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex gap-4 max-w-[85%]",
                  msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-transform hover:scale-110 duration-300",
                  msg.role === 'user' ? "bg-zinc-800 border-zinc-700 shadow-lg" : "bg-purple-600/20 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                )}>
                  {msg.role === 'user' ? <User className="w-5 h-5 text-zinc-300" /> : <Bot className="w-5 h-5 text-purple-400" />}
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <div className={cn(
                    "flex items-center gap-2 px-1",
                    msg.role === 'user' ? "flex-row-reverse" : ""
                  )}>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      {msg.role === 'user' ? 'You' : 'OmniAgent'}
                    </span>
                    <span className="text-[10px] text-zinc-600">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={cn(
                    "space-y-2 p-5 rounded-2xl relative group/msg",
                    msg.role === 'user' ? "bg-zinc-800 text-zinc-100" : "bg-zinc-900 border border-zinc-800/50 shadow-xl"
                  )}>
                    {msg.videoUrl && (
                      <div className="mb-4 rounded-xl overflow-hidden border border-zinc-800 bg-black">
                        <video src={msg.videoUrl} controls className="w-full h-auto" />
                      </div>
                    )}
                    {msg.role === 'model' && msg.modelName && (
                    <div className="flex items-center gap-2 mb-3">
                      <div className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-[9px] font-bold text-purple-400 uppercase tracking-widest">
                        {msg.modelName}
                      </div>
                      <div className="h-px flex-1 bg-zinc-800/50" />
                    </div>
                  )}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {msg.attachments.map((att, i) => {
                        const isImage = att.startsWith('data:image');
                        const isVideo = att.startsWith('data:video');
                        const isAudio = att.startsWith('data:audio');
                        const isPDF = att.startsWith('data:application/pdf');

                        return (
                          <div key={i} className="relative group rounded-lg overflow-hidden border border-zinc-700 max-w-[200px] bg-zinc-950">
                            {isImage ? (
                              <img src={att} alt="Attachment" className="w-full h-auto max-h-40 object-cover" />
                            ) : isVideo ? (
                              <video src={att} className="w-full h-auto max-h-40" controls />
                            ) : isAudio ? (
                              <div className="p-2 min-w-[150px]">
                                <audio src={att} className="w-full h-8" controls />
                              </div>
                            ) : (
                              <div className="p-3 bg-zinc-900 flex items-center gap-2">
                                {isPDF ? <FileIcon className="w-4 h-4 text-red-400" /> : <FileIcon className="w-4 h-4 text-zinc-400" />}
                                <span className="text-xs text-zinc-300 truncate">
                                  {isPDF ? 'PDF Document' : 'Text File'}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="prose prose-invert max-w-none text-sm leading-relaxed prose-p:leading-relaxed prose-pre:p-0 prose-headings:tracking-tight prose-a:text-purple-400 prose-strong:text-zinc-100">
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => <h1 className="text-xl font-bold mt-8 mb-4 text-white tracking-tight border-b border-zinc-800 pb-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-lg font-bold mt-6 mb-3 text-zinc-100 tracking-tight">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-base font-bold mt-5 mb-2 text-zinc-200 tracking-tight">{children}</h3>,
                        p: ({ children }) => <p className="mb-4 text-zinc-300 leading-relaxed last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-2 text-zinc-300 marker:text-purple-500/50">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-2 text-zinc-300 marker:text-purple-500/50">{children}</ol>,
                        li: ({ children }) => <li className="pl-1 leading-relaxed">{children}</li>,
                        hr: () => <hr className="my-8 border-zinc-800" />,
                        a: ({ href, children }) => (
                          <a 
                            href={href} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-purple-400 hover:text-purple-300 underline underline-offset-4 decoration-purple-500/30 transition-colors"
                          >
                            {children}
                          </a>
                        ),
                        strong: ({ children }) => <strong className="font-bold text-zinc-100">{children}</strong>,
                        em: ({ children }) => <em className="italic text-zinc-400">{children}</em>,
                        table: ({ children }) => (
                          <div className="my-6 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/50">
                            <table className="w-full text-left border-collapse">
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({ children }) => <thead className="bg-zinc-900/50 border-b border-zinc-800">{children}</thead>,
                        th: ({ children }) => <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-widest">{children}</th>,
                        td: ({ children }) => <td className="px-4 py-3 text-sm text-zinc-300 border-t border-zinc-800/50">{children}</td>,
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-purple-500/30 pl-6 py-2 my-6 italic text-zinc-400 bg-purple-500/5 rounded-r-xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-purple-500/20" />
                            {children}
                          </blockquote>
                        ),
                        code(props) {
                          const { children, className, node, ...rest } = props;
                          const match = /language-(\w+)/.exec(className || '');
                          const codeContent = String(children).replace(/\n$/, '');
                          
                          return match ? (
                            <div className="relative group my-6">
                              <div className="flex items-center justify-between px-4 py-2 bg-zinc-950 border-x border-t border-zinc-800 rounded-t-xl">
                                <div className="flex items-center gap-2">
                                  <div className="flex gap-1">
                                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                                  </div>
                                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-2">{match[1]}</span>
                                </div>
                                <CopyButton text={codeContent} />
                              </div>
                              <SyntaxHighlighter
                                PreTag="div"
                                language={match[1]}
                                style={vscDarkPlus}
                                customStyle={{
                                  margin: 0,
                                  borderRadius: '0 0 0.75rem 0.75rem',
                                  background: '#09090b',
                                  border: '1px solid #27272a',
                                  padding: '1.5rem',
                                  fontSize: '0.85rem',
                                  lineHeight: '1.6'
                                }}
                              >
                                {codeContent}
                              </SyntaxHighlighter>
                            </div>
                          ) : (
                            <code {...rest} className={cn("bg-zinc-800/50 border border-zinc-700/50 px-1.5 py-0.5 rounded text-purple-300 font-mono text-[0.8em]", className)}>
                              {children}
                            </code>
                          );
                        }
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-800/30 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 px-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest hover:text-zinc-300 gap-1.5"
                        onClick={() => {
                          navigator.clipboard.writeText(msg.content);
                          toast.success("Message copied to clipboard");
                        }}
                      >
                        <Copy className="w-3 h-3" />
                        Copy Message
                      </Button>
                      <SpeakButton text={msg.content} />
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 px-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest hover:text-blue-400 gap-1.5 transition-colors"
                        onClick={() => openVideoModal(msg.content)}
                        title="Generate Video from this message"
                      >
                        <Video className="w-3 h-3" />
                        Video
                      </Button>
                    </div>
                    {msg.role === 'model' && (
                      <div className="text-[9px] font-medium text-zinc-600 italic">
                        Generated in real-time
                      </div>
                    )}
                  </div>
                  
                  {msg.groundingMetadata && <GroundingMetadata metadata={msg.groundingMetadata} />}
                </div>
              </div>
            </motion.div>
            ))}
          </AnimatePresence>
          
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4 max-w-[85%]"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                <Bot className="w-5 h-5 text-purple-400 animate-pulse" />
              </div>
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">OmniAgent</span>
                  <span className="text-[10px] text-zinc-600 animate-pulse">
                    {streamingContent ? "Responding..." : "Processing..."}
                  </span>
                </div>
                <div className={cn(
                  "space-y-2 p-5 rounded-2xl relative shadow-xl",
                  streamingContent ? "bg-zinc-900 border border-zinc-800/50" : "bg-zinc-900/50 border border-zinc-800/30"
                )}>
                  {!streamingContent ? (
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        <motion.div 
                          animate={{ scale: [1, 1.2, 1] }} 
                          transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                          className="w-1.5 h-1.5 rounded-full bg-purple-500" 
                        />
                        <motion.div 
                          animate={{ scale: [1, 1.2, 1] }} 
                          transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                          className="w-1.5 h-1.5 rounded-full bg-purple-500/60" 
                        />
                        <motion.div 
                          animate={{ scale: [1, 1.2, 1] }} 
                          transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                          className="w-1.5 h-1.5 rounded-full bg-purple-500/30" 
                        />
                      </div>
                      <span className="text-sm text-zinc-400 font-medium">Synthesizing response...</span>
                    </div>
                  ) : (
                    <div className="prose prose-invert max-w-none text-sm leading-relaxed prose-p:leading-relaxed prose-pre:p-0 prose-headings:tracking-tight prose-a:text-purple-400 prose-strong:text-zinc-100">
                      <ReactMarkdown
                        components={{
                          h1: ({ children }) => <h1 className="text-xl font-bold mt-8 mb-4 text-white tracking-tight border-b border-zinc-800 pb-2">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-lg font-bold mt-6 mb-3 text-zinc-100 tracking-tight">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-base font-bold mt-5 mb-2 text-zinc-200 tracking-tight">{children}</h3>,
                          p: ({ children }) => <p className="mb-4 text-zinc-300 leading-relaxed last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-2 text-zinc-300 marker:text-purple-500/50">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-2 text-zinc-300 marker:text-purple-500/50">{children}</ol>,
                          li: ({ children }) => <li className="pl-1 leading-relaxed">{children}</li>,
                          code(props) {
                            const { children, className, node, ...rest } = props;
                            const match = /language-(\w+)/.exec(className || '');
                            const codeContent = String(children).replace(/\n$/, '');
                            
                            return match ? (
                              <div className="relative group my-6">
                                <div className="flex items-center justify-between px-4 py-2 bg-zinc-950 border-x border-t border-zinc-800 rounded-t-xl">
                                  <div className="flex items-center gap-2">
                                    <div className="flex gap-1">
                                      <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                                      <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                                      <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                                    </div>
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-2">{match[1]}</span>
                                  </div>
                                </div>
                                <SyntaxHighlighter
                                  PreTag="div"
                                  language={match[1]}
                                  style={vscDarkPlus}
                                  customStyle={{
                                    margin: 0,
                                    borderRadius: '0 0 0.75rem 0.75rem',
                                    background: '#09090b',
                                    border: '1px solid #27272a',
                                    padding: '1.5rem',
                                    fontSize: '0.85rem',
                                    lineHeight: '1.6'
                                  }}
                                >
                                  {codeContent}
                                </SyntaxHighlighter>
                              </div>
                            ) : (
                              <code {...rest} className={cn("bg-zinc-800/50 border border-zinc-700/50 px-1.5 py-0.5 rounded text-purple-300 font-mono text-[0.8em]", className)}>
                                {children}
                              </code>
                            );
                          }
                        }}
                      >
                        {streamingContent}
                      </ReactMarkdown>
                      <motion.span 
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{ repeat: Infinity, duration: 0.8 }}
                        className="inline-block w-1.5 h-4 ml-1 bg-purple-500 align-middle"
                      />
                    </div>
                  )}
                </div>
                {streamingMetadata && <GroundingMetadata metadata={streamingMetadata} />}
              </div>
            </motion.div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="p-4 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent">
        <div className="relative max-w-4xl mx-auto">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 p-2 bg-zinc-900/50 border border-zinc-800 rounded-xl">
              {attachments.map((att, i) => {
                const isImage = att.type.startsWith('image/');
                const isVideo = att.type.startsWith('video/');
                const isAudio = att.type.startsWith('audio/');
                const isPDF = att.type === 'application/pdf';

                return (
                  <div key={i} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-zinc-700 shrink-0 bg-zinc-800">
                    {isImage ? (
                      <img src={att.preview} alt="Preview" className="w-full h-full object-cover" />
                    ) : isVideo ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="w-6 h-6 text-blue-400" />
                      </div>
                    ) : isAudio ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <Mic className="w-6 h-6 text-green-400" />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {isPDF ? <FileIcon className="w-6 h-6 text-red-400" /> : <FileIcon className="w-6 h-6 text-zinc-500" />}
                      </div>
                    )}
                    <button 
                      onClick={() => removeAttachment(i)}
                      className="absolute top-0.5 right-0.5 text-red-500 bg-black/50 rounded-full hover:text-red-400 transition-colors z-10"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-white truncate px-1 py-0.5">
                      {att.file.name}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="absolute -top-12 left-0 right-0 flex justify-center gap-2 pointer-events-none">
            <AnimatePresence>
              {input.trim() && (
                <>
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    className="pointer-events-auto"
                  >
                    <Button
                      onClick={openImageModal}
                      variant="secondary"
                      size="sm"
                      className="h-8 rounded-full bg-zinc-900/80 backdrop-blur-md border border-zinc-800 text-[10px] font-bold uppercase tracking-widest gap-2 hover:bg-zinc-800 hover:border-purple-500/50 transition-all shadow-xl"
                    >
                      <ImageIcon className="w-3 h-3 text-purple-400" />
                      Generate Image
                    </Button>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    transition={{ delay: 0.05 }}
                    className="pointer-events-auto"
                  >
                    <Button
                      onClick={openVideoModal}
                      variant="secondary"
                      size="sm"
                      className="h-8 rounded-full bg-zinc-900/80 backdrop-blur-md border border-zinc-800 text-[10px] font-bold uppercase tracking-widest gap-2 hover:bg-zinc-800 hover:border-blue-400/50 transition-all shadow-xl"
                    >
                      <Video className="w-3 h-3 text-blue-400" />
                      Generate Video
                    </Button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-2 shadow-2xl focus-within:border-purple-500/50 transition-all">
            <div className="flex items-end gap-2">
              <div className="flex items-center shrink-0">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  multiple
                  accept="image/*,video/*,audio/*,application/pdf,text/*,.csv,.json"
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleFileClick}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <Paperclip className="w-5 h-5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={toggleListening}
                  className={cn(
                    "transition-all duration-300 relative",
                    isListening ? "text-red-500 bg-red-500/10" : "text-zinc-500 hover:text-zinc-300"
                  )}
                  title={isListening ? "Stop Recording" : "Voice Input"}
                >
                  {isListening && (
                    <motion.div
                      className="absolute inset-0 rounded-full bg-red-500/20"
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                  <motion.div
                    animate={isListening ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                    transition={isListening ? { duration: 1.5, repeat: Infinity } : {}}
                  >
                    {isListening ? <Mic className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5" />}
                  </motion.div>
                </Button>
              </div>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={isListening ? "Listening to you..." : "Message Sierra..."}
                className="flex-1 bg-transparent border-none focus:ring-0 resize-none py-3 px-2 text-sm max-h-32 min-h-[44px]"
                rows={1}
              />
              {isListening && interimTranscript && (
                <div className="absolute left-12 right-12 bottom-full mb-2 p-3 bg-zinc-900/90 backdrop-blur-xl border border-purple-500/30 rounded-xl shadow-2xl animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          className="w-1 h-3 bg-purple-500 rounded-full"
                          animate={{ height: [4, 12, 4] }}
                          transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-zinc-300 italic truncate">
                      {interimTranscript}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex flex-col items-center gap-1 mb-1">
                {input.length > 0 && (
                  <span className={cn(
                    "text-[9px] font-bold transition-colors",
                    input.length > MAX_MESSAGE_LENGTH ? "text-red-500" : 
                    input.length > MAX_MESSAGE_LENGTH * 0.9 ? "text-amber-500" : "text-zinc-600"
                  )}>
                    {input.length}/{MAX_MESSAGE_LENGTH}
                  </span>
                )}
                <div className="flex items-center gap-1">
                  <Button 
                    onClick={openImageModal}
                    variant="ghost"
                    size="icon"
                    className="text-zinc-500 hover:text-purple-400 transition-colors"
                    title="Generate Image"
                  >
                    <ImageIcon className="w-5 h-5" />
                  </Button>
                  <Button 
                    onClick={openVideoModal}
                    variant="ghost"
                    size="icon"
                    className="text-zinc-500 hover:text-blue-400 transition-colors"
                    title="Generate Video"
                  >
                    <Video className="w-5 h-5" />
                  </Button>
                  <Button 
                    onClick={handleSend}
                    disabled={(!input.trim() && attachments.length === 0) || isLoading || input.length > MAX_MESSAGE_LENGTH}
                    size="icon" 
                    className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl shrink-0 transition-all active:scale-95"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-center text-zinc-600 mt-3 uppercase tracking-[0.2em]">
            OmniAgent can make mistakes. Verify important info.
          </p>
        </div>
      </div>
    </div>
  </div>

      {/* Image Generation Modal */}
      <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              Neural Image Synthesis
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Generate high-fidelity visual assets using the Creative Engine.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Prompt</label>
              <textarea
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder="Describe the image you want to create..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm focus:ring-2 focus:ring-purple-500/50 transition-all min-h-[100px] resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Model</label>
                <div className="h-10 px-4 flex items-center bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-300">
                  Imagen 3 Pro (Hyperrealistic)
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Format</label>
                <Select value={imageFormat} onValueChange={setImageFormat}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                    <SelectItem value="image/png">PNG</SelectItem>
                    <SelectItem value="image/jpeg">JPEG</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Aspect Ratio</label>
                <Select value={imageAspectRatio} onValueChange={setImageAspectRatio}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                    {ASPECT_RATIOS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Quality</label>
                <Select value={imageQuality} onValueChange={setImageQuality}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                    {IMAGE_SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Person Generation</label>
              <Select value={imagePersonGeneration} onValueChange={setImagePersonGeneration}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                  <SelectItem value="ALLOW_ADULT">Allow Adults</SelectItem>
                  <SelectItem value="DONT_ALLOW">Don't Allow</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {generatedImageUrl && (
              <div className="relative group rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl mt-4">
                <img src={generatedImageUrl} alt="Generated" className="w-full h-auto" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <Button variant="secondary" size="sm" className="gap-2" onClick={() => window.open(generatedImageUrl, '_blank')}>
                    <Download className="w-4 h-4" /> Download
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="ghost" 
              onClick={() => setIsImageModalOpen(false)}
              className="text-zinc-400 hover:text-zinc-100"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleGenerateImage}
              disabled={!imagePrompt.trim() || isGeneratingImage}
              className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl gap-2 min-w-[120px]"
            >
              {isGeneratingImage ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              {isGeneratingImage ? 'Synthesizing...' : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Generation Modal */}
      <Dialog open={isVideoModalOpen} onOpenChange={setIsVideoModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-400" />
              Neural Video Synthesis
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Generate motion sequences using the Temporal Engine.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Prompt</label>
              <textarea
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                placeholder="Describe the video you want to create..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500/50 transition-all min-h-[100px] resize-none"
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Model</label>
                <div className="h-10 px-4 flex items-center bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-300">
                  Veo Pro
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Aspect Ratio</label>
                <Select value={videoAspectRatio} onValueChange={setVideoAspectRatio}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                    {ASPECT_RATIOS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Resolution</label>
                <Select value={videoResolution} onValueChange={setVideoResolution}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                    {VIDEO_RESOLUTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">FPS</label>
                <Select value={videoFps.toString()} onValueChange={(v) => setVideoFps(parseInt(v))}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                    {VIDEO_FPS.map(f => <SelectItem key={f} value={f.toString()}>{f} FPS</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isGeneratingVideo && videoProgress !== null && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  <span>Synthesizing Video Frames</span>
                  <span>{videoProgress}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                    style={{ width: `${videoProgress}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-500 italic">
                  The Temporal Engine is processing your request. This typically takes 1-2 minutes.
                </p>
              </div>
            )}

            {generatedVideoUrl && (
              <div className="relative group rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl mt-4">
                <video src={generatedVideoUrl} controls className="w-full h-auto" />
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="secondary" size="sm" className="gap-2" onClick={() => window.open(generatedVideoUrl, '_blank')}>
                    <Download className="w-4 h-4" /> Download
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="ghost" 
              onClick={() => setIsVideoModalOpen(false)}
              className="text-zinc-400 hover:text-zinc-100"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleGenerateVideo}
              disabled={!videoPrompt.trim() || isGeneratingVideo}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl gap-2 min-w-[120px]"
            >
              {isGeneratingVideo ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              {isGeneratingVideo ? 'Synthesizing...' : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Chat Confirmation Dialog */}
      <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5" />
              Clear Chat History
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              This will permanently delete all messages in this session. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="ghost" 
              onClick={() => setIsClearDialogOpen(false)}
              className="text-zinc-400 hover:text-zinc-100"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleClearChat}
              disabled={isClearing}
              className="bg-red-600 hover:bg-red-500 text-white rounded-xl gap-2"
            >
              {isClearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {isClearing ? 'Clearing...' : 'Clear History'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
