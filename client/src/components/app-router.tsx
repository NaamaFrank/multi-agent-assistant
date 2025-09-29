import { useAuth } from '@/hooks/use-auth';
import { ChatInterface } from '@/components/chat/chat-interface';
import { AuthScreen } from '@/components/auth/auth-screen';
import { LoadingScreen } from './ui/loading-screen';

export function AppRouter() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return <ChatInterface />;
}