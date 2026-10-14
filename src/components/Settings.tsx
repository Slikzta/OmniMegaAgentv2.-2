import React, { useState, useEffect } from 'react';
import { 
  getProvidersConfig, 
  saveProviderConfig, 
  testProviderConnection, 
  ProviderInfo, 
  ProvidersConfigResponse 
} from '../lib/providers';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  Sparkles, 
  Settings as SettingsIcon, 
  Check, 
  AlertCircle, 
  Loader2, 
  Eye, 
  EyeOff, 
  Zap, 
  Cpu, 
  Smartphone, 
  ShieldCheck, 
  Radio, 
  Layers, 
  ArrowRight, 
  RefreshCw,
  Globe,
  Volume2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface SettingsProps {
  onNavigateToChat?: () => void;
}

const PROVIDER_METADATA: Record<string, {
  name: string;
  badge: string;
  description: string;
  models: { id: string; name: string }[];
  defaultUrl?: string;
  urlPlaceholder?: string;
  needsKey: boolean;
}> = {
  gemini: {
    name: 'Google Gemini',
    badge: 'Native • Multimodal • Live Voice',
    description: 'High-speed reasoning, 2M+ context window, Google Search and Maps grounding, and Gemini Live Voice.',
    models: [
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Fast & Natural)' },
      { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite (Ultra Fast)' },
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Deep Reasoner)' },
    ],
    needsKey: true,
  },
  openai: {
    name: 'OpenAI',
    badge: 'GPT-4o • Reasoning',
    description: 'Industry-standard flagship models with multimodal vision and conversational reasoning.',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o (Omni Multimodal)' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast & Cost-effective)' },
      { id: 'o1', name: 'o1 (Deep STEM Reasoning)' },
      { id: 'o3-mini', name: 'o3-mini (Next-Gen Reasoning)' },
    ],
    defaultUrl: 'https://api.openai.com/v1',
    urlPlaceholder: 'https://api.openai.com/v1',
    needsKey: true,
  },
  anthropic: {
    name: 'Anthropic Claude',
    badge: 'Claude 3.7 • Extended Thinking',
    description: 'Nuanced conversational prose, human-like empathy, creative roleplay, and deep technical comprehension.',
    models: [
      { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet (Hybrid Reasoning)' },
      { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet (Nuanced & Sharp)' },
      { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku (Instant Pacing)' },
    ],
    defaultUrl: 'https://api.anthropic.com/v1',
    urlPlaceholder: 'https://api.anthropic.com/v1',
    needsKey: true,
  },
  custom: {
    name: 'Custom OpenAI-Compatible',
    badge: 'Groq • Together • DeepSeek • LocalAI',
    description: 'Any OpenAI API compatible endpoint including Groq, Together AI, DeepSeek, vLLM, or OpenRouter.',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' },
      { id: 'deepseek-chat', name: 'DeepSeek Chat' },
      { id: 'custom-model', name: 'Custom Model ID (Type below)' },
    ],
    defaultUrl: 'https://api.groq.com/openai/v1',
    urlPlaceholder: 'https://api.groq.com/openai/v1',
    needsKey: false,
  },
  ollama: {
    name: 'Ollama (Local / Remote)',
    badge: 'Private • Offline • Self-Hosted',
    description: 'Run private local open-source models on your local machine or reachable local network host.',
    models: [
      { id: 'llama3.2', name: 'Llama 3.2 (Default)' },
      { id: 'mistral', name: 'Mistral 7B' },
      { id: 'qwen2.5', name: 'Qwen 2.5' },
      { id: 'custom-ollama', name: 'Custom Ollama Model' },
    ],
    defaultUrl: 'http://localhost:11434',
    urlPlaceholder: 'http://localhost:11434',
    needsKey: false,
  },
};

export default function SettingsView({ onNavigateToChat }: SettingsProps) {
  const [config, setConfig] = useState<ProvidersConfigResponse | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('gemini');
  const [activeTab, setActiveTab] = useState<'providers' | 'mobile' | 'voice'>('providers');
  const [isLoading, setIsLoading] = useState(true);

  // Form fields for currently selected provider
  const [formModel, setFormModel] = useState<string>('');
  const [customModelInput, setCustomModelInput] = useState<string>('');
  const [formKey, setFormKey] = useState<string>('');
  const [formUrl, setFormUrl] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);

  // Test status
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs?: number;
    message?: string;
    error?: string;
  } | null>(null);

  // Save status
  const [isSaving, setIsSaving] = useState(false);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const data = await getProvidersConfig();
      setConfig(data);
      setSelectedProviderId(data.activeProvider || 'gemini');
    } catch (err: any) {
      console.error('Failed to load settings:', err);
      toast.error('Could not load AI provider configuration');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  // Update form inputs when selected provider changes
  useEffect(() => {
    if (!config || !selectedProviderId) return;
    const provider = config.providers[selectedProviderId];
    if (provider) {
      setFormModel(provider.selectedModel || PROVIDER_METADATA[selectedProviderId]?.models[0]?.id || '');
      setFormUrl(provider.baseUrl || PROVIDER_METADATA[selectedProviderId]?.defaultUrl || '');
      setFormKey(''); // Don't prepopulate masked keys in plain text
      setTestResult(null);
      setShowKey(false);
    }
  }, [selectedProviderId, config]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    const modelToUse = formModel === 'custom-model' || formModel === 'custom-ollama' 
      ? customModelInput.trim() 
      : formModel;

    try {
      const result = await testProviderConnection({
        providerId: selectedProviderId,
        apiKey: formKey.trim() || undefined,
        model: modelToUse || undefined,
        baseUrl: formUrl.trim() || undefined,
      });

      setTestResult(result);
      if (result.success) {
        toast.success(`Connected to ${PROVIDER_METADATA[selectedProviderId]?.name}!`);
      } else {
        toast.error(`Connection failed: ${result.error}`);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err.message || 'Unknown network error occurred',
      });
      toast.error('Failed to test connection');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveAndActivate = async (setAsActive: boolean = true) => {
    setIsSaving(true);
    try {
      const modelToUse = formModel === 'custom-model' || formModel === 'custom-ollama'
        ? customModelInput.trim()
        : formModel;

      await saveProviderConfig({
        activeProvider: setAsActive ? selectedProviderId : undefined,
        providerId: selectedProviderId,
        apiKey: formKey.trim() || undefined,
        model: modelToUse || undefined,
        baseUrl: formUrl.trim() || undefined,
      });

      await loadConfig();
      toast.success(
        setAsActive 
          ? `${PROVIDER_METADATA[selectedProviderId]?.name} set as active AI provider!` 
          : `Settings saved for ${PROVIDER_METADATA[selectedProviderId]?.name}`
      );
    } catch (err: any) {
      toast.error(`Failed to save settings: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const currentProvider = config?.providers[selectedProviderId];
  const metadata = PROVIDER_METADATA[selectedProviderId];
  const activeProvider = config?.providers[config.activeProvider];

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-y-auto">
      {/* Top Header */}
      <div className="p-6 md:p-8 border-b border-zinc-800 bg-zinc-900/30 backdrop-blur-xl sticky top-0 z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                System & AI Settings
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Manage AI intelligence providers, secure API credentials, voice audio pipeline, and Android APK deployment.
              </p>
            </div>
          </div>
        </div>

        {/* Current Active Provider Status Badge */}
        {config && (
          <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 shadow-sm">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <div className="text-left">
              <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Active Engine</div>
              <div className="text-xs font-semibold text-white">
                {activeProvider?.name || 'Google Gemini'} • <span className="text-purple-400">{activeProvider?.selectedModel}</span>
              </div>
            </div>
            {onNavigateToChat && (
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={onNavigateToChat}
                className="h-7 text-xs ml-2 text-zinc-400 hover:text-white"
              >
                Chat <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="px-6 md:px-8 pt-6 pb-2 border-b border-zinc-800 flex gap-2">
        <button
          onClick={() => setActiveTab('providers')}
          className={cn(
            "px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all",
            activeTab === 'providers' 
              ? "bg-purple-600/20 text-purple-300 border border-purple-500/40" 
              : "text-zinc-400 hover:text-white hover:bg-zinc-900"
          )}
        >
          AI Providers & Engines
        </button>
        <button
          onClick={() => setActiveTab('voice')}
          className={cn(
            "px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all",
            activeTab === 'voice' 
              ? "bg-purple-600/20 text-purple-300 border border-purple-500/40" 
              : "text-zinc-400 hover:text-white hover:bg-zinc-900"
          )}
        >
          Live Voice & Audio
        </button>
        <button
          onClick={() => setActiveTab('mobile')}
          className={cn(
            "px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all",
            activeTab === 'mobile' 
              ? "bg-purple-600/20 text-purple-300 border border-purple-500/40" 
              : "text-zinc-400 hover:text-white hover:bg-zinc-900"
          )}
        >
          Android APK & Mobile PWA
        </button>
      </div>

      <div className="p-6 md:p-8 max-w-6xl w-full mx-auto space-y-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 gap-3 text-zinc-500">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
            <span className="text-sm">Loading provider configuration...</span>
          </div>
        ) : activeTab === 'providers' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Provider Selector Column */}
            <div className="lg:col-span-4 space-y-3">
              <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">
                Supported Providers
              </h2>
              {Object.entries(PROVIDER_METADATA).map(([id, meta]) => {
                const isSelected = selectedProviderId === id;
                const isActive = config?.activeProvider === id;
                const provInfo = config?.providers[id];

                return (
                  <div
                    key={id}
                    onClick={() => setSelectedProviderId(id)}
                    className={cn(
                      "p-4 rounded-2xl border cursor-pointer transition-all duration-200 relative",
                      isSelected 
                        ? "bg-zinc-900 border-purple-500/50 shadow-md ring-1 ring-purple-500/20" 
                        : "bg-zinc-900/40 border-zinc-800/80 hover:bg-zinc-900 hover:border-zinc-700"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-3 h-3 rounded-full flex items-center justify-center",
                          isActive ? "bg-green-500" : provInfo?.hasKey ? "bg-purple-500" : "bg-zinc-600"
                        )} />
                        <span className="font-semibold text-sm text-white">{meta.name}</span>
                      </div>
                      {isActive && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{meta.badge}</p>
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-zinc-800/60 text-[11px] text-zinc-400">
                      <span>Model: <strong className="text-zinc-200 font-medium">{provInfo?.selectedModel || meta.models[0]?.name}</strong></span>
                      {provInfo?.hasKey && (
                        <span className="text-purple-400 ml-auto flex items-center gap-1">
                          <Check className="w-3 h-3" /> Configured
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Provider Configuration Details Column */}
            <div className="lg:col-span-8">
              <Card className="bg-zinc-900/60 border-zinc-800 shadow-xl rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-zinc-800/80 bg-zinc-900/80 p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                        {metadata?.name}
                        {config?.activeProvider === selectedProviderId && (
                          <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full font-medium">
                            Currently Active
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs text-zinc-400 mt-1">
                        {metadata?.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                  {/* Capabilities Matrix */}
                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                      Capabilities Breakdown
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className={cn(
                        "p-2.5 rounded-xl border text-xs flex items-center gap-2",
                        currentProvider?.capabilities.streaming 
                          ? "bg-purple-950/20 border-purple-800/40 text-purple-300" 
                          : "bg-zinc-900 border-zinc-800 text-zinc-500"
                      )}>
                        <Zap className="w-3.5 h-3.5" /> Streaming Chat
                      </div>
                      <div className={cn(
                        "p-2.5 rounded-xl border text-xs flex items-center gap-2",
                        currentProvider?.capabilities.multimodal 
                          ? "bg-purple-950/20 border-purple-800/40 text-purple-300" 
                          : "bg-zinc-900 border-zinc-800 text-zinc-500"
                      )}>
                        <Layers className="w-3.5 h-3.5" /> Vision / Files
                      </div>
                      <div className={cn(
                        "p-2.5 rounded-xl border text-xs flex items-center gap-2",
                        currentProvider?.capabilities.grounding 
                          ? "bg-purple-950/20 border-purple-800/40 text-purple-300" 
                          : "bg-zinc-900 border-zinc-800 text-zinc-500"
                      )}>
                        <Globe className="w-3.5 h-3.5" /> Live Search Grounding
                      </div>
                      <div className={cn(
                        "p-2.5 rounded-xl border text-xs flex items-center gap-2",
                        currentProvider?.capabilities.liveVoice 
                          ? "bg-purple-950/20 border-purple-800/40 text-purple-300" 
                          : "bg-zinc-900 border-zinc-800 text-zinc-500"
                      )}>
                        <Volume2 className="w-3.5 h-3.5" /> Live Voice API
                      </div>
                    </div>
                  </div>

                  {/* Model Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Model Selection
                    </label>
                    <Select value={formModel} onValueChange={setFormModel}>
                      <SelectTrigger className="w-full bg-zinc-900 border-zinc-800 text-white rounded-xl h-11">
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                        {metadata?.models.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {(formModel === 'custom-model' || formModel === 'custom-ollama') && (
                      <div className="pt-2">
                        <Input
                          placeholder="Type custom model ID (e.g. mistral-large-latest or deepseek-r1)"
                          value={customModelInput}
                          onChange={(e) => setCustomModelInput(e.target.value)}
                          className="bg-zinc-900 border-zinc-800 text-white rounded-xl h-10"
                        />
                      </div>
                    )}
                  </div>

                  {/* Base URL (for OpenAI, Anthropic, Custom, Ollama) */}
                  {metadata?.defaultUrl && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                          API Base URL / Endpoint
                        </label>
                        <button
                          type="button"
                          onClick={() => setFormUrl(metadata.defaultUrl || '')}
                          className="text-[11px] text-purple-400 hover:underline"
                        >
                          Reset to default
                        </button>
                      </div>
                      <Input
                        value={formUrl}
                        onChange={(e) => setFormUrl(e.target.value)}
                        placeholder={metadata.urlPlaceholder}
                        className="bg-zinc-900 border-zinc-800 text-white rounded-xl h-11 font-mono text-xs"
                      />
                      <p className="text-[11px] text-zinc-500">
                        Custom endpoints allow connecting to local gateways, proxies, or compatible providers.
                      </p>
                    </div>
                  )}

                  {/* API Key */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                        API Key {metadata?.needsKey ? '(Required)' : '(Optional)'}
                      </label>
                      {currentProvider?.isEnvKey && (
                        <span className="text-[11px] text-green-400 flex items-center gap-1 font-medium">
                          <Check className="w-3 h-3" /> System Environment Key Configured
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        type={showKey ? 'text' : 'password'}
                        value={formKey}
                        onChange={(e) => setFormKey(e.target.value)}
                        placeholder={
                          currentProvider?.isEnvKey
                            ? 'Using server GEMINI_API_KEY (leave empty or enter custom key)'
                            : currentProvider?.hasKey
                            ? '•••••••••••••••••••••••• (Leave blank to keep existing)'
                            : 'Enter API key...'
                        }
                        className="bg-zinc-900 border-zinc-800 text-white rounded-xl h-11 pr-10 font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                      >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Keys are protected server-side and never exposed in client bundles or public databases.
                    </p>
                  </div>

                  {/* Test Connection Result Box */}
                  <AnimatePresence>
                    {testResult && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={cn(
                          "p-4 rounded-xl border text-xs flex items-start gap-3",
                          testResult.success
                            ? "bg-green-500/10 border-green-500/30 text-green-300"
                            : "bg-red-500/10 border-red-500/30 text-red-300"
                        )}
                      >
                        {testResult.success ? (
                          <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className="font-semibold">
                            {testResult.success ? 'Connection Verified' : 'Connection Failed'}
                            {testResult.latencyMs !== undefined && ` (${testResult.latencyMs}ms latency)`}
                          </div>
                          <div className="mt-1 text-[11px] opacity-90">
                            {testResult.message || testResult.error}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>

                <CardFooter className="border-t border-zinc-800/80 bg-zinc-900/40 p-6 flex flex-wrap items-center justify-between gap-4">
                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="border-zinc-700 hover:bg-zinc-800 text-zinc-200 h-10 px-4 rounded-xl gap-2 text-xs font-semibold"
                  >
                    {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5 text-purple-400" />}
                    Test Connection
                  </Button>

                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() => handleSaveAndActivate(false)}
                      disabled={isSaving}
                      className="border-zinc-700 hover:bg-zinc-800 text-zinc-300 h-10 px-4 rounded-xl text-xs"
                    >
                      Save Configuration
                    </Button>
                    <Button
                      onClick={() => handleSaveAndActivate(true)}
                      disabled={isSaving}
                      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold h-10 px-5 rounded-xl shadow-lg shadow-purple-600/20 text-xs gap-2"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Set as Active Engine
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </div>
          </div>
        ) : activeTab === 'voice' ? (
          /* Live Voice & Audio Architecture Tab */
          <div className="space-y-6">
            <Card className="bg-zinc-900/60 border-zinc-800 shadow-xl rounded-2xl p-6">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-purple-400" />
                Live Voice & Audio Loop Architecture
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400 mt-1">
                Audio echo cancellation, zero-feedback ScriptProcessor pipeline, and low-latency continuous conversation.
              </CardDescription>

              <div className="mt-6 space-y-4 text-xs text-zinc-300 leading-relaxed">
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-green-400" />
                    Echo-Cancellation & Feedback Loop Prevention
                  </h3>
                  <p className="text-zinc-400">
                    Microphone capture routes through browser Hardware Acoustic Echo Cancellation (`echoCancellation: true`), Noise Suppression, and an isolated Zero-Gain node so spoken audio never plays through the speakers into the room.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-purple-400" />
                    AudioContext Memory Preservation
                  </h3>
                  <p className="text-zinc-400">
                    A persistent 24,000 Hz AudioContext schedules PCM chunks along a monotonic time horizon (`currentTime`), eliminating the memory leak and freezing bug caused by recreating AudioContexts on incoming packets.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-blue-400" />
                    Server-Side Ephemeral Token Protocol
                  </h3>
                  <p className="text-zinc-400">
                    Client connections to the Gemini Live WebSockets request short-lived ephemeral tokens from `/api/live/token`, ensuring the permanent `GEMINI_API_KEY` is never exposed to browser memory.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          /* Mobile PWA & Android Packaging Tab */
          <div className="space-y-6">
            <Card className="bg-zinc-900/60 border-zinc-800 shadow-xl rounded-2xl p-6">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-purple-400" />
                Android APK & Mobile PWA Readiness
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400 mt-1">
                Verified configuration for installing Sierra directly on Android devices as a native-feeling application or compiling into a standalone APK.
              </CardDescription>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
                  <div className="flex items-center gap-2 text-green-400 font-bold text-sm">
                    <Check className="w-4 h-4" /> Web App Manifest Configured
                  </div>
                  <p className="text-xs text-zinc-400">
                    Full Web App Manifest with portrait orientation, standalone display mode, `#09090b` theme color, and 192x192 &amp; 512x512 maskable icon assets.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
                  <div className="flex items-center gap-2 text-green-400 font-bold text-sm">
                    <Check className="w-4 h-4" /> Service Worker &amp; Offline Precaching
                  </div>
                  <p className="text-xs text-zinc-400">
                    Integrated `vite-plugin-pwa` with auto-updating background worker to cache shell assets and guarantee offline reliability on Android.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
                  <div className="flex items-center gap-2 text-green-400 font-bold text-sm">
                    <Check className="w-4 h-4" /> Android Viewport &amp; Safe Area Insets
                  </div>
                  <p className="text-xs text-zinc-400">
                    `viewport-fit=cover` and touch-friendly controls ensure seamless navigation on mobile devices with camera notches and navigation bars.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
                  <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                    <Smartphone className="w-4 h-4" /> Instant Android Installation
                  </div>
                  <p className="text-xs text-zinc-400">
                    Open Sierra in Google Chrome on any Android phone and tap <strong>&ldquo;Add to Home Screen&rdquo;</strong> or <strong>&ldquo;Install App&rdquo;</strong> to launch as a full-screen native Android app.
                  </p>
                </div>
              </div>

              <div className="mt-6 p-5 rounded-2xl bg-purple-950/20 border border-purple-800/30 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300">
                  Converting to APK via TWA (Trusted Web Activity)
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  To produce an `.apk` file for sideloading or Google Play distribution, run Google&rsquo;s official Bubblewrap CLI against this URL:
                </p>
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 font-mono text-[11px] text-purple-300 select-all overflow-x-auto">
                  npx @bubblewrap/cli init --manifest=https://[YOUR_APP_URL]/manifest.webmanifest
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
