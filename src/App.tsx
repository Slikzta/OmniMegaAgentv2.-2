import React, { useState } from 'react';
import Layout from './components/Layout';
import ChatInterface from './components/ChatInterface';
import MediaGenerator from './components/MediaGenerator';
import LiveVoice from './components/LiveVoice';
import Integrations from './components/Integrations';
import SettingsView from './components/Settings';
import { Toaster } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import { SpeedInsights } from '@vercel/speed-insights/react';

import ErrorBoundary from './components/ErrorBoundary';
import { UIProvider } from './contexts/UIContext';

export default function App() {
  const [activeTab, setActiveTab] = useState('chat');

  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatInterface onOpenSettings={() => setActiveTab('settings')} />;
      case 'image':
      case 'video':
        return <MediaGenerator />;
      case 'live':
        return <LiveVoice />;
      case 'integrations':
        return <Integrations />;
      case 'settings':
        return <SettingsView onNavigateToChat={() => setActiveTab('chat')} />;
      default:
        return <ChatInterface onOpenSettings={() => setActiveTab('settings')} />;
    }
  };

  return (
    <ErrorBoundary>
      <UIProvider>
        <TooltipProvider>
          <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
            {renderContent()}
          </Layout>
          <Toaster position="top-right" theme="dark" />
          <SpeedInsights />
        </TooltipProvider>
      </UIProvider>
    </ErrorBoundary>
  );
}
