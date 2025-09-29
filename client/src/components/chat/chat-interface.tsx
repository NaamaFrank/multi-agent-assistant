import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from '@/hooks/use-chat';
import { useAuth } from '@/hooks/use-auth';
import { ConversationSidebar } from './conversation-sidebar';
import { ChatWindow } from './chat-window';
import { WelcomeScreen } from './welcome-screen';
import { TopBar } from '@/components/ui/top-bar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export function ChatInterface() {
  const { user } = useAuth();
  const { 
    conversations, 
    currentConversation, 
    isLoading, 
    error, 
    loadConversations, 
    selectConversation 
  } = useChat();
  
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  if (isLoading && conversations.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner className="h-8 w-8" />
          <p className="text-fg-muted text-sm">Loading your conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-bg overflow-hidden">
      {/* Premium TopBar */}
      <TopBar />
      
      <div className="flex flex-1 gap-4 p-4 overflow-hidden">
        {/* Sidebar */}
        <AnimatePresence mode="wait">
          {sidebarOpen && (
            <motion.div
              key="sidebar"
              initial={{ opacity: 0, x: -300, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -300, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="w-80 flex-shrink-0 h-full"
            >
              <div className="glass glass-hover h-full rounded-2xl overflow-hidden">
                <ConversationSidebar
                  conversations={conversations}
                  currentConversation={currentConversation}
                  onSelectConversation={selectConversation}
                  isLoading={isLoading}
                  error={error}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {/* Toggle Sidebar Button - Mobile */}
          {!sidebarOpen && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSidebarOpen(true)}
              className="absolute top-4 left-4 z-20 glass-hover w-12 h-12 rounded-xl flex items-center justify-center shadow-soft lg:hidden"
            >
              <svg className="w-5 h-5 text-fg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </motion.button>
          )}

          {/* Chat Content */}
          <motion.div 
            layout
            className="glass h-full rounded-2xl overflow-hidden flex flex-col"
          >
            {currentConversation ? (
              <ChatWindow 
                conversation={currentConversation}
                className="flex-1"
              />
            ) : (
              <WelcomeScreen 
                userName={user?.firstName || 'User'}
                onStartNewChat={() => {
                  // This will be handled by the chat window
                }}
              />
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}