import { Capacitor } from '@capacitor/core';

export interface ProviderInfo {
  id: string;
  name: string;
  selectedModel: string;
  baseUrl?: string;
  hasKey: boolean;
  isEnvKey?: boolean;
  capabilities: {
    text: boolean;
    streaming: boolean;
    multimodal: boolean;
    grounding: boolean;
    imageGen: boolean;
    videoGen: boolean;
    liveVoice: boolean;
  };
}

export interface ProvidersConfigResponse {
  activeProvider: string;
  providers: Record<string, ProviderInfo>;
}

const STORAGE_KEY_CONFIG = 'omni_providers_config';
const STORAGE_KEY_ACTIVE = 'omni_active_provider';
const STORAGE_KEY_KEYS = 'omni_provider_keys';

function getNativeStoredKeys(): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    if (typeof localStorage !== 'undefined') {
      // 1. Read directly from the primary persistent storage (STORAGE_KEY_CONFIG)
      // where model and provider configurations reside
      const rawConfig = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (rawConfig) {
        const parsed = JSON.parse(rawConfig);
        for (const [id, conf] of Object.entries(parsed as Record<string, any>)) {
          if (conf?.apiKey) {
            result[id] = conf.apiKey;
          }
        }
      }
      // 2. Check legacy / auxiliary keys storage
      const rawKeys = localStorage.getItem(STORAGE_KEY_KEYS);
      if (rawKeys) {
        const parsedKeys = JSON.parse(rawKeys);
        for (const [id, key] of Object.entries(parsedKeys as Record<string, string>)) {
          if (key && !result[id]) {
            result[id] = key;
          }
        }
      }
    }
  } catch {}
  return result;
}

function saveNativeStoredKey(providerId: string, apiKey: string) {
  try {
    if (typeof localStorage === 'undefined') return;
    // Persist to the same on-device storage key (STORAGE_KEY_CONFIG) as model selection
    const rawConfig = localStorage.getItem(STORAGE_KEY_CONFIG);
    const configMap: Record<string, any> = rawConfig ? JSON.parse(rawConfig) : {};
    if (!configMap[providerId]) configMap[providerId] = {};
    configMap[providerId].apiKey = apiKey;
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(configMap));

    // Mirror to auxiliary keys storage for compatibility
    const rawKeys = localStorage.getItem(STORAGE_KEY_KEYS);
    const keysMap: Record<string, string> = rawKeys ? JSON.parse(rawKeys) : {};
    keysMap[providerId] = apiKey;
    localStorage.setItem(STORAGE_KEY_KEYS, JSON.stringify(keysMap));
  } catch {}
}

function getDefaultProvidersMap(): Record<string, ProviderInfo> {
  const keys = getNativeStoredKeys();
  return {
    gemini: {
      id: "gemini",
      name: "Google Gemini",
      selectedModel: "gemini-3.5-flash-lite",
      hasKey: Boolean(keys.gemini),
      capabilities: {
        text: true,
        streaming: true,
        multimodal: true,
        grounding: true,
        imageGen: true,
        videoGen: true,
        liveVoice: true,
      },
    },
    openai: {
      id: "openai",
      name: "OpenAI",
      selectedModel: "gpt-4o",
      baseUrl: "https://api.openai.com/v1",
      hasKey: Boolean(keys.openai),
      capabilities: {
        text: true,
        streaming: true,
        multimodal: true,
        grounding: false,
        imageGen: false,
        videoGen: false,
        liveVoice: false,
      },
    },
    anthropic: {
      id: "anthropic",
      name: "Anthropic Claude",
      selectedModel: "claude-3-7-sonnet-latest",
      baseUrl: "https://api.anthropic.com/v1",
      hasKey: Boolean(keys.anthropic),
      capabilities: {
        text: true,
        streaming: true,
        multimodal: true,
        grounding: false,
        imageGen: false,
        videoGen: false,
        liveVoice: false,
      },
    },
    custom: {
      id: "custom",
      name: "Custom OpenAI-Compatible",
      selectedModel: "llama-3.3-70b-versatile",
      baseUrl: "https://api.groq.com/openai/v1",
      hasKey: Boolean(keys.custom),
      capabilities: {
        text: true,
        streaming: true,
        multimodal: true,
        grounding: false,
        imageGen: false,
        videoGen: false,
        liveVoice: false,
      },
    },
    ollama: {
      id: "ollama",
      name: "Ollama (Local/Host)",
      selectedModel: "llama3.2",
      baseUrl: "http://localhost:11434",
      hasKey: true,
      capabilities: {
        text: true,
        streaming: true,
        multimodal: false,
        grounding: false,
        imageGen: false,
        videoGen: false,
        liveVoice: false,
      },
    },
  };
}

export async function getProvidersConfig(): Promise<ProvidersConfigResponse> {
  if (Capacitor.isNativePlatform()) {
    try {
      const active = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY_ACTIVE)) || "gemini";
      const rawConfig = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_CONFIG) : null;
      const providers = getDefaultProvidersMap();
      if (rawConfig) {
        const parsed = JSON.parse(rawConfig);
        const keys = getNativeStoredKeys();
        for (const [id, prov] of Object.entries(parsed as Record<string, Partial<ProviderInfo>>)) {
          if (providers[id]) {
            providers[id] = {
              ...providers[id],
              ...prov,
              hasKey: Boolean(keys[id]),
            };
          }
        }
      }
      return { activeProvider: active, providers };
    } catch {
      return { activeProvider: "gemini", providers: getDefaultProvidersMap() };
    }
  }

  const res = await fetch('/api/providers/config', {
    headers: {
      'Accept': 'application/json',
    },
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Server returned non-JSON response (${res.status}): ${text.slice(0, 120)}`);
  }

  if (!res.ok) throw new Error(`Failed to load providers config: ${res.statusText}`);
  return res.json();
}

export async function saveProviderConfig(data: {
  activeProvider?: string;
  providerId?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}): Promise<{ success: boolean; activeProvider: string }> {
  if (Capacitor.isNativePlatform()) {
    try {
      let active = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY_ACTIVE)) || "gemini";
      if (data.activeProvider) {
        active = data.activeProvider;
        localStorage.setItem(STORAGE_KEY_ACTIVE, active);
      }
      if (data.providerId) {
        const rawConfig = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_CONFIG) : null;
        const configMap: Record<string, any> = rawConfig ? JSON.parse(rawConfig) : {};
        if (!configMap[data.providerId]) configMap[data.providerId] = {};
        if (data.model !== undefined) configMap[data.providerId].selectedModel = data.model;
        if (data.baseUrl !== undefined) configMap[data.providerId].baseUrl = data.baseUrl;
        // Save the API key to the exact same persistent on-device storage object as the other settings
        if (data.apiKey !== undefined && data.apiKey.trim() !== '') {
          configMap[data.providerId].apiKey = data.apiKey.trim();
          saveNativeStoredKey(data.providerId, data.apiKey.trim());
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(configMap));
        }
      }
      return { success: true, activeProvider: active };
    } catch (e: any) {
      throw new Error(`Failed to save settings locally on device: ${e.message}`);
    }
  }

  const res = await fetch('/api/providers/config', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Server returned non-JSON response (${res.status}): ${text.slice(0, 120)}`);
  }

  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Failed to save provider config (${res.status})`);
  }
  return json;
}

export async function testProviderConnection(data: {
  providerId: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}): Promise<{ success: boolean; latencyMs?: number; message?: string; error?: string }> {
  if (Capacitor.isNativePlatform()) {
    const startTime = Date.now();
    const keys = getNativeStoredKeys();
    const effectiveKey = data.apiKey?.trim() || keys[data.providerId];

    if (data.providerId === "gemini") {
      if (!effectiveKey) {
        return { success: false, error: "Gemini API key is required. Please provide a key in settings." };
      }
      const model = data.model || "gemini-3.5-flash-lite";
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Hello, reply with one word: 'Ready'." }] }],
          }),
        });
        const latencyMs = Date.now() - startTime;
        const json = await res.json();
        if (!res.ok) {
          return {
            success: false,
            latencyMs,
            error: json.error?.message || `Gemini API returned error ${res.status}`,
          };
        }
        const reply = json.candidates?.[0]?.content?.parts?.[0]?.text || "Ready";
        return {
          success: true,
          latencyMs,
          message: `Successfully connected to Gemini (${model}). Response: ${reply.trim().slice(0, 30)}`,
        };
      } catch (err: any) {
        return {
          success: false,
          latencyMs: Date.now() - startTime,
          error: `Network error connecting to Gemini API: ${err.message}`,
        };
      }
    }

    if (data.providerId === "openai" || data.providerId === "custom") {
      const url = (data.baseUrl || (data.providerId === "openai" ? "https://api.openai.com/v1" : "https://api.groq.com/openai/v1")).replace(/\/+$/, "") + "/chat/completions";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (effectiveKey) headers["Authorization"] = `Bearer ${effectiveKey}`;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: data.model || (data.providerId === "openai" ? "gpt-4o-mini" : "llama-3.3-70b-versatile"),
            messages: [{ role: "user", content: "Reply with 'Ready'" }],
            max_tokens: 10,
          }),
        });
        const latencyMs = Date.now() - startTime;
        const json = await res.json();
        if (!res.ok) {
          return { success: false, latencyMs, error: json.error?.message || `API error (${res.status})` };
        }
        return {
          success: true,
          latencyMs,
          message: `Successfully connected to ${data.providerId} (${data.model}).`,
        };
      } catch (err: any) {
        return { success: false, latencyMs: Date.now() - startTime, error: err.message };
      }
    }

    return {
      success: true,
      latencyMs: Date.now() - startTime,
      message: `Configured on-device for ${data.providerId}.`,
    };
  }

  const res = await fetch('/api/providers/test', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    return {
      success: false,
      error: `Server returned non-JSON response (${res.status}): ${text.slice(0, 120)}`,
    };
  }

  const json = await res.json();
  if (!res.ok || !json.success) {
    return {
      success: false,
      error: json.error || 'Connection failed',
    };
  }
  return json;
}

export interface StreamChatParams {
  messages: {
    role: string;
    content: string;
    attachments?: string[];
  }[];
  systemInstruction?: string;
  provider?: string;
  model?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  useSearch?: boolean;
  useMaps?: boolean;
}

export async function streamChat(
  params: StreamChatParams,
  callbacks: {
    onChunk: (text: string) => void;
    onMetadata?: (meta: any) => void;
    onDone: () => void;
    onError: (err: Error) => void;
  }
): Promise<() => void> {
  const controller = new AbortController();

  // On native Capacitor, call Gemini API directly from client with saved key
  if (Capacitor.isNativePlatform()) {
    const keys = getNativeStoredKeys();
    const effectiveKey = keys[params.provider || 'gemini'] || keys.gemini;

    if (!effectiveKey) {
      callbacks.onError(new Error("Gemini API key is required. Please set your key in Settings."));
      return () => controller.abort();
    }

    const model = params.model || "gemini-3.5-flash-lite";

    // Format messages for Gemini API
    const contents = params.messages.map((m) => {
      const parts: any[] = [{ text: m.content || "" }];
      if (Array.isArray(m.attachments)) {
        m.attachments.forEach((att: string) => {
          if (att.startsWith("data:")) {
            const [header, b64] = att.split(";base64,");
            const mimeType = header.replace("data:", "");
            parts.push({
              inlineData: { mimeType, data: b64 }
            });
          }
        });
      }
      return {
        role: m.role === "assistant" || m.role === "model" ? "model" : "user",
        parts
      };
    });

    const tools: any[] = [];
    if (params.useSearch) tools.push({ googleSearch: {} });

    const reqBody: any = {
      contents,
      generationConfig: {
        temperature: params.temperature,
        topP: params.topP,
        topK: params.topK,
      }
    };
    if (params.systemInstruction) {
      reqBody.systemInstruction = {
        parts: [{ text: params.systemInstruction }]
      };
    }
    if (tools.length > 0) {
      reqBody.tools = tools;
    }

    (async () => {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${effectiveKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          callbacks.onError(new Error(`Gemini API error (${res.status}): ${errText.slice(0, 200)}`));
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          callbacks.onError(new Error('No response stream available.'));
          return;
        }

        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const dataStr = trimmed.slice(6);
            try {
              const data = JSON.parse(dataStr);
              const textChunk = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (textChunk) {
                callbacks.onChunk(textChunk);
              }
              const grounding = data.candidates?.[0]?.groundingMetadata;
              if (grounding && callbacks.onMetadata) {
                callbacks.onMetadata(grounding);
              }
            } catch (_) {}
          }
        }
        callbacks.onDone();
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          callbacks.onError(err);
        }
      }
    })();

    return () => controller.abort();
  }

  // Web dev behavior remains unchanged
  try {
    const res = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream') && !contentType.includes('application/json')) {
      const text = await res.text();
      callbacks.onError(new Error(`Server returned non-stream response (${res.status}): ${text.slice(0, 120)}`));
      return () => controller.abort();
    }

    if (!res.ok) {
      const errText = await res.text();
      callbacks.onError(new Error(`Chat request failed (${res.status}): ${errText}`));
      return () => controller.abort();
    }

    const reader = res.body?.getReader();
    if (!reader) {
      callbacks.onError(new Error('No response stream available.'));
      return () => controller.abort();
    }

    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const dataStr = trimmed.slice(6);
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                callbacks.onError(new Error(data.error));
                return;
              }
              if (data.chunk) {
                callbacks.onChunk(data.chunk);
              }
              if (data.metadata && callbacks.onMetadata) {
                callbacks.onMetadata(data.metadata);
              }
              if (data.done) {
                callbacks.onDone();
                return;
              }
            } catch (_) {}
          }
        }
        callbacks.onDone();
      } catch (streamErr: any) {
        if (streamErr.name !== 'AbortError') {
          callbacks.onError(streamErr);
        }
      }
    })();
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      callbacks.onError(err);
    }
  }

  return () => controller.abort();
}

export async function generateMediaImage(params: {
  prompt: string;
  aspectRatio?: string;
  imageSize?: string;
  personGeneration?: string;
  model?: string;
}): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const keys = getNativeStoredKeys();
    const effectiveKey = keys.gemini;
    if (!effectiveKey) {
      throw new Error("Gemini API key is required for image generation. Please set your key in Settings.");
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${effectiveKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: params.prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: params.aspectRatio || "1:1",
        }
      })
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      throw new Error(`Server returned non-JSON response (${res.status}): ${text.slice(0, 120)}`);
    }
    const data = await res.json();
    const b64 = data.predictions?.[0]?.bytesBase64Encoded;
    if (b64) {
      return `data:image/jpeg;base64,${b64}`;
    }
    throw new Error(data.error?.message || "Failed to generate image on device");
  }

  const res = await fetch('/api/media/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Server returned non-JSON response (${res.status}): ${text.slice(0, 120)}`);
  }
  const data = await res.json();
  if (!res.ok || !data.imageUrl) {
    throw new Error(data.error || 'Failed to generate image');
  }
  return data.imageUrl;
}

export async function generateMediaVideo(params: {
  prompt: string;
  aspectRatio?: string;
  resolution?: string;
  fps?: number;
  model?: string;
}): Promise<string> {
  const res = await fetch('/api/media/video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Server returned non-JSON response (${res.status}): ${text.slice(0, 120)}`);
  }
  const data = await res.json();
  if (!res.ok || !data.videoUrl) {
    throw new Error(data.error || 'Failed to generate video');
  }
  return data.videoUrl;
}

export async function fetchLiveVoiceToken(): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const keys = getNativeStoredKeys();
    const key = keys.gemini;
    if (!key) {
      throw new Error('Gemini API key is required for Continuous Voice Chat. Please enter your API key in Settings.');
    }
    return key;
  }

  const res = await fetch('/api/live/token', { method: 'POST' });
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Server returned non-JSON response (${res.status}): ${text.slice(0, 120)}`);
  }
  const data = await res.json();
  if (!res.ok || !data.token) {
    throw new Error(data.error || 'Failed to obtain live voice ephemeral token');
  }
  return data.token;
}
