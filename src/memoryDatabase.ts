import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Database schema definition
interface MemoryDB extends DBSchema {
    dates: {
        key: string;
        value: ImportantDate;
        indexes: { 'by-date': string };
    };
    conversations: {
        key: string;
        value: ConversationRecord;
        indexes: { 'by-timestamp': number };
    };
    people: {
        key: string;
        value: PersonRecord;
        indexes: { 'by-name': string; 'by-lastSeen': number };
    };
}

export interface ImportantDate {
    id: string;
    date: string;
    event: string;
    type: 'meeting' | 'appointment' | 'reminder';
    createdAt: Date;
}

export interface ConversationEntry {
    speaker: string;
    text: string;
    timestamp: Date;
}

export interface ConversationRecord {
    id: string;
    timestamp: Date;
    participants: string[];
    summary: string;
    fullTranscript: ConversationEntry[];
}

export interface PersonRecord {
    id: string;
    name: string;
    relation: string;
    faceImage: string; // Base64
    faceEmbedding?: number[]; // Changed from Float32Array for JSON serialization
    firstSeen: Date;
    lastSeen: Date;
    conversationContext: string;
}

const DB_NAME = 'mnemosync-memory';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<MemoryDB> | null = null;

// Initialize database
export async function initDatabase(): Promise<IDBPDatabase<MemoryDB>> {
    if (dbInstance) return dbInstance;

    dbInstance = await openDB<MemoryDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            // Dates store
            if (!db.objectStoreNames.contains('dates')) {
                const datesStore = db.createObjectStore('dates', { keyPath: 'id' });
                datesStore.createIndex('by-date', 'date');
            }

            // Conversations store
            if (!db.objectStoreNames.contains('conversations')) {
                const convoStore = db.createObjectStore('conversations', { keyPath: 'id' });
                convoStore.createIndex('by-timestamp', 'timestamp');
            }

            // People store
            if (!db.objectStoreNames.contains('people')) {
                const peopleStore = db.createObjectStore('people', { keyPath: 'id' });
                peopleStore.createIndex('by-name', 'name');
                peopleStore.createIndex('by-lastSeen', 'lastSeen');
            }
        },
    });

    return dbInstance;
}

// ===== DATES OPERATIONS =====

export async function addDate(date: ImportantDate): Promise<void> {
    const db = await initDatabase();
    await db.add('dates', date);
}

export async function getAllDates(): Promise<ImportantDate[]> {
    const db = await initDatabase();
    return db.getAll('dates');
}

export async function deleteDate(id: string): Promise<void> {
    const db = await initDatabase();
    await db.delete('dates', id);
}

// ===== CONVERSATIONS OPERATIONS =====

export async function addConversation(conversation: ConversationRecord): Promise<void> {
    const db = await initDatabase();
    await db.add('conversations', conversation);
}

export async function getAllConversations(): Promise<ConversationRecord[]> {
    const db = await initDatabase();
    const convos = await db.getAll('conversations');
    // Sort by timestamp descending (newest first)
    return convos.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function getConversation(id: string): Promise<ConversationRecord | undefined> {
    const db = await initDatabase();
    return db.get('conversations', id);
}

export async function deleteConversation(id: string): Promise<void> {
    const db = await initDatabase();
    await db.delete('conversations', id);
}

// ===== PEOPLE OPERATIONS =====

export async function addPerson(person: PersonRecord): Promise<void> {
    const db = await initDatabase();
    await db.add('people', person);
}

export async function updatePerson(person: PersonRecord): Promise<void> {
    const db = await initDatabase();
    await db.put('people', person);
}

export async function getAllPeople(): Promise<PersonRecord[]> {
    const db = await initDatabase();
    const people = await db.getAll('people');
    // Sort by last seen descending
    return people.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
}

export async function getPerson(id: string): Promise<PersonRecord | undefined> {
    const db = await initDatabase();
    return db.get('people', id);
}

export async function getPersonByName(name: string): Promise<PersonRecord | undefined> {
    const db = await initDatabase();
    const index = db.transaction('people').objectStore('people').index('by-name');
    return index.get(name);
}

export async function deletePerson(id: string): Promise<void> {
    const db = await initDatabase();
    await db.delete('people', id);
}

// ===== UTILITY FUNCTIONS =====

export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function clearAllData(): Promise<void> {
    const db = await initDatabase();
    await db.clear('dates');
    await db.clear('conversations');
    await db.clear('people');
}
