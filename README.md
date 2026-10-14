# OmniAgent: The Ultimate AI (Android & Web)

OmniAgent is a frontier multimodal super-agent application combining the power of Gemini 3, Veo 3.1, Claude 3.7, and GPT-4o into a unified mobile and desktop experience.

## Android Architecture

- **Native Jetpack Compose UI**: Built with Material Design 3, dynamic theming, edge-to-edge support (`enableEdgeToEdge()`), and adaptive navigation.
- **Kotlin Clean Architecture**: Structured with repository patterns (`OmniAgentRepository`), state management with Kotlin Coroutines/Flow, and ViewModels.
- **Adaptive Launcher Icon**: Custom generated adaptive icon featuring a luminous AI core on deep obsidian navy (`#0B0F19`) background across all standard mipmap densities (`mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`).
- **Permissions & Hardware Access**: Proper Android runtime permissions for audio capture, network state, wake lock, and camera.

## Core Features Preserved

1. **Multimodal Chat Studio**:
   - Conversational streaming responses with syntax-highlighted code blocks.
   - Persona switching: Sierra (Companion), Sierra (Creative & Roleplay), Sierra (Architect & Code), and OmniAgent (Classic).
   - Real-time Grounding with Google Search and Google Maps.
   - Conversation sessions with persistence.

2. **Media Generation Studio**:
   - Image generation with Imagen / Gemini Pro with custom aspect ratios (`1:1`, `16:9`, `9:16`, `4:3`, `3:4`), resolutions, and styles (Photorealistic, Artistic, Cinematic, Raw Prompt).
   - Video synthesis with Veo 3.1 supporting custom FPS (`24`, `30`, `60`), resolutions (`720p`, `1080p`, `4k`), and progress updates.

3. **Live Voice Experience**:
   - Bi-directional duplex real-time speech interaction powered by Gemini Live Audio.
   - Animated pulsating waveform orb visualizer.
   - Neural voice personas: Aoede, Zephyr, Kore, and Puck.
   - Live transcript streaming feed.

4. **Integrations**:
   - GitHub Developer OAuth for browsing repositories, branches, and commits.
   - Firebase Authentication & Firestore cloud persistence.
   - Supabase vector database for persistent context and grounding.

5. **AI Provider Engine & Settings**:
   - Multi-provider switching: Google Gemini, OpenAI, Anthropic Claude, and Custom OpenAI-Compatible (Groq, Together AI, Ollama).
   - In-app connection tester measuring network latency and verifying API key validity.

## Build and Compilation

```bash
# Verify TypeScript / Lint
npm run lint

# Build web distribution and sync to Android
npm run build
```
