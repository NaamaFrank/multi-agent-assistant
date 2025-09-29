import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/hooks/use-auth';
import { ChatProvider } from '@/hooks/use-chat';
import { ThemeProvider } from '@/hooks/use-theme';
import { AppRouter } from '@/components/app-router';
import './globals.css';

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <div className="min-h-screen bg-bg font-sans antialiased">
        <AuthProvider>
          <ChatProvider>
            <AppRouter />
            <Toaster />
          </ChatProvider>
        </AuthProvider>
      </div>
    </ThemeProvider>
  );
}