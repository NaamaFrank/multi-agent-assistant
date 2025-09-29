import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Edit2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChat } from '@/hooks/use-chat';
import type { Conversation } from '@/types';

interface EditConversationModalProps {
  conversation: Conversation | null;
  isOpen: boolean;
  onClose: () => void;
}

interface EditForm {
  title: string;
}

export function EditConversationModal({ conversation, isOpen, onClose }: EditConversationModalProps) {
  const { updateConversation } = useChat();
  const [isLoading, setIsLoading] = useState(false);
  
  const { register, handleSubmit, formState: { errors }, reset } = useForm<EditForm>({
    defaultValues: {
      title: ''
    }
  });

  // Reset form when conversation changes
  useEffect(() => {
    if (conversation) {
      reset({ title: conversation.title || 'New Conversation' });
    }
  }, [conversation, reset]);

  const onSubmit = async (data: EditForm) => {
    if (!conversation) return;
    
    try {
      setIsLoading(true);
      await updateConversation(conversation.conversationId, { title: data.title });
      onClose();
    } catch (error) {
      console.error('Failed to update conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Conversation"
      size="sm"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Conversation Title
          </label>
          <div className="relative">
            <Edit2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              id="title"
              type="text"
              placeholder="Enter conversation title"
              className="pl-10"
              {...register('title', {
                required: 'Title is required',
                minLength: {
                  value: 1,
                  message: 'Title must not be empty'
                },
                maxLength: {
                  value: 100,
                  message: 'Title must be less than 100 characters'
                }
              })}
            />
          </div>
          {errors.title && (
            <p className="text-red-500 text-sm mt-1">
              {errors.title.message}
            </p>
          )}
        </div>

        <div className="flex gap-3 justify-end pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}