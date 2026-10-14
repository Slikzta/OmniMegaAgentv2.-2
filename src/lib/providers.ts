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

export async function getProvidersConfig(): Promise<ProvidersConfigResponse> {
  const res = await fetch('/api/providers/config');
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
  const res = await fetch('/api/providers/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to save provider config: ${res.statusText}`);
  return res.json();
}

export async function testProviderConnection(data: {
  providerId: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}): Promise<{ success: boolean; latencyMs?: number; message?: string; error?: string }> {
  const res = await fetch('/api/providers/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
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

  try {
    const res = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

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
  const res = await fetch('/api/media/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
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
  const data = await res.json();
  if (!res.ok || !data.videoUrl) {
    throw new Error(data.error || 'Failed to generate video');
  }
  return data.videoUrl;
}

export async function fetchLiveVoiceToken(): Promise<string> {
  const res = await fetch('/api/live/token', { method: 'POST' });
  const data = await res.json();
  if (!res.ok || !data.token) {
    throw new Error(data.error || 'Failed to obtain live voice ephemeral token');
  }
  return data.token;
}
