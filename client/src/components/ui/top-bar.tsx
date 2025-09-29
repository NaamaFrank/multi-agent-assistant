import { motion } from 'framer-motion';
import { Sun, Moon, MessageSquare } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';

export function TopBar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass sticky top-0 z-50 border-b backdrop-blur-xl"
    >
      <div className="flex items-center justify-between px-6 py-4">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-10 h-10 bg-gradient-to-br from-accent to-accent-2 rounded-xl flex items-center justify-center shadow-glow"
          >
            <MessageSquare className="h-5 w-5 text-fg-inverse" />
          </motion.div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-semibold text-fg">CrossRiver AI</h1>
            <p className="text-xs text-fg-muted">Premium Chat Experience</p>
          </div>
        </div>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className="relative w-10 h-10 p-0 rounded-xl bg-panel/50 hover:bg-panel-hover/80 border border-border/50 hover:border-border-hover/60 transition-all duration-200"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          <motion.div
            key={theme}
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 90 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-warn" />
            ) : (
              <Moon className="h-4 w-4 text-accent" />
            )}
          </motion.div>
          
          {/* Glow effect */}
          <motion.div
            className="absolute inset-0 rounded-xl bg-accent/20 blur-lg opacity-0"
            whileHover={{ opacity: 0.3 }}
            transition={{ duration: 0.2 }}
          />
        </Button>
      </div>
    </motion.div>
  );
}