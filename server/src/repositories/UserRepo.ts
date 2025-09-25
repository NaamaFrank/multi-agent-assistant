import { User, CreateUserData } from '../types';

export interface UserRepo {
  findByEmail(email: string): Promise<User | null>;
  findById(id: number): Promise<User | null>;
  create(userData: CreateUserData): Promise<User>;
  update(id: number, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | null>;
  delete(id: number): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  exists(email: string): Promise<boolean>;
}

export class MemoryUserRepo implements UserRepo {
  private users: Map<number, User> = new Map();
  private nextId: number = 1;

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async findById(id: number): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async create(userData: CreateUserData): Promise<User> {
    const user: User = {
      id: this.nextId++,
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.users.set(user.id, user);
    return user;
  }

  async update(id: number, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) {
      return null;
    }

    const updatedUser: User = {
      ...user,
      ...updates,
      updatedAt: new Date()
    };

    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async delete(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async exists(email: string): Promise<boolean> {
    return await this.findByEmail(email) !== null;
  }

  // Method to clear all users (useful for testing)
  clear(): void {
    this.users.clear();
    this.nextId = 1;
  }
}