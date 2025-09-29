import { motion } from 'framer-motion';

interface SkeletonLoaderProps {
  className?: string;
}

export function SkeletonLoader({ className }: SkeletonLoaderProps) {
  return (
    <div className={className}>
      <div className="space-y-6 p-6">
        {/* Simulated conversation items */}
        {[1, 2, 3, 4].map((index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="glass rounded-xl p-4 border border-border/30"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-border to-surface animate-pulse" />
              <div className="flex-1">
                <div className="h-3 bg-gradient-to-r from-border to-surface rounded animate-pulse mb-2" style={{ width: `${Math.random() * 40 + 60}%` }} />
                <div className="h-2 bg-gradient-to-r from-border to-surface rounded animate-pulse" style={{ width: `${Math.random() * 20 + 30}%` }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-2 bg-gradient-to-r from-border to-surface rounded animate-pulse" />
              <div className="h-2 bg-gradient-to-r from-border to-surface rounded animate-pulse" style={{ width: `${Math.random() * 30 + 70}%` }} />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

interface MessageSkeletonProps {
  isUser?: boolean;
  className?: string;
}

export function MessageSkeleton({ isUser = false, className }: MessageSkeletonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'} ${className}`}
    >
      {!isUser && (
        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-border to-surface animate-pulse flex-shrink-0" />
      )}
      
      <div className={`max-w-[75%] ${isUser ? 'bg-gradient-to-r from-primary/20 to-accent/20' : 'glass border border-border/30'} rounded-2xl p-5`}>
        <div className="space-y-2">
          <div className="h-3 bg-gradient-to-r from-border to-surface rounded animate-pulse" />
          <div className="h-3 bg-gradient-to-r from-border to-surface rounded animate-pulse" style={{ width: '80%' }} />
          <div className="h-3 bg-gradient-to-r from-border to-surface rounded animate-pulse" style={{ width: '60%' }} />
        </div>
      </div>
      
      {isUser && (
        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-border to-surface animate-pulse flex-shrink-0" />
      )}
    </motion.div>
  );
}