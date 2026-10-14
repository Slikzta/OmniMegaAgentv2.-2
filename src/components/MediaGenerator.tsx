import React, { useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import { Button } from './ui/button';
import { MODELS, ASPECT_RATIOS, IMAGE_SIZES, VIDEO_RESOLUTIONS, VIDEO_MODELS, VIDEO_FPS } from '../lib/gemini';
import { generateMediaImage, generateMediaVideo } from '../lib/providers';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Loader2, Download, Sparkles, Wand2, Film, Image as ImageIcon, Camera, Palette } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

const STYLE_PERSONAS = [
  { id: 'none', name: 'Raw Prompt', icon: Wand2, suffix: '' },
  { id: 'photorealistic', name: 'Photorealistic', icon: Camera, suffix: ', hyperrealistic, 8k resolution, cinematic lighting, highly detailed, professional photography, masterpiece, sharp focus, realistic textures' },
  { id: 'artistic', name: 'Artistic', icon: Palette, suffix: ', digital art, vibrant colors, stylized, creative composition, trending on artstation, sharp details' },
  { id: 'cinematic', name: 'Cinematic', icon: Film, suffix: ', cinematic shot, movie still, dramatic lighting, anamorphic lens, high contrast, atmospheric' }
];

export default function MediaGenerator() {
  const [user] = useAuthState(auth);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [type, setType] = useState<'image' | 'video'>('image');
  
  // Settings
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [imageSize, setImageSize] = useState<string>("1K");
  const [personGeneration, setPersonGeneration] = useState<string>("ALLOW_ADULT");
  const [resolution, setResolution] = useState<string>("1080p");
  const [fps, setFps] = useState<number>(30);
  const [videoModel, setVideoModel] = useState<string>(MODELS.VIDEO_PRO);
  const [selectedStyleId, setSelectedStyleId] = useState<string>('none');

  const generateImage = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setResultUrl(null);

    try {
      const style = STYLE_PERSONAS.find(s => s.id === selectedStyleId);
      const finalPrompt = prompt + (style?.suffix || '');

      const imageUrl = await generateMediaImage({
        prompt: finalPrompt,
        aspectRatio,
        imageSize,
        personGeneration,
        model: MODELS.IMAGE_PRO,
      });

      setResultUrl(imageUrl);
      toast.success("Image generated successfully!");
    } catch (error: any) {
      console.error("Image generation error:", error);
      toast.error(error.message || "Failed to generate image.");
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  const generateVideo = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setProgress(20);
    setStatusMessage('Synthesizing video on server (this may take up to 60-90 seconds)...');
    setResultUrl(null);

    try {
      const style = STYLE_PERSONAS.find(s => s.id === selectedStyleId);
      const finalPrompt = prompt + (style?.suffix || '');

      const finalResolution = (videoModel === MODELS.VIDEO && resolution === '4k') ? '1080p' : resolution;
      if (videoModel === MODELS.VIDEO && resolution === '4k') {
        toast.info("Veo Fast supports up to 1080p. Adjusting resolution...");
      }

      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev === null) return 20;
          if (prev < 90) return prev + 10;
          return prev;
        });
      }, 8000);

      const videoUrl = await generateMediaVideo({
        prompt: finalPrompt,
        aspectRatio,
        resolution: finalResolution,
        fps,
        model: videoModel,
      });

      clearInterval(progressInterval);
      setProgress(100);
      setResultUrl(videoUrl);
      toast.success("Video generated successfully!");
    } catch (error: any) {
      console.error("Video generation error:", error);
      toast.error(error.message || "Failed to generate video.");
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-zinc-950">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent">
            Creative Engine
          </h1>
          <p className="text-zinc-400">Transform your imagination into high-fidelity visual assets.</p>
        </header>

        <Card className="bg-zinc-900 border-zinc-800 shadow-2xl overflow-hidden">
          <CardHeader className="border-b border-zinc-800 bg-zinc-900/50">
            <div className="flex items-center justify-between">
              <div className="flex gap-1 p-1 bg-zinc-950 rounded-lg border border-zinc-800">
                <Button 
                  variant={type === 'image' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  onClick={() => setType('image')}
                  className="gap-2"
                >
                  <ImageIcon className="w-4 h-4" /> Image
                </Button>
                <Button 
                  variant={type === 'video' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  onClick={() => setType('video')}
                  className="gap-2"
                >
                  <Film className="w-4 h-4" /> Video
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Veo 3.1 & Pro Image</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={type === 'image' ? "A futuristic neon city in the style of cyberpunk..." : "A cinematic drone shot of a misty mountain range at sunrise..."}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm focus:ring-2 focus:ring-purple-500/50 transition-all min-h-[120px] resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Aspect Ratio</label>
                  <Select value={aspectRatio} onValueChange={setAspectRatio}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      {ASPECT_RATIOS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Style Persona</label>
                  <Select value={selectedStyleId} onValueChange={setSelectedStyleId}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      {STYLE_PERSONAS.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center gap-2">
                            <s.icon className="w-3.5 h-3.5" />
                            <span>{s.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {type === 'image' ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Quality</label>
                      <Select value={imageSize} onValueChange={setImageSize}>
                        <SelectTrigger className="bg-zinc-950 border-zinc-800 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800">
                          {IMAGE_SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">People</label>
                      <Select value={personGeneration} onValueChange={setPersonGeneration}>
                        <SelectTrigger className="bg-zinc-950 border-zinc-800 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800">
                          <SelectItem value="ALLOW_ADULT">Allow Adults</SelectItem>
                          <SelectItem value="DONT_ALLOW">Don't Allow</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="hidden lg:block" /> {/* Spacer */}
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Model</label>
                      <Select value={videoModel} onValueChange={setVideoModel}>
                        <SelectTrigger className="bg-zinc-950 border-zinc-800 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800">
                          {VIDEO_MODELS.map(m => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Resolution</label>
                      <Select value={resolution} onValueChange={setResolution}>
                        <SelectTrigger className="bg-zinc-950 border-zinc-800 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800">
                          {VIDEO_RESOLUTIONS.map(r => (
                            <SelectItem 
                              key={r} 
                              value={r}
                            >
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">FPS</label>
                      <Select value={fps.toString()} onValueChange={(v) => setFps(parseInt(v))}>
                        <SelectTrigger className="bg-zinc-950 border-zinc-800 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800">
                          {VIDEO_FPS.map(f => <SelectItem key={f} value={f.toString()}>{f} FPS</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <div className="flex items-end">
                  <Button 
                    onClick={type === 'image' ? generateImage : generateVideo}
                    disabled={!prompt.trim() || isGenerating}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white rounded-xl h-10 gap-2 shadow-lg shadow-purple-500/20"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wand2 className="w-4 h-4" />
                    )}
                    {isGenerating ? 'Synthesizing...' : 'Generate'}
                  </Button>
                </div>
              </div>
            </div>

            {isGenerating && type === 'video' && progress !== null && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  <span>{statusMessage || 'Synthesizing Video Frames'}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                  <div 
                    className="h-full bg-purple-500 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-500 italic">
                  Veo 3.1 is processing your cinematic request. This typically takes 1-2 minutes.
                </p>
              </div>
            )}

            {resultUrl && (
              <div className="mt-8 space-y-4 animate-in fade-in zoom-in duration-500">
                <div className="relative group rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl">
                  {type === 'image' ? (
                    <img src={resultUrl} alt="Generated" className="w-full h-auto" />
                  ) : (
                    <video src={resultUrl} controls className="w-full h-auto" />
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <Button variant="secondary" size="sm" className="gap-2" onClick={() => window.open(resultUrl, '_blank')}>
                      <Download className="w-4 h-4" /> Download
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
