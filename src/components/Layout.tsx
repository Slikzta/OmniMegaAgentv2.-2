import React, { useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, signInWithGoogle, logout } from '../lib/firebase';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { LogIn, LogOut, Sparkles, MessageSquare, Image as ImageIcon, Video, Mic, Settings, Share2, ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const [user] = useAuthState(auth);

  const navItems = [
    { id: 'chat', icon: MessageSquare, label: 'Chat' },
    { id: 'image', icon: ImageIcon, label: 'Image' },
    { id: 'video', icon: Video, label: 'Video' },
    { id: 'live', icon: Mic, label: 'Live' },
    { id: 'integrations', icon: Share2, label: 'Integrations' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  // Handle hardware / browser back navigation for mobile flow
  useEffect(() => {
    const handlePopState = () => {
      if (activeTab !== 'chat') {
        setActiveTab('chat');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab, setActiveTab]);

  const handleTabChange = (tabId: string) => {
    if (tabId !== activeTab) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(10);
        } catch (_) {}
      }
      window.history.pushState({ tab: tabId }, '', `#${tabId}`);
      setActiveTab(tabId);
    }
  };

  const currentTabItem = navItems.find((n) => n.id === activeTab);

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans select-none">
      {/* Mobile Top App Bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-2.5 bg-zinc-900/90 border-b border-zinc-800/80 backdrop-blur-xl z-30 shrink-0">
        <div className="flex items-center gap-2.5">
          {activeTab !== 'chat' ? (
            <button
              onClick={() => handleTabChange('chat')}
              className="p-1.5 -ml-1 text-zinc-400 hover:text-white rounded-lg active:bg-zinc-800 touch-manipulation"
              aria-label="Back to chat"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-lg flex items-center justify-center shadow-md shadow-purple-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          )}
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-base tracking-tight text-zinc-100">OmniAgent</span>
            <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider">
              {currentTabItem ? currentTabItem.label : 'Sierra'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2">
              <Avatar className="w-7 h-7 border border-zinc-700">
                <AvatarImage src={user.photoURL || ''} />
                <AvatarFallback className="text-xs">{user.displayName?.[0] || 'U'}</AvatarFallback>
              </Avatar>
              <button
                onClick={logout}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 active:bg-zinc-800 rounded-md touch-manipulation"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Button
              onClick={signInWithGoogle}
              size="sm"
              variant="outline"
              className="h-8 px-2.5 text-xs gap-1.5 border-zinc-700 hover:bg-zinc-800"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </Button>
          )}
        </div>
      </header>

      {/* Desktop / Tablet Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-zinc-800 flex-col bg-zinc-900/50 backdrop-blur-xl shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-xl tracking-tight block">OmniAgent</span>
            <span className="text-[10px] font-semibold text-purple-400 block -mt-0.5 tracking-wider uppercase">Sierra Engine</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1.5">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group text-left min-h-[44px]",
                  isActive 
                    ? "bg-zinc-800 text-white shadow-inner font-semibold" 
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 font-medium"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5 transition-transform duration-200 group-hover:scale-110 shrink-0",
                  isActive ? "text-purple-400" : ""
                )} />
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-800">
          {user ? (
            <div className="flex items-center gap-3 p-2 rounded-xl bg-zinc-800/30">
              <Avatar className="w-9 h-9 border border-zinc-700">
                <AvatarImage src={user.photoURL || ''} />
                <AvatarFallback>{user.displayName?.[0] || 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.displayName || 'User'}</p>
                <button 
                  onClick={logout}
                  className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 mt-0.5"
                >
                  <LogOut className="w-3 h-3" /> Sign out
                </button>
              </div>
            </div>
          ) : (
            <Button 
              onClick={signInWithGoogle}
              variant="outline" 
              className="w-full gap-2 border-zinc-700 hover:bg-zinc-800"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In with Google</span>
            </Button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-zinc-950 min-w-0">
        {children}
      </main>

      {/* Mobile Android Material 3 Bottom Navigation Bar */}
      <nav 
        className="md:hidden flex items-center justify-around bg-zinc-900/95 border-t border-zinc-800/90 backdrop-blur-xl px-1 py-1 z-30 shrink-0 select-none touch-manipulation pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        role="navigation"
        aria-label="Main Navigation"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all duration-150 min-h-[48px]",
                isActive ? "text-purple-400" : "text-zinc-400 active:text-zinc-200"
              )}
            >
              <div
                className={cn(
                  "w-12 h-7 rounded-full flex items-center justify-center transition-colors mb-0.5",
                  isActive ? "bg-purple-950/70 text-purple-300" : "bg-transparent text-zinc-400"
                )}
              >
                <item.icon className="w-4 h-4" />
              </div>
              <span
                className={cn(
                  "text-[10px] tracking-tight truncate max-w-[56px]",
                  isActive ? "font-semibold text-zinc-100" : "font-normal text-zinc-400"
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
