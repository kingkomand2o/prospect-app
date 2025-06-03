import { users, prospects, type User, type InsertUser, type Prospect, type InsertProspect } from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Prospect methods
  getAllProspects(): Promise<Prospect[]>;
  createProspect(prospect: InsertProspect): Promise<Prospect>;
  updateProspectStatus(id: number, status: string): Promise<Prospect | undefined>;
  deleteProspect(id: number): Promise<boolean>;
  createManyProspects(prospects: InsertProspect[]): Promise<Prospect[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private prospects: Map<number, Prospect>;
  private currentUserId: number;
  private currentProspectId: number;

  constructor() {
    this.users = new Map();
    this.prospects = new Map();
    this.currentUserId = 1;
    this.currentProspectId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getAllProspects(): Promise<Prospect[]> {
    return Array.from(this.prospects.values());
  }

  async createProspect(insertProspect: InsertProspect): Promise<Prospect> {
    const id = this.currentProspectId++;
    const generatedMessage = `Hi ${insertProspect.name}, we are here to help you with ${insertProspect.skinProblems}.`;
    const prospect: Prospect = {
      ...insertProspect,
      id,
      generatedMessage,
      status: "pending"
    };
    this.prospects.set(id, prospect);
    return prospect;
  }

  async updateProspectStatus(id: number, status: string): Promise<Prospect | undefined> {
    const prospect = this.prospects.get(id);
    if (prospect) {
      prospect.status = status;
      this.prospects.set(id, prospect);
      return prospect;
    }
    return undefined;
  }

  async deleteProspect(id: number): Promise<boolean> {
    return this.prospects.delete(id);
  }

  async createManyProspects(insertProspects: InsertProspect[]): Promise<Prospect[]> {
    const createdProspects: Prospect[] = [];
    for (const insertProspect of insertProspects) {
      const prospect = await this.createProspect(insertProspect);
      createdProspects.push(prospect);
    }
    return createdProspects;
  }
}

export const storage = new MemStorage();
