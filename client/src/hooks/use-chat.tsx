import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { 
  ChatState, 
  Message, 
  Conversation
} from '@/types';
import { apiService } from '@/lib/api-service';
import { streamingService } from '@/lib/streaming-service';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';

// Chat actions
type ChatAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_LOADING_CONVERSATION'; payload: boolean }
  | { type: 'SET_STREAMING'; payload: { isStreaming: boolean; messageId?: string } }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CONVERSATIONS'; payload: Conversation[] }
  | { type: 'SET_CURRENT_CONVERSATION'; payload: Conversation | null }
  | { type: 'SET_MESSAGES'; payload: Message[] }
  | { type: 'CACHE_MESSAGES'; payload: { conversationId: string; messages: Message[] } }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; updates: Partial<Message> } }
  | { type: 'ADD_CONVERSATION'; payload: Conversation }
  | { type: 'UPDATE_CONVERSATION'; payload: { id: string; updates: Partial<Conversation> } }
  | { type: 'DELETE_CONVERSATION'; payload: string }
  | { type: 'RESET_CHAT' };

const initialState: ChatState = {
  conversations: [],
  currentConversation: null,
  messages: [],
  isLoading: false,
  isLoadingConversation: false,
  isStreaming: false,
  streamingMessageId: null,
  error: null,
  messageCache: {},
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_LOADING_CONVERSATION':
      return { ...state, isLoadingConversation: action.payload };
    
    case 'SET_STREAMING':
      return { 
        ...state, 
        isStreaming: action.payload.isStreaming,
        streamingMessageId: action.payload.messageId || null
      };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'SET_CONVERSATIONS':
      return { ...state, conversations: action.payload };
    
    case 'SET_CURRENT_CONVERSATION':
      return { ...state, currentConversation: action.payload };
    
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    
    case 'CACHE_MESSAGES':
      return { 
        ...state, 
        messageCache: { 
          ...state.messageCache, 
          [action.payload.conversationId]: action.payload.messages 
        } 
      };
    
    case 'ADD_MESSAGE': {
      const newMessages = [...state.messages, action.payload];
      const currentConvId = action.payload.conversationId;
      return { 
        ...state, 
        messages: newMessages,
        messageCache: {
          ...state.messageCache,
          [currentConvId]: state.messageCache[currentConvId] 
            ? [...state.messageCache[currentConvId], action.payload]
            : newMessages.filter(msg => msg.conversationId === currentConvId)
        }
      };
    }
    
    case 'UPDATE_MESSAGE': {
      const { id, updates } = action.payload;
      const updatedMessages = state.messages.map(msg => 
        msg.messageId === id ? { ...msg, ...updates } : msg
      );
      
      // Update cache for the conversation containing this message
      const updatedMessage = updatedMessages.find(msg => msg.messageId === id);
      const convId = updatedMessage?.conversationId;
      
      return {
        ...state,
        messages: updatedMessages,
        messageCache: convId ? {
          ...state.messageCache,
          [convId]: state.messageCache[convId] 
            ? state.messageCache[convId].map(msg => 
                msg.messageId === id ? { ...msg, ...updates } : msg
              )
            : updatedMessages.filter(msg => msg.conversationId === convId)
        } : state.messageCache
      };
    }
    
    case 'ADD_CONVERSATION':
      return { ...state, conversations: [action.payload, ...state.conversations] };
    
    case 'UPDATE_CONVERSATION': {
      const { id, updates } = action.payload;
      return {
        ...state,
        conversations: state.conversations.map(conv => 
          conv.conversationId === id ? { ...conv, ...updates } : conv
        ),
        currentConversation: state.currentConversation?.conversationId === id 
          ? { ...state.currentConversation, ...updates } 
          : state.currentConversation
      };
    }
    
    case 'DELETE_CONVERSATION': {
      const { [action.payload]: deleted, ...remainingCache } = state.messageCache;
      return {
        ...state,
        conversations: state.conversations.filter(conv => conv.conversationId !== action.payload),
        currentConversation: state.currentConversation?.conversationId === action.payload 
          ? null 
          : state.currentConversation,
        messages: state.currentConversation?.conversationId === action.payload ? [] : state.messages,
        messageCache: remainingCache
      };
    }
    
    case 'RESET_CHAT':
      return initialState;
    
    default:
      return state;
  }
}

interface ChatContextType extends ChatState {
  // Conversation methods
  loadConversations: () => Promise<void>;
  selectConversation: (conversation: Conversation) => Promise<void>;
  createNewConversation: (title?: string) => Promise<Conversation>;
  updateConversation: (id: string, updates: Partial<Conversation>) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  
  // Message methods
  sendMessage: (content: string, conversationId?: string) => Promise<void>;
  stopStreaming: () => void;
  
  // Utility methods
  clearError: () => void;
  reset: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [state, dispatch] = useReducer(chatReducer, initialState);

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const conversations = await apiService.getConversations();
      dispatch({ type: 'SET_CONVERSATIONS', payload: conversations });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load conversations';
      dispatch({ type: 'SET_ERROR', payload: message });
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [isAuthenticated, toast]);

  // Select and load conversation
  const selectConversation = useCallback(async (conversation: Conversation) => {
    try {
      dispatch({ type: 'SET_LOADING_CONVERSATION', payload: true });
      dispatch({ type: 'SET_CURRENT_CONVERSATION', payload: conversation });
      
      // Check if messages are already cached
      const cachedMessages = state.messageCache[conversation.conversationId];
      if (cachedMessages) {
        // Use cached messages
        dispatch({ type: 'SET_MESSAGES', payload: cachedMessages });
        dispatch({ type: 'SET_LOADING_CONVERSATION', payload: false });
        return;
      }
      
      // Fetch messages if not cached
      const messages = await apiService.getMessages(conversation.conversationId);
      dispatch({ type: 'SET_MESSAGES', payload: messages });
      // Cache the messages for future use
      dispatch({ type: 'CACHE_MESSAGES', payload: { conversationId: conversation.conversationId, messages } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load messages';
      dispatch({ type: 'SET_ERROR', payload: message });
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      dispatch({ type: 'SET_LOADING_CONVERSATION', payload: false });
    }
  }, [toast, state.messageCache]);

  // Create new conversation
  const createNewConversation = useCallback(async (title?: string) => {
    try {
      const conversation = await apiService.createConversation(title);
      dispatch({ type: 'ADD_CONVERSATION', payload: conversation });
      return conversation;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create conversation';
      dispatch({ type: 'SET_ERROR', payload: message });
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      throw error;
    }
  }, [toast]);

  // Update conversation
  const updateConversation = useCallback(async (id: string, updates: Partial<Conversation>) => {
    try {
      await apiService.updateConversation(id, updates);
      dispatch({ type: 'UPDATE_CONVERSATION', payload: { id, updates } });
      toast({
        title: 'Success',
        description: 'Conversation updated successfully',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update conversation';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Delete conversation
  const deleteConversation = useCallback(async (id: string) => {
    try {
      await apiService.deleteConversation(id);
      dispatch({ type: 'DELETE_CONVERSATION', payload: id });
      toast({
        title: 'Conversation deleted',
        description: 'The conversation has been removed',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete conversation';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Send message with streaming
  const sendMessage = useCallback(async (content: string, conversationId?: string) => {
    try {
      // Ensure we have a conversation
      let targetConversationId = conversationId || state.currentConversation?.conversationId;
      
      if (!targetConversationId) {
        const newConversation = await createNewConversation();
        targetConversationId = newConversation.conversationId;
        dispatch({ type: 'SET_CURRENT_CONVERSATION', payload: newConversation });
      }

      // Add user message immediately
      const userMessage: Message = {
        messageId: `temp-${Date.now()}`,
        conversationId: targetConversationId,
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
        status: 'complete',
      };
      dispatch({ type: 'ADD_MESSAGE', payload: userMessage });

      // Start streaming
      let accumulatedContent = '';
      let assistantMessage: Message | null = null;
      let agentType = undefined; // Store agent type to apply at the end

      // Only set streaming when we actually start the async generator
      for await (const event of streamingService.streamChat(content, targetConversationId)) {
        // Set streaming state only when we get the first event
        if (!assistantMessage) {
          dispatch({ type: 'SET_STREAMING', payload: { isStreaming: true } });
        }

        if (event.meta) {
          // Create assistant message when we get meta info
          if (!assistantMessage) {
            assistantMessage = {
              messageId: event.meta.assistantMessageId || `temp-assistant-${Date.now()}`,
              conversationId: targetConversationId,
              role: 'assistant',
              content: '',
              timestamp: new Date().toISOString(),
              status: 'complete',
            };
            dispatch({ type: 'ADD_MESSAGE', payload: assistantMessage });
            dispatch({ type: 'SET_STREAMING', payload: { isStreaming: true, messageId: assistantMessage.messageId } });
          }
          
          if (event.meta.agent) {
            agentType = event.meta.agent; // Store for later
          }
        }

        if (event.chunk && assistantMessage) {
          accumulatedContent += event.chunk.delta;
          dispatch({ 
            type: 'UPDATE_MESSAGE', 
            payload: { 
              id: assistantMessage.messageId,
              updates: { content: accumulatedContent } 
            } 
          });
        }

        if (event.done && assistantMessage) {
          // Now show the agent tag with the final message
          if (agentType) {
            dispatch({ 
              type: 'UPDATE_MESSAGE', 
              payload: { 
                id: assistantMessage.messageId,
                updates: { agent: agentType } 
              } 
            });
          }
          dispatch({ type: 'SET_STREAMING', payload: { isStreaming: false } });
          break;
        }

        if (event.error) {
          dispatch({ type: 'SET_STREAMING', payload: { isStreaming: false } });
          const errorMessage = event.error.message || event.error.error || 'Unknown streaming error';
          dispatch({ type: 'SET_ERROR', payload: errorMessage });
          toast({
            title: 'Streaming Error',
            description: errorMessage,
            variant: 'destructive',
          });
          break;
        }
      }

    } catch (error) {
      dispatch({ type: 'SET_STREAMING', payload: { isStreaming: false } });
      const message = error instanceof Error ? error.message : 'Failed to send message';
      dispatch({ type: 'SET_ERROR', payload: message });
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    }
  }, [state.currentConversation?.conversationId, createNewConversation, toast]);

  // Stop streaming
  const stopStreaming = useCallback(() => {
    streamingService.stop();
    dispatch({ type: 'SET_STREAMING', payload: { isStreaming: false } });
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  // Reset chat state
  const reset = useCallback(() => {
    streamingService.stop();
    dispatch({ type: 'RESET_CHAT' });
  }, []);

  const contextValue: ChatContextType = {
    ...state,
    loadConversations,
    selectConversation,
    createNewConversation,
    updateConversation,
    deleteConversation,
    sendMessage,
    stopStreaming,
    clearError,
    reset,
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}