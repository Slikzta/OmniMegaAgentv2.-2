import express from "express";
import http from "http";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import { Octokit } from "octokit";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Session secret validation
const isProduction = process.env.NODE_ENV === "production";
const rawSessionSecret = process.env.SESSION_SECRET;

if (isProduction && (!rawSessionSecret || rawSessionSecret.includes("omniagent") || rawSessionSecret.length < 16)) {
  console.error("FATAL: In production, SESSION_SECRET environment variable must be set to a secure string of at least 16 characters.");
  process.exit(1);
}

// In development, generate a non-hardcoded ephemeral fallback suitable for development
const sessionSecret = rawSessionSecret || crypto.randomBytes(32).toString("hex");

// Server-side provider memory store (keyed by session or default)
interface ProviderConfig {
  id: string;
  name: string;
  selectedModel: string;
  apiKey?: string;
  baseUrl?: string;
}

// In-memory server credentials store (never sent in full to client, persists across page refreshes)
const serverProviderStore: Record<string, Record<string, ProviderConfig>> = {};

const DEFAULT_PROVIDERS: Record<string, { name: string; defaultModel: string; defaultUrl?: string }> = {
  gemini: { name: "Google Gemini", defaultModel: "gemini-3.5-flash-lite" },
  openai: { name: "OpenAI", defaultModel: "gpt-4o", defaultUrl: "https://api.openai.com/v1" },
  anthropic: { name: "Anthropic Claude", defaultModel: "claude-3-7-sonnet-latest", defaultUrl: "https://api.anthropic.com/v1" },
  custom: { name: "Custom OpenAI-Compatible", defaultModel: "llama-3.3-70b-versatile", defaultUrl: "https://api.groq.com/openai/v1" },
  ollama: { name: "Ollama (Local/Host)", defaultModel: "llama3.2", defaultUrl: "http://localhost:11434" }
};

function getSessionStore(sessionId: string): { activeProvider: string; configs: Record<string, ProviderConfig> } {
  if (!serverProviderStore[sessionId]) {
    serverProviderStore[sessionId] = {
      gemini: { id: "gemini", name: "Google Gemini", selectedModel: "gemini-3.5-flash-lite", apiKey: process.env.GEMINI_API_KEY || "" },
      openai: { id: "openai", name: "OpenAI", selectedModel: "gpt-4o", baseUrl: "https://api.openai.com/v1" },
      anthropic: { id: "anthropic", name: "Anthropic Claude", selectedModel: "claude-3-7-sonnet-latest", baseUrl: "https://api.anthropic.com/v1" },
      custom: { id: "custom", name: "Custom OpenAI-Compatible", selectedModel: "llama-3.3-70b-versatile", baseUrl: "https://api.groq.com/openai/v1" },
      ollama: { id: "ollama", name: "Ollama (Local/Host)", selectedModel: "llama3.2", baseUrl: "http://localhost:11434" },
    };
  }
  return {
    activeProvider: (serverProviderStore[sessionId] as any)._activeProvider || "gemini",
    configs: serverProviderStore[sessionId]
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = http.createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app.use(cookieParser());

  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    }) as any
  );

  // Helper to get or initialize session ID
  const getClientSessionId = (req: express.Request): string => {
    if (!req.session) return "default-session";
    if (!(req.session as any).uid) {
      (req.session as any).uid = "session-" + crypto.randomBytes(8).toString("hex");
    }
    return (req.session as any).uid;
  };

  // ==========================================
  // AI PROVIDER SETTINGS & CONFIGURATION APIS
  // ==========================================

  // GET /api/providers/config - returns sanitized configuration (no exposed keys)
  app.get("/api/providers/config", (req, res) => {
    const sId = getClientSessionId(req);
    const store = getSessionStore(sId);

    const sanitizedProviders = {
      gemini: {
        id: "gemini",
        name: "Google Gemini",
        selectedModel: store.configs.gemini?.selectedModel || "gemini-3-flash-preview",
        hasKey: Boolean(store.configs.gemini?.apiKey || process.env.GEMINI_API_KEY),
        isEnvKey: Boolean(!store.configs.gemini?.apiKey && process.env.GEMINI_API_KEY),
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
        selectedModel: store.configs.openai?.selectedModel || "gpt-4o",
        baseUrl: store.configs.openai?.baseUrl || "https://api.openai.com/v1",
        hasKey: Boolean(store.configs.openai?.apiKey),
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
        selectedModel: store.configs.anthropic?.selectedModel || "claude-3-7-sonnet-latest",
        baseUrl: store.configs.anthropic?.baseUrl || "https://api.anthropic.com/v1",
        hasKey: Boolean(store.configs.anthropic?.apiKey),
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
        selectedModel: store.configs.custom?.selectedModel || "llama-3.3-70b-versatile",
        baseUrl: store.configs.custom?.baseUrl || "https://api.groq.com/openai/v1",
        hasKey: Boolean(store.configs.custom?.apiKey),
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
        selectedModel: store.configs.ollama?.selectedModel || "llama3.2",
        baseUrl: store.configs.ollama?.baseUrl || "http://localhost:11434",
        hasKey: true, // Ollama does not require key
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

    res.json({
      activeProvider: store.activeProvider,
      providers: sanitizedProviders,
    });
  });

  // POST /api/providers/config (or /api/providers/save) - save settings and credentials securely
  app.post(["/api/providers/config", "/api/providers/save"], (req, res) => {
    const sId = getClientSessionId(req);
    const store = getSessionStore(sId);
    const { activeProvider, providerId, apiKey, model, baseUrl } = req.body;

    if (activeProvider && ["gemini", "openai", "anthropic", "custom", "ollama"].includes(activeProvider)) {
      (serverProviderStore[sId] as any)._activeProvider = activeProvider;
    }

    if (providerId && store.configs[providerId]) {
      if (model !== undefined) store.configs[providerId].selectedModel = model;
      if (baseUrl !== undefined) store.configs[providerId].baseUrl = baseUrl;
      if (apiKey !== undefined && apiKey !== "") {
        store.configs[providerId].apiKey = apiKey;
      }
    }

    res.json({ success: true, activeProvider: (serverProviderStore[sId] as any)._activeProvider || "gemini" });
  });

  // POST /api/providers/test (or /api/providers/test-connection) - test connection to provider with actionable error messages
  app.post(["/api/providers/test", "/api/providers/test-connection"], async (req, res) => {
    const sId = getClientSessionId(req);
    const store = getSessionStore(sId);
    const { providerId, apiKey, model, baseUrl } = req.body;

    const targetKey = apiKey || store.configs[providerId]?.apiKey || (providerId === "gemini" ? process.env.GEMINI_API_KEY : "");
    const targetModel = model || store.configs[providerId]?.selectedModel;
    const targetBaseUrl = baseUrl || store.configs[providerId]?.baseUrl;

    const startTime = Date.now();

    try {
      if (providerId === "gemini") {
        if (!targetKey) {
          return res.status(400).json({ success: false, error: "Gemini API key is required. Please provide a key or configure GEMINI_API_KEY." });
        }
        const ai = new GoogleGenAI({ apiKey: targetKey });
        const testRes = await ai.models.generateContent({
          model: targetModel || "gemini-3-flash-preview",
          contents: "Hello, reply with one word: 'Ready'.",
        });
        const reply = testRes.text || "Connected";
        return res.json({
          success: true,
          latencyMs: Date.now() - startTime,
          message: `Successfully connected to Gemini (${targetModel || 'gemini-3-flash-preview'}). Response: ${reply.trim().slice(0, 30)}`,
        });
      }

      if (providerId === "openai" || providerId === "custom") {
        const url = (targetBaseUrl || "https://api.openai.com/v1").replace(/\/+$/, "") + "/chat/completions";
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (targetKey) {
          headers["Authorization"] = `Bearer ${targetKey}`;
        } else if (providerId === "openai") {
          return res.status(400).json({ success: false, error: "OpenAI API key is required." });
        }

        const resp = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: targetModel || "gpt-4o",
            messages: [{ role: "user", content: "Say ready" }],
            max_tokens: 5,
          }),
        });

        if (!resp.ok) {
          const errBody = await resp.text();
          let parsedMsg = errBody;
          try {
            const json = JSON.parse(errBody);
            parsedMsg = json.error?.message || errBody;
          } catch (_) {}
          return res.status(400).json({
            success: false,
            error: `API returned ${resp.status}: ${parsedMsg}`,
          });
        }

        return res.json({
          success: true,
          latencyMs: Date.now() - startTime,
          message: `Connected successfully to ${targetModel} via ${targetBaseUrl || "OpenAI API"}.`,
        });
      }

      if (providerId === "anthropic") {
        if (!targetKey) {
          return res.status(400).json({ success: false, error: "Anthropic API key is required." });
        }
        const url = (targetBaseUrl || "https://api.anthropic.com/v1").replace(/\/+$/, "") + "/messages";
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": targetKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: targetModel || "claude-3-7-sonnet-latest",
            max_tokens: 5,
            messages: [{ role: "user", content: "Say ready" }],
          }),
        });

        if (!resp.ok) {
          const errBody = await resp.text();
          let parsedMsg = errBody;
          try {
            const json = JSON.parse(errBody);
            parsedMsg = json.error?.message || errBody;
          } catch (_) {}
          return res.status(400).json({
            success: false,
            error: `Anthropic API error (${resp.status}): ${parsedMsg}`,
          });
        }

        return res.json({
          success: true,
          latencyMs: Date.now() - startTime,
          message: `Connected successfully to Anthropic Claude (${targetModel}).`,
        });
      }

      if (providerId === "ollama") {
        const url = (targetBaseUrl || "http://localhost:11434").replace(/\/+$/, "") + "/api/tags";
        const resp = await fetch(url);
        if (!resp.ok) {
          return res.status(400).json({ success: false, error: `Ollama host unreachable at ${url} (status ${resp.status}).` });
        }
        const data = await resp.json();
        const availableModels = (data.models || []).map((m: any) => m.name);
        return res.json({
          success: true,
          latencyMs: Date.now() - startTime,
          message: `Connected to Ollama. Installed models: ${availableModels.length > 0 ? availableModels.join(", ") : "None yet"}.`,
        });
      }

      return res.status(400).json({ success: false, error: `Unsupported provider "${providerId}".` });
    } catch (err: any) {
      console.error(`Connection test failed for ${providerId}:`, err);
      return res.status(500).json({
        success: false,
        error: `Connection failed: ${err.message || "Network error. Please check host and API credentials."}`,
      });
    }
  });

  // ==========================================
  // UNIFIED STREAMING CHAT ENDPOINT (/api/chat/stream)
  // ==========================================

  app.post("/api/chat/stream", async (req, res) => {
    const sId = getClientSessionId(req);
    const store = getSessionStore(sId);

    const {
      messages = [],
      systemInstruction = "",
      provider,
      model,
      temperature = 0.7,
      topP = 0.9,
      topK = 40,
      useSearch = false,
      useMaps = false,
    } = req.body;

    const activeProviderId = provider || store.activeProvider || "gemini";
    const providerConfig: Partial<ProviderConfig> = store.configs[activeProviderId] || {};
    const effectiveModel = model || providerConfig.selectedModel;
    const effectiveKey = providerConfig.apiKey || (activeProviderId === "gemini" ? process.env.GEMINI_API_KEY : "");
    const effectiveBaseUrl = providerConfig.baseUrl;

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const sendSSE = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      // 1. Google Gemini Provider
      if (activeProviderId === "gemini") {
        if (!effectiveKey) {
          throw new Error("Gemini API key is not configured. Please add one in Settings or set GEMINI_API_KEY.");
        }

        const ai = new GoogleGenAI({ apiKey: effectiveKey });

        // Build tools
        const tools: any[] = [];
        if (useSearch) tools.push({ googleSearch: {} });
        if (useMaps) tools.push({ googleMaps: {} });

        // Map messages into Gemini contents structure
        const contents = messages.map((m: any) => {
          const parts: any[] = [{ text: m.content || "" }];
          if (Array.isArray(m.attachments)) {
            m.attachments.forEach((att: string) => {
              if (att.startsWith("data:")) {
                const [header, b64] = att.split(";base64,");
                const mimeType = header.replace("data:", "");
                parts.push({
                  inlineData: {
                    mimeType,
                    data: b64,
                  },
                });
              }
            });
          }
          return {
            role: m.role === "assistant" ? "model" : m.role,
            parts,
          };
        });

        const responseStream = await ai.models.generateContentStream({
          model: effectiveModel || "gemini-3-flash-preview",
          contents,
          config: {
            systemInstruction: systemInstruction || undefined,
            tools: tools.length > 0 ? tools : undefined,
            temperature,
            topP,
            topK,
            safetySettings: [
              { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
          },
        });

        for await (const chunk of responseStream) {
          const text = chunk.text;
          const grounding = chunk.candidates?.[0]?.groundingMetadata;
          if (text) {
            sendSSE({ chunk: text });
          }
          if (grounding) {
            sendSSE({ metadata: grounding });
          }
        }

        sendSSE({ done: true });
        res.end();
        return;
      }

      // 2. OpenAI & Custom OpenAI-compatible Provider
      if (activeProviderId === "openai" || activeProviderId === "custom") {
        const url = (effectiveBaseUrl || (activeProviderId === "openai" ? "https://api.openai.com/v1" : "https://api.groq.com/openai/v1")).replace(/\/+$/, "") + "/chat/completions";
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (effectiveKey) headers["Authorization"] = `Bearer ${effectiveKey}`;

        const formattedMsgs: any[] = [];
        if (systemInstruction) {
          formattedMsgs.push({ role: "system", content: systemInstruction });
        }
        for (const m of messages) {
          const role = m.role === "model" ? "assistant" : m.role;
          if (Array.isArray(m.attachments) && m.attachments.length > 0) {
            const contentParts: any[] = [{ type: "text", text: m.content || "" }];
            for (const att of m.attachments) {
              if (att.startsWith("data:image")) {
                contentParts.push({ type: "image_url", image_url: { url: att } });
              }
            }
            formattedMsgs.push({ role, content: contentParts });
          } else {
            formattedMsgs.push({ role, content: m.content || "" });
          }
        }

        const resp = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: effectiveModel || (activeProviderId === "openai" ? "gpt-4o" : "llama-3.3-70b-versatile"),
            messages: formattedMsgs,
            temperature,
            top_p: topP,
            stream: true,
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`${activeProviderId.toUpperCase()} API returned error ${resp.status}: ${errText}`);
        }

        const reader = resp.body?.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;
              const dataStr = trimmed.slice(6);
              if (dataStr === "[DONE]") {
                sendSSE({ done: true });
                res.end();
                return;
              }
              try {
                const parsed = JSON.parse(dataStr);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  sendSSE({ chunk: delta });
                }
              } catch (_) {}
            }
          }
        }
        sendSSE({ done: true });
        res.end();
        return;
      }

      // 3. Anthropic Claude Provider
      if (activeProviderId === "anthropic") {
        if (!effectiveKey) {
          throw new Error("Anthropic API key is required. Please set it in Settings.");
        }
        const url = (effectiveBaseUrl || "https://api.anthropic.com/v1").replace(/\/+$/, "") + "/messages";

        const anthropicMsgs = messages.map((m: any) => ({
          role: m.role === "model" ? "assistant" : m.role,
          content: m.content || "",
        }));

        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": effectiveKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: effectiveModel || "claude-3-7-sonnet-latest",
            system: systemInstruction || undefined,
            messages: anthropicMsgs,
            max_tokens: 4096,
            temperature,
            stream: true,
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`Anthropic API returned error ${resp.status}: ${errText}`);
        }

        const reader = resp.body?.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;
              const dataStr = trimmed.slice(6);
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                  sendSSE({ chunk: parsed.delta.text });
                } else if (parsed.type === "message_stop") {
                  sendSSE({ done: true });
                  res.end();
                  return;
                }
              } catch (_) {}
            }
          }
        }
        sendSSE({ done: true });
        res.end();
        return;
      }

      // 4. Ollama Provider
      if (activeProviderId === "ollama") {
        const url = (effectiveBaseUrl || "http://localhost:11434").replace(/\/+$/, "") + "/api/chat";
        const ollamaMsgs = [];
        if (systemInstruction) {
          ollamaMsgs.push({ role: "system", content: systemInstruction });
        }
        for (const m of messages) {
          ollamaMsgs.push({
            role: m.role === "model" ? "assistant" : m.role,
            content: m.content || "",
          });
        }

        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: effectiveModel || "llama3.2",
            messages: ollamaMsgs,
            stream: true,
            options: {
              temperature,
              top_p: topP,
              top_k: topK,
            },
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`Ollama host error ${resp.status}: ${errText}`);
        }

        const reader = resp.body?.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              try {
                const parsed = JSON.parse(trimmed);
                if (parsed.message?.content) {
                  sendSSE({ chunk: parsed.message.content });
                }
                if (parsed.done) {
                  sendSSE({ done: true });
                  res.end();
                  return;
                }
              } catch (_) {}
            }
          }
        }
        sendSSE({ done: true });
        res.end();
        return;
      }

      throw new Error(`Unrecognized provider: ${activeProviderId}`);
    } catch (streamError: any) {
      console.error("Chat streaming error:", streamError);
      sendSSE({ error: streamError.message || "An error occurred while streaming response." });
      res.end();
    }
  });

  // ==========================================
  // GEMINI LIVE VOICE EPHEMERAL TOKEN ENDPOINT
  // ==========================================

  app.post("/api/live/token", async (req, res) => {
    const sId = getClientSessionId(req);
    const store = getSessionStore(sId);
    const geminiKey = store.configs.gemini?.apiKey || process.env.GEMINI_API_KEY;

    if (!geminiKey) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY is not configured on the server. Please provide a key in Settings.",
      });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const authToken = await ai.authTokens.create({});
      return res.json({
        success: true,
        token: authToken.name,
      });
    } catch (err: any) {
      console.error("Failed to generate Live ephemeral token:", err);
      return res.status(500).json({
        success: false,
        error: `Could not create ephemeral token: ${err.message}. If the developer API key does not support ephemeral tokens, please check API project permissions.`,
      });
    }
  });

  // ==========================================
  // SECURE MEDIA GENERATION ENDPOINTS
  // ==========================================

  // Image Generation
  app.post("/api/media/image", async (req, res) => {
    const sId = getClientSessionId(req);
    const store = getSessionStore(sId);
    const apiKey = store.configs.gemini?.apiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key is required for image generation." });
    }

    const { prompt, aspectRatio = "16:9", imageSize = "1K", personGeneration = "ALLOW_ADULT", model = "gemini-3-pro-image-preview" } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model,
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any,
            imageSize: imageSize as any,
            personGeneration: personGeneration as any,
          },
        },
      });

      const imagePart = response.candidates?.[0]?.content?.parts.find((p: any) => p.inlineData);
      if (imagePart?.inlineData?.data) {
        const imageUrl = `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`;
        return res.json({ success: true, imageUrl });
      }

      throw new Error("No image data returned from Gemini API");
    } catch (err: any) {
      console.error("Image generation error:", err);
      return res.status(500).json({ error: err.message || "Failed to generate image" });
    }
  });

  // Video Generation & Polling
  app.post("/api/media/video", async (req, res) => {
    const sId = getClientSessionId(req);
    const store = getSessionStore(sId);
    const apiKey = store.configs.gemini?.apiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key is required for video generation." });
    }

    const { prompt, aspectRatio = "16:9", resolution = "1080p", fps = 30, model = "veo-3.1-generate-preview" } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      let operation = await ai.models.generateVideos({
        model,
        prompt,
        config: {
          numberOfVideos: 1,
          aspectRatio: aspectRatio as any,
          resolution: resolution as any,
          fps,
        },
      });

      // Poll until done or timeout (max 3 minutes)
      const maxRetries = 36;
      let retries = 0;
      while (!operation.done && retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation });
        retries++;
      }

      if (!operation.done) {
        throw new Error("Video generation timed out while processing.");
      }

      const downloadUri = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadUri) {
        throw new Error("No video download URI found in response.");
      }

      // Fetch video using server API key and pipe back
      const videoResp = await fetch(downloadUri, {
        headers: { "x-goog-api-key": apiKey },
      });

      if (!videoResp.ok) {
        throw new Error(`Failed to download generated video: ${videoResp.statusText}`);
      }

      const videoBuffer = Buffer.from(await videoResp.arrayBuffer());
      const base64Video = `data:video/mp4;base64,${videoBuffer.toString("base64")}`;

      return res.json({ success: true, videoUrl: base64Video });
    } catch (err: any) {
      console.error("Video generation error:", err);
      return res.status(500).json({ error: err.message || "Failed to generate video" });
    }
  });

  // ==========================================
  // EXISTING GITHUB OAUTH & INTEGRATION ROUTES
  // ==========================================

  app.get("/api/auth/github/url", (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: "GITHUB_CLIENT_ID not configured" });
    }

    const redirectUri = `${process.env.APP_URL}/auth/github/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "repo user",
      state: "omniagent_auth_state",
    });

    res.json({ url: `https://github.com/login/oauth/authorize?${params.toString()}` });
  });

  app.get(["/auth/github/callback", "/auth/github/callback/"], async (req, res) => {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send("Missing code");
    }

    try {
      const redirectUri = `${process.env.APP_URL}/auth/github/callback`;
      const response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
        }),
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error_description || data.error);
      }

      res.cookie("github_token", data.access_token, {
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        httpOnly: true,
      });

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'GITHUB_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>GitHub connected! This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error("GitHub OAuth error:", error);
      res.status(500).send(`Authentication failed: ${error.message}`);
    }
  });

  app.get("/api/github/user", async (req, res) => {
    const token = req.cookies.github_token;
    if (!token) return res.status(401).json({ error: "Not connected to GitHub" });

    try {
      const octokit = new Octokit({ auth: token });
      const { data } = await octokit.rest.users.getAuthenticated();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch GitHub user" });
    }
  });

  app.post("/api/github/logout", (req, res) => {
    res.clearCookie("github_token", {
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      httpOnly: true,
    });
    res.json({ success: true });
  });

  // Supabase Config Route
  app.get("/api/config/supabase", (req, res) => {
    res.json({
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer,
        },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Sierra server running on http://localhost:${PORT}`);
  });
}

startServer();
