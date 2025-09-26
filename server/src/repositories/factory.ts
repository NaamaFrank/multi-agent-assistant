import { UserRepo, MemoryUserRepo } from './UserRepo';
import { ConversationsRepo, MemoryConversationsRepo } from './ConversationsRepo';
import { MessagesRepo, MemoryMessagesRepo } from './MessagesRepo';
import { UsersRepoDynamo, ConversationsRepoDynamo, MessagesRepoDynamo } from './dynamo';

export function createUserRepo(): UserRepo {
  const persistence = process.env.PERSISTENCE || 'memory';
  
  if (persistence === 'dynamo') {
    return new UsersRepoDynamo();
  }
  
  return new MemoryUserRepo();
}

export function createConversationsRepo(): ConversationsRepo {
  const persistence = process.env.PERSISTENCE || 'memory';
  
  if (persistence === 'dynamo') {
    return new ConversationsRepoDynamo();
  }
  
  return new MemoryConversationsRepo();
}

export function createMessagesRepo(): MessagesRepo {
  const persistence = process.env.PERSISTENCE || 'memory';
  
  if (persistence === 'dynamo') {
    return new MessagesRepoDynamo();
  }
  
  return new MemoryMessagesRepo();
}

// Singleton instances for dependency injection
let userRepoInstance: UserRepo | null = null;
let conversationsRepoInstance: ConversationsRepo | null = null;
let messagesRepoInstance: MessagesRepo | null = null;

export function getUserRepo(): UserRepo {
  if (!userRepoInstance) {
    userRepoInstance = createUserRepo();
  }
  return userRepoInstance;
}

export function getConversationsRepo(): ConversationsRepo {
  if (!conversationsRepoInstance) {
    conversationsRepoInstance = createConversationsRepo();
  }
  return conversationsRepoInstance;
}

export function getMessagesRepo(): MessagesRepo {
  if (!messagesRepoInstance) {
    messagesRepoInstance = createMessagesRepo();
  }
  return messagesRepoInstance;
}