import React, { useState, useEffect, useRef } from 'react';
import { agentService } from '../agentService';
import { authService } from '../authService';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatProps {
  onLogout: () => void;
}

export const Chat: React.FC<ChatProps> = ({ onLogout }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');
  const [conversations, setConversations] = useState<any[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingTextRef = useRef<string>('');
  const streamingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadConversations();
    
    // Cleanup function
    return () => {
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current);
      }
    };
  }, []);

  const loadConversations = async () => {
    try {
      const result = await agentService.getConversations();
      if (result.success && result.data) {
        setConversations(result.data);
      }
    } catch (err: any) {
      console.error('Failed to load conversations:', err);
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setError('');
  };

  const loadConversation = async (conversationId: string) => {
    try {
      console.log('Loading conversation:', conversationId);
      const result = await agentService.getConversationMessages(conversationId);
      console.log('Messages received:', result.data);
      if (result.success && result.data) {
        const formattedMessages = result.data.map((msg: any) => ({
          id: msg.messageId,  // Backend uses 'messageId', not 'id'
          text: msg.content,
          isUser: msg.role === 'user',
          timestamp: new Date(msg.ts)  // Backend uses 'ts', not 'timestamp'
        }));
        console.log('Formatted messages:', formattedMessages);
        setMessages(formattedMessages);
        setCurrentConversationId(conversationId);
        setError('');
      }
    } catch (err: any) {
      setError('Failed to load conversation: ' + err.message);
    }
  };

  const deleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the conversation load
    setShowDeleteConfirm(conversationId);
  };

  const confirmDelete = async (conversationId: string) => {
    try {
      console.log('Deleting conversation:', conversationId);
      await agentService.deleteConversation(conversationId);
      
      // If we're currently viewing the deleted conversation, clear the view
      if (currentConversationId === conversationId) {
        setMessages([]);
        setCurrentConversationId(null);
      }
      
      // Refresh the conversations list
      await loadConversations();
      setShowDeleteConfirm(null);
      console.log('Conversation deleted successfully');
    } catch (err: any) {
      setError('Failed to delete conversation: ' + err.message);
      console.error('Delete conversation error:', err);
      setShowDeleteConfirm(null);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isStreaming) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date()
    };

    console.log('Sending message:', userMessage.text);
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsStreaming(true);
    setError('');

    // Create abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: '',
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      console.log('Created assistant message placeholder');

      // Initialize streaming text accumulator
      streamingTextRef.current = '';
      
      // Set up periodic UI updates for smoother streaming
      streamingIntervalRef.current = setInterval(() => {
        if (streamingTextRef.current.length > 0) {
          setMessages(prev => {
            const updated = [...prev];
            const lastMessage = updated[updated.length - 1];
            if (!lastMessage.isUser) {
              lastMessage.text = streamingTextRef.current;
            }
            return updated;
          });
        }
      }, 100); // Update UI every 100ms for smooth streaming

      const streamGenerator = agentService.streamChat(
        userMessage.text, 
        currentConversationId || undefined, 
        abortController.signal
      );

      for await (const chunk of streamGenerator) {
        if (chunk.chunk?.delta) {
          console.log('Received chunk:', chunk.chunk.delta);
          // Accumulate text in ref for batched updates
          streamingTextRef.current += chunk.chunk.delta;
        } else if (chunk.meta?.conversationId) {
          console.log('Received meta:', chunk.meta.conversationId);
          setCurrentConversationId(chunk.meta.conversationId);
        } else if (chunk.done) {
          console.log('Streaming completed with done event');
          break;
        } else if (chunk.error) {
          throw new Error(chunk.error.message || 'Streaming error occurred');
        }
      }

      // Clear the streaming interval
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current);
        streamingIntervalRef.current = null;
      }

      // Final update with complete text
      if (streamingTextRef.current.length > 0) {
        setMessages(prev => {
          const updated = [...prev];
          const lastMessage = updated[updated.length - 1];
          if (!lastMessage.isUser) {
            lastMessage.text = streamingTextRef.current;
          }
          return updated;
        });
      }

      console.log('Streaming completed, refreshing conversations');
      // Refresh conversations list to show updated last message time
      loadConversations();
      
      // Don't reload conversation - we already have the streaming content displayed correctly
      // The streaming text is already in the messages state from the final update above

    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('Request was cancelled');
      } else {
        setError('Failed to send message: ' + err.message);
        // Remove the incomplete assistant message
        setMessages(prev => prev.slice(0, -1));
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
      
      // Clean up streaming interval if it exists
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current);
        streamingIntervalRef.current = null;
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const stopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleLogout = () => {
    stopStreaming();
    authService.logout();
    onLogout();
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Sidebar */}
      <div style={{ 
        width: '300px', 
        backgroundColor: 'white', 
        borderRight: '1px solid #ddd',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #ddd' }}>
          <h3 style={{ margin: '0 0 10px 0' }}>CrossRiver AI</h3>
          <button
            onClick={startNewConversation}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '10px'
            }}
          >
            New Conversation
          </button>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '10px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Conversations</h4>
          {conversations.map((conv) => (
            <div
              key={conv.conversationId}
              style={{
                padding: '10px',
                margin: '5px 0',
                backgroundColor: conv.conversationId === currentConversationId ? '#e7f3ff' : '#f8f9fa',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '12px',
                position: 'relative'
              }}
            >
              <div 
                onClick={() => loadConversation(conv.conversationId)}
                style={{ cursor: 'pointer', paddingRight: '30px' }}
              >
                <div style={{ fontWeight: 'bold' }}>
                  {new Date(conv.createdAt).toLocaleDateString()}
                </div>
                <div style={{ color: '#666', marginTop: '2px' }}>
                  {conv.title || 'Untitled conversation'}
                </div>
              </div>
              <button
                onClick={(e) => deleteConversation(conv.conversationId, e)}
                style={{
                  position: 'absolute',
                  right: '5px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: '#ff4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  width: '20px',
                  height: '20px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Delete conversation"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 15px 0' }}>Delete Conversation</h3>
            <p style={{ margin: '0 0 20px 0' }}>
              Are you sure you want to delete this conversation? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(showDeleteConfirm)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ff4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Messages */}
        <div style={{ 
          flex: 1, 
          overflow: 'auto', 
          padding: '20px',
          backgroundColor: 'white',
          margin: '10px',
          borderRadius: '8px',
          border: '1px solid #ddd'
        }}>
          {messages.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              color: '#666', 
              marginTop: '50px',
              fontSize: '18px'
            }}>
              Welcome to CrossRiver AI! Start a conversation by typing a message below.
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                style={{
                  marginBottom: '20px',
                  display: 'flex',
                  justifyContent: message.isUser ? 'flex-end' : 'flex-start'
                }}
              >
                <div
                  style={{
                    maxWidth: '70%',
                    padding: '12px 16px',
                    borderRadius: '18px',
                    backgroundColor: message.isUser ? '#007bff' : '#f1f1f1',
                    color: message.isUser ? 'white' : 'black',
                    wordWrap: 'break-word',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {message.text}
                  {!message.isUser && isStreaming && message === messages[messages.length - 1] && (
                    <span style={{ opacity: 0.5 }}>▊</span>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Error Display */}
        {error && (
          <div style={{ 
            margin: '0 10px',
            padding: '10px',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            color: 'red',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {/* Input Area */}
        <div style={{ 
          padding: '10px', 
          backgroundColor: 'white',
          margin: '0 10px 10px 10px',
          borderRadius: '8px',
          border: '1px solid #ddd',
          display: 'flex',
          gap: '10px'
        }}>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
            disabled={isStreaming}
            style={{
              flex: 1,
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              resize: 'none',
              fontSize: '14px',
              fontFamily: 'inherit',
              minHeight: '20px',
              maxHeight: '100px'
            }}
            rows={1}
          />
          
          {isStreaming ? (
            <button
              onClick={stopStreaming}
              style={{
                padding: '12px 20px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim()}
              style={{
                padding: '12px 20px',
                backgroundColor: inputText.trim() ? '#007bff' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: inputText.trim() ? 'pointer' : 'not-allowed',
                fontSize: '14px'
              }}
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
};