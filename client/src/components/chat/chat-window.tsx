import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, Bot } from 'lucide-react';
import type { Conversation } from '@/types';
import { agentColors, agentNames } from '@/types';
import { useChat } from '@/hooks/use-chat';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { cn } from '@/lib/utils';

interface ChatWindowProps {
  conversation: Conversation;
  className?: string;
}


export function ChatWindow({ conversation, className }: ChatWindowProps) {
  const { 
    messages, 
    isStreaming, 
    isLoadingConversation,
    streamingMessageId,
    sendMessage, 
    stopStreaming,
    toolInUse
  } = useChat();
  
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Debug tool usage state
  useEffect(() => {
    console.log('Current toolInUse state:', toolInUse);
  }, [toolInUse]);
  
  // Reset toolInUse when streaming stops
  useEffect(() => {
    if (!isStreaming && toolInUse) {
      // Add a small delay to allow for any final UI updates
      const timer = setTimeout(() => {
        console.log('Streaming stopped, clearing tool in use');
        stopStreaming(); // This will reset toolInUse state
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, toolInUse, stopStreaming]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [conversation.conversationId]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const message = input.trim();
    setInput('');
    
    try {
      await sendMessage(message, conversation.conversationId);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const conversationMessages = messages.filter(msg => msg.conversationId === conversation.conversationId);

  return (
    <div className={cn('flex flex-col h-full bg-surface/20', className)}>
      {/* Tool use indicator */}
      <AnimatePresence>
        {toolInUse && (
          <motion.div
            key="tool-indicator"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="absolute left-1/2 top-4 z-20 -translate-x-1/2 bg-surface/90 px-6 py-3 rounded-2xl shadow-lg border border-primary/30 flex items-center gap-3"
          >
            <LoadingSpinner className="h-5 w-5 text-primary animate-spin" />
            <span className="text-sm font-semibold text-primary">
              AI is using tool: <span className="font-bold">{toolInUse.tool}</span>
              {toolInUse.parameters?.query && (
                <span className="ml-2 text-xs opacity-70">
                  "{toolInUse.parameters.query}"
                </span>
              )}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="px-6 py-6 glass border-b border-border/50">
        <h2 className="text-xl font-bold text-fg">
          {conversation.title || 'New Conversation'}
        </h2>
        <p className="text-sm text-fg-muted mt-2">
          Chat with AI agents specialized in different domains
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        {isLoadingConversation ? (
          <div className="flex items-center justify-center h-full">
            <div className="glass rounded-2xl p-8 border border-border/50">
              <div className="flex flex-col items-center gap-4">
                <LoadingSpinner className="h-8 w-8" />
                <p className="text-sm text-fg-muted">Loading conversation...</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <AnimatePresence>
              {conversationMessages.map((message, index) => (
            <motion.div
              key={message.messageId || `message-${index}`}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.95 }}
              transition={{ 
                duration: 0.4, 
                delay: index * 0.1,
                type: "spring",
                stiffness: 300,
                damping: 25
              }}
              className={cn(
                'flex gap-4 group',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <motion.div 
                  className="flex-shrink-0"
                  whileHover={{ scale: 1.1 }}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary via-accent to-primary shadow-lg flex items-center justify-center">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                </motion.div>
              )}

              <motion.div
                whileHover={{ scale: 1.02, y: -2 }}
                className={cn(
                  'max-w-[75%] rounded-2xl px-5 py-4 shadow-soft transition-all duration-200',
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-primary to-accent text-white shadow-primary/20'
                    : 'glass border border-border/50 group-hover:shadow-lg group-hover:shadow-primary/10'
                )}
              >
                {message.role === 'assistant' && message.agent && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 mb-3"
                  >
                    <span className={cn(
                      'text-xs px-3 py-1.5 rounded-full font-semibold backdrop-blur-sm',
                      agentColors[message.agent]
                    )}>
                      {agentNames[message.agent]}
                    </span>
                  </motion.div>
                )}

                <div className="prose prose-sm max-w-none">
                  {message.role === 'user' ? (
                    <div className="text-white">
                      <MarkdownRenderer 
                        content={message.content} 
                        className="[&>*]:!text-white [&>*]:!border-white/30 [&_code]:!bg-white/20 [&_code]:!text-white [&_pre]:!bg-white/10 [&_pre]:!border-white/20 [&_blockquote]:!bg-white/10 [&_blockquote]:!border-white/30 [&_a]:!text-blue-200 [&_a:hover]:!text-white"
                      />
                      {isStreaming && streamingMessageId === message.messageId && (
                        <motion.span
                          animate={{ opacity: [1, 0] }}
                          transition={{ duration: 1, repeat: Infinity }}
                          className="inline-block ml-2 w-0.5 h-4 bg-white rounded-full"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      <MarkdownRenderer 
                        content={message.content} 
                        className="[&>*]:!text-fg [&>*]:!font-medium [&_p]:!text-fg [&_p]:!font-medium [&_strong]:!text-fg [&_strong]:!font-bold [&_h1]:!text-fg [&_h2]:!text-fg [&_h3]:!text-fg [&_h4]:!text-fg [&_h5]:!text-fg [&_h6]:!text-fg [&_li]:!text-fg [&_li]:!font-medium [&_code]:!text-accent [&_code]:!font-semibold [&_pre]:!bg-surface/80 [&_blockquote]:!text-fg-muted [&_a]:!text-primary [&_a:hover]:!text-accent"
                      />
                      {isStreaming && streamingMessageId === message.messageId && (
                        <motion.span
                          animate={{ opacity: [1, 0] }}
                          transition={{ duration: 1, repeat: Infinity }}
                          className="inline-block ml-2 w-0.5 h-4 bg-primary rounded-full"
                        />
                      )}
                    </div>
                  )}
                </div>
              </motion.div>

              {message.role === 'user' && (
                <motion.div 
                  className="flex-shrink-0"
                  whileHover={{ scale: 1.1 }}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-surface to-border shadow-soft flex items-center justify-center">
                    <User className="h-5 w-5 text-fg" />
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
            </AnimatePresence>

            {/* Loading indicator - only show if streaming but no assistant message streaming yet */}
            {isStreaming && !streamingMessageId && (
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary via-accent to-primary shadow-lg flex items-center justify-center">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div className="glass border border-border/50 rounded-2xl px-5 py-4 shadow-soft">
                  <div className="flex items-center gap-3">
                    <LoadingSpinner className="h-4 w-4" />
                    <span className="text-sm text-fg-muted">AI is thinking...</span>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="p-6">
        <motion.div 
          className="glass rounded-2xl border border-border/50 shadow-lg p-4"
          whileFocus={{ scale: 1.01, shadow: "0 10px 40px rgba(99, 102, 241, 0.2)" }}
        >
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                disabled={isStreaming}
                className="w-full bg-transparent border-0 outline-0 text-fg placeholder-fg-muted text-sm py-2 px-0 resize-none min-h-[1.5rem] max-h-32"
              />
            </div>
            <motion.button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="h-10 w-10 bg-gradient-to-r from-primary to-accent rounded-xl flex items-center justify-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <Send className="h-4 w-4 text-white" />
            </motion.button>
          </div>
        </motion.div>
        
        <div className="mt-3 text-xs text-fg-muted text-center">
          Messages are processed by specialized AI agents based on content
        </div>
      </div>
    </div>
  );
}