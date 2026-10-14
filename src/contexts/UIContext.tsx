import React, { createContext, useContext, useState, ReactNode } from 'react';

interface UIContextType {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  
  isImageModalOpen: boolean;
  setIsImageModalOpen: (open: boolean) => void;
  
  isVideoModalOpen: boolean;
  setIsVideoModalOpen: (open: boolean) => void;
  
  isClearDialogOpen: boolean;
  setIsClearDialogOpen: (open: boolean) => void;
  
  isParamsOpen: boolean;
  setIsParamsOpen: (open: boolean) => void;
  toggleParams: () => void;
  
  isRenaming: boolean;
  setIsRenaming: (renaming: boolean) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isParamsOpen, setIsParamsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);
  const toggleParams = () => setIsParamsOpen(prev => !prev);

  return (
    <UIContext.Provider value={{
      isSidebarOpen,
      setIsSidebarOpen,
      toggleSidebar,
      isImageModalOpen,
      setIsImageModalOpen,
      isVideoModalOpen,
      setIsVideoModalOpen,
      isClearDialogOpen,
      setIsClearDialogOpen,
      isParamsOpen,
      setIsParamsOpen,
      toggleParams,
      isRenaming,
      setIsRenaming
    }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}
