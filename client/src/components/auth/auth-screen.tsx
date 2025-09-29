import { useState } from 'react';
import { motion } from 'framer-motion';
import { LoginForm } from './login-form';
import { RegisterForm } from './register-form';
import { Button } from '@/components/ui/button';

type AuthMode = 'login' | 'register';

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <span className="text-white text-2xl font-bold">CR</span>
            </motion.div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-gray-600">
              {mode === 'login' 
                ? 'Sign in to continue your conversation' 
                : 'Join us to start chatting with AI'}
            </p>
          </div>

          {/* Auth Form */}
          <div className="space-y-6">
            {mode === 'login' ? <LoginForm /> : <RegisterForm />}

            {/* Switch Mode */}
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">
                {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
              </p>
              <Button
                variant="ghost"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="text-blue-600 hover:text-blue-700"
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </Button>
            </div>
          </div>
        </div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 text-center"
        >
          <p className="text-sm text-gray-500 mb-4">
            Experience intelligent conversations with specialized AI agents
          </p>
          <div className="flex justify-center space-x-6 text-xs text-gray-400">
            <span>🤖 AI Agents</span>
            <span>💬 Real-time Chat</span>
            <span>🔒 Secure</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}