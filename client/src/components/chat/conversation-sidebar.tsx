import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, MessageSquare, Trash2, Edit2, User, LogOut } from 'lucide-react';
import type { Conversation } from '@/types';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ConfirmationModal } from '@/components/ui/modal';
import { EditConversationModal } from './edit-conversation-modal';
import { useChat } from '@/hooks/use-chat';
import { useAuth } from '@/hooks/use-auth';
import { formatDate } from '@/lib/utils';

interface ConversationSidebarProps {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  onSelectConversation: (conversation: Conversation) => void;
  handleNewConversation: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function ConversationSidebar({
  conversations,
  currentConversation,
  onSelectConversation,
  handleNewConversation,
  isLoading,
  error,
}: ConversationSidebarProps) {
  const {deleteConversation } = useChat();
  const { user, logout } = useAuth();
  
  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);

  const handleEditConversation = (conversation: Conversation, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedConversation(conversation);
    setShowEditModal(true);
  };

  const handleDeleteConversation = (conversation: Conversation, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedConversation(conversation);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedConversation) return;
    
    try {
      setIsDeletingConversation(true);
      await deleteConversation(selectedConversation.conversationId);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    } finally {
      setIsDeletingConversation(false);
      setShowDeleteModal(false);
      setSelectedConversation(null);
    }
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setSelectedConversation(null);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedConversation(null);
  };

  return (
    <div className="h-full flex flex-col bg-surface/50">
      {/* Header */}
      <div className="p-6 border-b border-border/50 space-y-4">
        {/* User Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 shadow-soft">
              <User className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-fg truncate">
                {user?.firstName || 'User'}
              </p>
              <p className="text-xs text-fg-muted truncate">
                {user?.email}
              </p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={logout}
            className="flex-shrink-0 h-9 w-9 p-0 glass-hover rounded-xl flex items-center justify-center group"
            title="Logout"
          >
            <LogOut className="h-4 w-4 text-fg-muted group-hover:text-red-400 transition-colors" />
          </motion.button>
        </div>
        
        {/* New Chat Button */}
        <motion.button
          onClick={handleNewConversation}
          disabled={isLoading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full h-11 glass-hover rounded-xl flex items-center justify-center gap-3 font-medium text-fg disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform duration-200" />
          New Chat
        </motion.button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        {isLoading && conversations.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <div className="flex flex-col items-center gap-3">
              <LoadingSpinner className="h-6 w-6" />
              <p className="text-sm text-fg-muted">Loading conversations...</p>
            </div>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-400 text-sm glass rounded-xl m-4 border border-red-400/20">
            {error}
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center">
            <div className="glass rounded-xl p-6 border border-border/50">
              <MessageSquare className="h-12 w-12 text-fg-muted mx-auto mb-3 opacity-50" />
              <p className="text-fg-muted text-sm">No conversations yet.</p>
              <p className="text-fg-muted text-xs mt-1">Start a new chat to begin!</p>
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {conversations.map((conversation, index) => (
              <motion.div
                key={conversation.conversationId}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ 
                  duration: 0.3, 
                  delay: index * 0.05,
                  type: "spring",
                  stiffness: 300,
                  damping: 25
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`group relative p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                  currentConversation?.conversationId === conversation.conversationId
                    ? 'glass-selected border border-primary/30 shadow-primary/20 shadow-lg'
                    : 'glass-hover border border-border/30'
                }`}
                onClick={() => onSelectConversation(conversation)}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg transition-colors ${
                    currentConversation?.conversationId === conversation.conversationId
                      ? 'bg-primary/20 text-primary'
                      : 'bg-surface text-fg-muted group-hover:bg-accent/20 group-hover:text-accent'
                  }`}>
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${
                      currentConversation?.conversationId === conversation.conversationId
                        ? 'text-fg'
                        : 'text-fg group-hover:text-fg'
                    }`}>
                      {conversation.title || 'New Conversation'}
                    </p>
                    <p className="text-xs text-fg-muted mt-1">
                      {formatDate(conversation.lastMessageAt)}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-all duration-200 flex gap-1">
                  <motion.button
                    onClick={(e) => handleEditConversation(conversation, e)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-2 rounded-lg glass-hover hover:bg-surface/80 transition-colors group/btn"
                    title="Edit conversation"
                  >
                    <Edit2 className="h-3 w-3 text-fg-muted group-hover/btn:text-accent transition-colors" />
                  </motion.button>
                  <motion.button
                    onClick={(e) => handleDeleteConversation(conversation, e)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-2 rounded-lg glass-hover hover:bg-red-500/10 transition-colors group/btn"
                    title="Delete conversation"
                  >
                    <Trash2 className="h-3 w-3 text-fg-muted group-hover/btn:text-red-400 transition-colors" />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border/50">
        <div className="text-xs text-fg-muted text-center font-medium">
          {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
        </div>
      </div>
      
      {/* Modals */}
      <EditConversationModal
        conversation={selectedConversation}
        isOpen={showEditModal}
        onClose={closeEditModal}
      />
      
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        title="Delete Conversation"
        message={`Are you sure you want to delete "${selectedConversation?.title || 'this conversation'}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeletingConversation}
      />
    </div>
  );
}