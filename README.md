# OmniAgent: The Ultimate AI

OmniAgent is a comprehensive multimodal AI platform powered by Google Gemini, combining multimodal conversational intelligence, real-time live duplex voice, image and video generation, grounding with Google Search & Maps, and GitHub repository integrations into an adaptive Android and web experience.

## Key Features

- **Multimodal Chat**: Natural dialogue with text, attachments, images, and live camera feed support. Supports multiple personas (Sierra Companion, Sierra Creative & Roleplay, Sierra Architect & Code, and OmniAgent Classic).
- **Real-Time Grounding**: Real-time factual accuracy powered by Google Search and Google Maps grounding chunks.
- **Media Generator**: High-fidelity AI image generation powered by Imagen 3 Pro and cinematic video generation powered by Veo with customizable aspect ratios, styles, and resolutions.
- **Live Voice Interaction**: Duplex real-time conversational voice powered by Gemini Live Web Audio streaming with Aoede, Zephyr, Kore, and Puck voices.
- **Integrations**: Direct GitHub workspace connectivity via Octokit to explore repos, branches, commits, and pull requests.
- **Mobile-First Android UX**: Built with an adaptive Material 3 navigation system featuring a dedicated Android bottom navigation bar, haptic feedback, safe area insets, and desktop sidebar responsiveness.
- **Cross-Platform Architecture**: Configured with Capacitor Android (`com.sierra.omniagent`) for Android deployments.

## Running Locally

**Prerequisites**: Node.js 22+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env`:
   ```bash
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

4. Build production bundle:
   ```bash
   npm run build
   ```
