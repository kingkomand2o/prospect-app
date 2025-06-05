import { users, prospects, type User, type InsertUser, type Prospect, type InsertProspect } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Prospect methods
  getAllProspects(): Promise<Prospect[]>;
  getProspectByUniqueId(uniqueId: string): Promise<Prospect | undefined>;  // NEW
  createProspect(prospect: InsertProspect): Promise<Prospect>;
  updateProspectStatus(id: number, status: string): Promise<Prospect | undefined>;
  updateProspect(prospect: Prospect): Promise<Prospect>; // NEW full update
  deleteProspect(id: number): Promise<boolean>;
  deleteProspectByUniqueId(uniqueId: string): Promise<boolean>; // NEW optional
  createManyProspects(prospects: InsertProspect[]): Promise<Prospect[]>;
  deleteAllProspects(): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  public prospects: Map<number, Prospect>;
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
  async getProspectByPhoneNumber(phoneNumber: string): Promise<Prospect | undefined> {
    return Array.from(this.prospects.values()).find(p => p.phoneNumber === phoneNumber);
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

  async getProspectByUniqueId(uniqueId: string): Promise<Prospect | undefined> {
    return Array.from(this.prospects.values()).find(p => p.uniqueId === uniqueId);
  }

  async createProspect(insertProspect: InsertProspect): Promise<Prospect> {
    const id = this.currentProspectId++;
    const generatedMessage = `Hi ${insertProspect.name}, we are here to help you with ${insertProspect.skinProblems}.`;

    const prospect: Prospect = {
      ...insertProspect,
      id,
      uniqueId: insertProspect.uniqueId || randomUUID(), // generate if not present
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

  async updateProspect(prospect: Prospect): Promise<Prospect> {
    if (!this.prospects.has(prospect.id)) {
      throw new Error(`Prospect with id ${prospect.id} not found`);
    }

    // Regenerate message to keep it consistent with updated data
    prospect.generatedMessage = `Hi ${prospect.name}, we are here to help you with ${prospect.skinProblems}.`;

    this.prospects.set(prospect.id, prospect);
    return prospect;
  }


  async deleteProspect(id: number): Promise<boolean> {
    return this.prospects.delete(id);
  }

  async deleteProspectByUniqueId(uniqueId: string): Promise<boolean> {
    const entry = Array.from(this.prospects.entries()).find(([_, p]) => p.uniqueId === uniqueId);
    if (entry) {
      this.prospects.delete(entry[0]);
      return true;
    }
    return false;
  }

  async createManyProspects(insertProspects: InsertProspect[]): Promise<Prospect[]> {
    const createdProspects: Prospect[] = [];
    for (const insertProspect of insertProspects) {
      const prospect = await this.createProspect(insertProspect);
      createdProspects.push(prospect);
    }
    return createdProspects;
  }

  async deleteAllProspects(): Promise<void> {
    this.prospects.clear();
    this.currentProspectId = 1;
  }
}

export const storage = new MemStorage();
