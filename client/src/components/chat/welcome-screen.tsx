import { motion } from 'framer-motion';
import { Sparkles, MessageCircle, Code, Shield, Plane } from 'lucide-react';
import { useChat } from '@/hooks/use-chat';

interface WelcomeScreenProps {
  userName: string;
  onStartNewChat: () => void;
}

const agentFeatures = [
  {
    icon: MessageCircle,
    title: 'General Assistant',
    description: 'Get help with general questions and conversations',
    color: 'text-blue-400',
    bgColor: 'from-blue-500/20 to-indigo-500/10',
    borderColor: 'border-blue-500/30',
    iconBg: 'from-blue-500/30 to-indigo-500/20',
    shadowColor: 'hover:shadow-blue-500/20',
  },
  {
    icon: Code,
    title: 'Coding Expert',
    description: 'Programming help, debugging, and technical guidance',
    color: 'text-emerald-400',
    bgColor: 'from-emerald-500/20 to-teal-500/10',
    borderColor: 'border-emerald-500/30',
    iconBg: 'from-emerald-500/30 to-teal-500/20',
    shadowColor: 'hover:shadow-emerald-500/20',
  },
  {
    icon: Shield,
    title: 'Security Advisor',
    description: 'Cybersecurity insights and best practices',
    color: 'text-red-400',
    bgColor: 'from-red-500/20 to-rose-500/10',
    borderColor: 'border-red-500/30',
    iconBg: 'from-red-500/30 to-rose-500/20',
    shadowColor: 'hover:shadow-red-500/20',
  },
  {
    icon: Plane,
    title: 'Travel Guide',
    description: 'Travel planning, recommendations, and tips',
    color: 'text-violet-400',
    bgColor: 'from-violet-500/20 to-purple-500/10',
    borderColor: 'border-violet-500/30',
    iconBg: 'from-violet-500/30 to-purple-500/20',
    shadowColor: 'hover:shadow-violet-500/20',
  },
];

const quickStarters = [
  "Help me debug this JavaScript function",
  "What are the best security practices for web apps?",
  "Plan a 5-day trip to Japan",
  "Explain quantum computing in simple terms",
];

export function WelcomeScreen({ userName, onStartNewChat }: WelcomeScreenProps) {
  const { sendMessage } = useChat();

  const handleQuickStart = async (message: string) => {
    await sendMessage(message);
  };

  return (
    <div className="flex-1 flex flex-col items-center p-6 max-w-6xl mx-auto overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
        className="text-center mb-12 mt-8"
      >
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 15 }}
          className="w-24 h-24 bg-gradient-to-br from-primary via-accent to-primary rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-primary/30"
        >
          <Sparkles className="h-12 w-12 text-white" />
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-5xl font-bold bg-gradient-to-r from-fg to-fg-muted bg-clip-text text-transparent mb-6"
        >
          Welcome back, {userName}! 👋
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="text-xl text-fg-muted mb-8 max-w-3xl leading-relaxed"
        >
          Start a conversation with our specialized AI agents. Each agent is trained for specific domains to give you the best assistance.
        </motion.p>
      </motion.div>

      {/* Agent Features */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.8 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 w-full"
      >
        {agentFeatures.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ 
              delay: 0.8 + index * 0.15, 
              duration: 0.6,
              type: "spring",
              stiffness: 200,
              damping: 20
            }}
            whileHover={{ 
              scale: 1.05, 
              y: -8,
              transition: { duration: 0.2 }
            }}
            whileTap={{ scale: 0.95 }}
            className={`glass glass-hover border ${feature.borderColor} bg-gradient-to-br ${feature.bgColor} rounded-2xl p-6 text-center cursor-pointer shadow-soft hover:shadow-lg ${feature.shadowColor} transition-all duration-300 group`}
            onClick={onStartNewChat}
          >
            <motion.div
              className={`w-16 h-16 rounded-xl bg-gradient-to-br ${feature.iconBg} border ${feature.borderColor} flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200 shadow-sm`}
            >
              <feature.icon className={`h-8 w-8 ${feature.color}`} />
            </motion.div>
            <h3 className="font-bold text-fg mb-3 text-lg">{feature.title}</h3>
            <p className="text-sm text-fg-muted leading-relaxed">{feature.description}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Quick Starters */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.8 }}
        className="w-full max-w-4xl"
      >
        <motion.h2 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3 }}
          className="text-3xl font-bold text-fg mb-8 text-center"
        >
          Quick Starters
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickStarters.map((starter, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ 
                delay: 1.4 + index * 0.1, 
                duration: 0.6,
                type: "spring",
                stiffness: 200
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <button
                className="w-full glass glass-hover border border-border/50 rounded-2xl p-5 text-left transition-all duration-200 hover:shadow-lg hover:shadow-primary/10 group"
                onClick={() => handleQuickStart(starter)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 bg-gradient-to-r from-primary to-accent rounded-full flex-shrink-0 group-hover:scale-125 transition-transform duration-200" />
                  <span className="text-fg font-medium leading-relaxed">{starter}</span>
                </div>
              </button>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Call to Action */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.8, duration: 0.8 }}
        className="mt-12 text-center pb-8"
      >
        <motion.button
          onClick={onStartNewChat}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="px-10 py-4 text-lg font-semibold bg-gradient-to-r from-primary to-accent text-white rounded-2xl shadow-2xl shadow-primary/30 hover:shadow-3xl hover:shadow-primary/40 transition-all duration-300"
        >
          Start New Conversation
        </motion.button>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 0.6 }}
          className="text-sm text-fg-muted mt-6"
        >
          Or type your message to begin chatting with our AI agents
        </motion.p>
      </motion.div>
    </div>
  );
}