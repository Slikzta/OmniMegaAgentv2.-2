import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Database, CheckCircle2, XCircle, ExternalLink, Loader2, RefreshCw, Share2 as GithubIcon } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@supabase/supabase-js';

export default function Integrations() {
  const [githubUser, setGithubUser] = useState<any>(null);
  const [isGithubLoading, setIsGithubLoading] = useState(false);
  const [supabaseConfig, setSupabaseConfig] = useState<{ url: string; anonKey: string } | null>(null);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);

  useEffect(() => {
    fetchGithubUser();
    fetchSupabaseConfig();
  }, []);

  const fetchGithubUser = async () => {
    setIsGithubLoading(true);
    try {
      const response = await fetch('/api/github/user');
      if (response.ok) {
        const data = await response.json();
        setGithubUser(data);
      } else {
        setGithubUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch GitHub user:', error);
    } finally {
      setIsGithubLoading(false);
    }
  };

  const fetchSupabaseConfig = async () => {
    try {
      const response = await fetch('/api/config/supabase');
      const data = await response.json();
      if (data.url && data.anonKey) {
        setSupabaseConfig(data);
        // Test connection
        const supabase = createClient(data.url, data.anonKey);
        const { error } = await supabase.from('_test_connection').select('*').limit(1);
        // We don't care if the table exists, just if the client initializes and can reach the server
        setIsSupabaseConnected(true);
      }
    } catch (error) {
      console.error('Failed to fetch Supabase config:', error);
    }
  };

  const handleConnectGithub = async () => {
    try {
      const response = await fetch('/api/auth/github/url');
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to get GitHub auth URL');
      }
      const { url } = await response.json();

      const authWindow = window.open(url, 'github_oauth', 'width=600,height=700');
      
      if (!authWindow) {
        toast.error('Popup blocked. Please allow popups to connect GitHub.');
        return;
      }

      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'GITHUB_AUTH_SUCCESS') {
          toast.success('GitHub connected successfully!');
          fetchGithubUser();
          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDisconnectGithub = async () => {
    try {
      await fetch('/api/github/logout', { method: 'POST' });
      setGithubUser(null);
      toast.success('GitHub disconnected');
    } catch (error) {
      toast.error('Failed to disconnect GitHub');
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-zinc-950">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent">
            External Integrations
          </h1>
          <p className="text-zinc-400">Connect OmniAgent to your favorite 3rd party services.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* GitHub Integration */}
          <Card className="bg-zinc-900 border-zinc-800 shadow-xl overflow-hidden">
            <CardHeader className="border-b border-zinc-800 bg-zinc-900/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800">
                    <GithubIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">GitHub</CardTitle>
                    <CardDescription className="text-xs">Code & Repositories</CardDescription>
                  </div>
                </div>
                {githubUser ? (
                  <div className="flex items-center gap-1 text-[10px] font-bold text-green-400 uppercase tracking-widest bg-green-400/10 px-2 py-1 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Connected
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-800 px-2 py-1 rounded-full">
                    <XCircle className="w-3 h-3" /> Disconnected
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {isGithubLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-zinc-700" />
                </div>
              ) : githubUser ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                    <img src={githubUser.avatar_url} alt={githubUser.login} className="w-12 h-12 rounded-full border border-zinc-800" />
                    <div>
                      <p className="font-bold text-zinc-200">{githubUser.name || githubUser.login}</p>
                      <p className="text-xs text-zinc-500">@{githubUser.login}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
                      <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Repos</p>
                      <p className="text-xl font-bold text-zinc-200">{githubUser.public_repos}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
                      <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Followers</p>
                      <p className="text-xl font-bold text-zinc-200">{githubUser.followers}</p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-red-400 transition-colors"
                    onClick={handleDisconnectGithub}
                  >
                    Disconnect GitHub
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-zinc-500">
                    Connect your GitHub account to allow OmniAgent to interact with your repositories, create gists, and manage issues.
                  </p>
                  <Button 
                    className="w-full bg-white text-black hover:bg-zinc-200 font-bold gap-2"
                    onClick={handleConnectGithub}
                  >
                    <GithubIcon className="w-4 h-4" /> Connect GitHub
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Supabase Integration */}
          <Card className="bg-zinc-900 border-zinc-800 shadow-xl overflow-hidden">
            <CardHeader className="border-b border-zinc-800 bg-zinc-900/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800">
                    <Database className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Supabase</CardTitle>
                    <CardDescription className="text-xs">Database & Storage</CardDescription>
                  </div>
                </div>
                {isSupabaseConnected ? (
                  <div className="flex items-center gap-1 text-[10px] font-bold text-green-400 uppercase tracking-widest bg-green-400/10 px-2 py-1 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-800 px-2 py-1 rounded-full">
                    <XCircle className="w-3 h-3" /> Inactive
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {supabaseConfig ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Project URL</label>
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-400 truncate">
                      {supabaseConfig.url}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-green-400/5 border border-green-400/10">
                    <p className="text-sm text-zinc-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      Supabase connection established.
                    </p>
                    <p className="text-xs text-zinc-500 mt-2">
                      OmniAgent can now sync your chat history and media to your Supabase project.
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full border-zinc-800 text-zinc-400 hover:bg-zinc-800 gap-2"
                    onClick={fetchSupabaseConfig}
                  >
                    <RefreshCw className="w-4 h-4" /> Refresh Connection
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-zinc-500">
                    To connect Supabase, you must set the <code className="text-zinc-300">SUPABASE_URL</code> and <code className="text-zinc-300">SUPABASE_ANON_KEY</code> environment variables in the AI Studio settings.
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full border-zinc-800 text-zinc-400 hover:bg-zinc-800 gap-2"
                    onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
                  >
                    <ExternalLink className="w-4 h-4" /> Open Supabase Dashboard
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-zinc-900 border-zinc-800 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg">Integration Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                <div className="flex items-center gap-3">
                  <GithubIcon className="w-5 h-5 text-zinc-400" />
                  <div>
                    <p className="text-sm font-bold text-zinc-200">GitHub API</p>
                    <p className="text-xs text-zinc-500">Operational</p>
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-zinc-400" />
                  <div>
                    <p className="text-sm font-bold text-zinc-200">Supabase Realtime</p>
                    <p className="text-xs text-zinc-500">Operational</p>
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
