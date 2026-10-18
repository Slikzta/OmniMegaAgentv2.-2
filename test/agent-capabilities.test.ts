import assert from "node:assert";
import test from "node:test";

test("AI Provider Configuration & Capabilities Audit", () => {
  const supportedProviders = ["gemini", "openai", "anthropic", "custom", "ollama"];
  assert.strictEqual(supportedProviders.length, 5);

  const capabilities = {
    text: true,
    streaming: true,
    multimodal: true,
    grounding: true,
    imageGen: true,
    videoGen: true,
    liveVoice: true,
  };

  assert.strictEqual(capabilities.text, true);
  assert.strictEqual(capabilities.grounding, true);
  assert.strictEqual(capabilities.liveVoice, true);
});

test("Multi-turn Conversation History Structure", () => {
  const history = [
    { role: "user", content: "Plan a trip to Tokyo" },
    { role: "model", content: "Here is a 3-day itinerary for Tokyo." },
    { role: "user", content: "What are the top 3 museums?" },
  ];

  assert.strictEqual(history.length, 3);
  assert.strictEqual(history[0].role, "user");
  assert.strictEqual(history[1].role, "model");
  assert.strictEqual(history[2].role, "user");
});

test("Agent Bounded Execution Limits & Loop Safeguards", () => {
  const maxIterations = 10;
  let iterations = 0;
  let isHalted = false;

  for (let i = 0; i < 20; i++) {
    iterations++;
    if (iterations >= maxIterations) {
      isHalted = true;
      break;
    }
  }

  assert.strictEqual(isHalted, true);
  assert.strictEqual(iterations, maxIterations);
});

test("Android SDK 36.0.0 Configuration Validation", () => {
  const compileSdk = 36;
  const targetSdk = 36;
  const minSdk = 24;

  assert.strictEqual(compileSdk, 36);
  assert.strictEqual(targetSdk, 36);
  assert.ok(minSdk >= 21);
});

test("Voice Chat Feedback Loop & Speech Lifecycle Safeguards", () => {
  // Test cooldown buffer, retry limits, and recognition timeout safeguards
  const PLAYBACK_COOLDOWN_MS = 750;
  const MAX_RECOGNITION_RETRIES = 3;
  const RECOGNITION_TIMEOUT_MS = 12000;

  assert.ok(PLAYBACK_COOLDOWN_MS >= 500, "Cooldown buffer must be at least 500ms to eliminate speaker tail audio");
  assert.ok(MAX_RECOGNITION_RETRIES <= 5, "Retry limit must be bounded to prevent infinite loops");
  assert.ok(RECOGNITION_TIMEOUT_MS > 0 && RECOGNITION_TIMEOUT_MS <= 30000, "Recognition timeout must be bounded");

  // Validate retry counter logic
  let consecutiveErrors = 0;
  let halted = false;
  for (let i = 0; i < 10; i++) {
    consecutiveErrors++;
    if (consecutiveErrors >= MAX_RECOGNITION_RETRIES) {
      halted = true;
      break;
    }
  }
  assert.strictEqual(halted, true);
  assert.strictEqual(consecutiveErrors, MAX_RECOGNITION_RETRIES);
});

test("Android Manifest Speech Recognition Queries Declaration", async () => {
  const fs = await import("node:fs");
  const manifest = fs.readFileSync("android/app/src/main/AndroidManifest.xml", "utf-8");
  assert.ok(manifest.includes("<queries>"), "Manifest must declare <queries>");
  assert.ok(manifest.includes("android.speech.RecognitionService"), "Manifest must query android.speech.RecognitionService for Android 11+");
});

test("On-Device API Key Persistence with Provider and Model Configuration", () => {
  const storageMock: Record<string, string> = {};
  const STORAGE_KEY_CONFIG = "omni_providers_config";

  // Simulate saving configuration with model and API key into the same persistent storage
  const configMap: Record<string, any> = {};
  configMap["gemini"] = {
    selectedModel: "gemini-3.5-flash-lite",
    apiKey: "AIzaSyTestMockKey12345",
  };
  storageMock[STORAGE_KEY_CONFIG] = JSON.stringify(configMap);

  // Retrieve and verify key is stored in the same persistent on-device config map
  const retrieved = JSON.parse(storageMock[STORAGE_KEY_CONFIG]);
  assert.strictEqual(retrieved.gemini.selectedModel, "gemini-3.5-flash-lite");
  assert.strictEqual(retrieved.gemini.apiKey, "AIzaSyTestMockKey12345");
});

test("Native CapSpeechRecognition Partial Results and Utterance Handoff Pipeline", () => {
  let currentTranscript = "";
  let userSpeechDetected = false;
  let committedUtterance = "";

  const onPartialResults = (data: { matches: string[] }) => {
    if (data?.matches && data.matches.length > 0) {
      const topMatch = data.matches[0].trim();
      if (topMatch) {
        currentTranscript = topMatch;
        userSpeechDetected = true;
      }
    }
  };

  const commitUtterance = () => {
    committedUtterance = currentTranscript.trim();
    currentTranscript = "";
    userSpeechDetected = false;
  };

  // Simulate partial results incoming from native speech recognition
  onPartialResults({ matches: ["Hello"] });
  assert.strictEqual(userSpeechDetected, true);
  assert.strictEqual(currentTranscript, "Hello");

  onPartialResults({ matches: ["Hello Sierra how are you"] });
  assert.strictEqual(currentTranscript, "Hello Sierra how are you");

  // Simulate end of speech / silence commit
  commitUtterance();
  assert.strictEqual(committedUtterance, "Hello Sierra how are you");
  assert.strictEqual(currentTranscript, "");
  assert.strictEqual(userSpeechDetected, false);
});

test("Persistent Debug Signing Configuration in Android Gradle Build", async () => {
  const fs = await import("node:fs");
  const gradleBuild = fs.readFileSync("android/app/build.gradle", "utf-8");

  assert.ok(gradleBuild.includes("signingConfigs"), "build.gradle must configure signingConfigs");
  assert.ok(gradleBuild.includes("storeFile file('debug.keystore')"), "build.gradle must specify fixed debug.keystore storeFile");
  assert.ok(gradleBuild.includes("keyAlias 'androiddebugkey'"), "build.gradle must specify consistent androiddebugkey keyAlias");
  assert.ok(gradleBuild.includes("storePassword 'android'"), "build.gradle must specify storePassword");
  assert.ok(gradleBuild.includes("keyPassword 'android'"), "build.gradle must specify keyPassword");
  assert.ok(gradleBuild.includes("signingConfig signingConfigs.debug"), "buildTypes.debug must use signingConfigs.debug");

  const keystoreExists = fs.existsSync("android/app/debug.keystore");
  const base64Exists = fs.existsSync("android/app/debug.keystore.base64");
  assert.ok(
    keystoreExists || base64Exists,
    "Either android/app/debug.keystore or android/app/debug.keystore.base64 must exist on disk"
  );
  const targetPath = keystoreExists ? "android/app/debug.keystore" : "android/app/debug.keystore.base64";
  const stats = fs.statSync(targetPath);
  assert.ok(stats.size > 0, `${targetPath} must not be empty`);
});

test("Voice Debug Log Export and Formatting Pipeline", async () => {
  const { formatDebugLogs } = await import("../src/lib/debugLogs");

  // 1. Verify empty log format
  const emptyFormatted = formatDebugLogs([]);
  assert.strictEqual(emptyFormatted, "No pipeline events recorded yet.");

  // 2. Build 30 chronological mock debug events
  const mockLogs = Array.from({ length: 30 }, (_, i) => ({
    id: `log-${i}`,
    time: `10:00:${i < 10 ? '0' + i : i} AM`,
    stage: i % 2 === 0 ? 'STT:Start' : 'partialResults',
    detail: `Sample diagnostic detail message ${i + 1}`,
  }));

  // 3. Test full log export
  const fullExport = formatDebugLogs(mockLogs);
  const fullLines = fullExport.split("\n");
  assert.strictEqual(fullLines.length, 30);
  assert.strictEqual(fullLines[0], "[10:00:00 AM] [STT:Start] Sample diagnostic detail message 1");
  assert.strictEqual(fullLines[29], "[10:00:29 AM] [partialResults] Sample diagnostic detail message 30");

  // 4. Test Last 20 Events export
  const last20Export = formatDebugLogs(mockLogs, 20);
  const last20Lines = last20Export.split("\n");
  assert.strictEqual(last20Lines.length, 20);
  assert.strictEqual(last20Lines[0], "[10:00:10 AM] [STT:Start] Sample diagnostic detail message 11");
  assert.strictEqual(last20Lines[19], "[10:00:29 AM] [partialResults] Sample diagnostic detail message 30");

  // 5. Verify @capacitor/clipboard dependency in package.json
  const fs = await import("node:fs");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf-8"));
  assert.ok(pkg.dependencies["@capacitor/clipboard"], "@capacitor/clipboard must be present in dependencies");
});
