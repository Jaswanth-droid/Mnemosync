import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { ProgressionRecord, INITIAL_PROGRESSION_HISTORY } from './diseaseAnalytics';
import { BehaviorIncident, INITIAL_BEHAVIOR_INCIDENTS } from './behaviorMentalHealth';
import { cleanEventTitle } from './nlpExtractor';

export interface CaregiverNote {
    id: string;
    timestamp: Date | string;
    author: string;
    role: string;
    category: 'observation' | 'medication' | 'doctor_visit' | 'safety_alert';
    title: string;
    note: string;
}

export interface MedicationSchedule {
    id: string;
    name: string;
    dosage: string;
    instructions: string;
    scheduledTimes: string[]; // e.g. ['08:00', '20:00']
    frequency: 'morning' | 'evening' | 'morning_evening' | 'bedtime' | 'custom';
    reason: string;
    prescribedBy?: string;
    isActive: boolean;
}

export interface MedicationAdherenceLog {
    id: string;
    scheduleId: string;
    medicationName: string;
    dosage: string;
    scheduledTime: string; // ISO date-time string
    confirmedAt: string; // ISO date-time string
    confirmedBy: 'Patient' | 'Caregiver';
    status: 'taken_on_time' | 'taken_delayed' | 'missed' | 'escalated_to_caregiver';
    notes?: string;
}

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
    progression: {
        key: string;
        value: ProgressionRecord;
        indexes: { 'by-timestamp': number };
    };
    behavior: {
        key: string;
        value: BehaviorIncident;
        indexes: { 'by-type': string };
    };
    caregiverNotes: {
        key: string;
        value: CaregiverNote;
        indexes: { 'by-category': string };
    };
    medicationSchedules: {
        key: string;
        value: MedicationSchedule;
        indexes: { 'by-name': string };
    };
    medicationAdherence: {
        key: string;
        value: MedicationAdherenceLog;
        indexes: { 'by-scheduleId': string; 'by-confirmedAt': string };
    };
}

export interface ImportantDate {
    id: string;
    date: string;
    event: string;
    type: 'meeting' | 'appointment' | 'reminder';
    createdAt: Date;
    description?: string;
    details?: string;
    speaker?: string;
    extraNotes?: string[];
    hasExactTime?: boolean;
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
    imageUrl?: string;
}

export interface PersonRecord {
    id: string;
    name: string;
    relation: string;
    faceImage: string; // Base64
    faceEmbedding?: number[];
    firstSeen: Date;
    lastSeen: Date;
    conversationContext: string;
}

const DB_NAME = 'mnemosync-memory-v3';
const DB_VERSION = 3;

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

            // Progression store
            if (!db.objectStoreNames.contains('progression')) {
                const progStore = db.createObjectStore('progression', { keyPath: 'id' });
                progStore.createIndex('by-timestamp', 'timestamp');
            }

            // Behavior store
            if (!db.objectStoreNames.contains('behavior')) {
                const behStore = db.createObjectStore('behavior', { keyPath: 'id' });
                behStore.createIndex('by-type', 'type');
            }

            // Caregiver Notes store
            if (!db.objectStoreNames.contains('caregiverNotes')) {
                const notesStore = db.createObjectStore('caregiverNotes', { keyPath: 'id' });
                notesStore.createIndex('by-category', 'category');
            }

            // Medication Schedules store
            if (!db.objectStoreNames.contains('medicationSchedules')) {
                const medStore = db.createObjectStore('medicationSchedules', { keyPath: 'id' });
                medStore.createIndex('by-name', 'name');
            }

            // Medication Adherence Logs store
            if (!db.objectStoreNames.contains('medicationAdherence')) {
                const adhStore = db.createObjectStore('medicationAdherence', { keyPath: 'id' });
                adhStore.createIndex('by-scheduleId', 'scheduleId');
                adhStore.createIndex('by-confirmedAt', 'confirmedAt');
            }
        },
    });

    return dbInstance;
}

// ===== DATES OPERATIONS =====
export async function addDate(date: ImportantDate): Promise<void> {
    const db = await initDatabase();
    const cleanTitle = cleanEventTitle(date.event, date.speaker);
    if (!cleanTitle || cleanTitle === 'Event' || cleanTitle.length < 2 || /^(?:what|when|where|who|how|why|you\s+here|tomorrow\s+have|actually|brings\s+you|is\s+my|am\s+here)/i.test(cleanTitle)) {
        return;
    }

    const existing = await db.getAll('dates');
    const match = existing.find(d => {
        const dClean = cleanEventTitle(d.event, d.speaker);
        const sameTitle = dClean.toLowerCase() === cleanTitle.toLowerCase() ||
            (dClean.toLowerCase().includes(cleanTitle.toLowerCase()) || cleanTitle.toLowerCase().includes(dClean.toLowerCase()));
        const dDate = d.date ? new Date(d.date).toDateString() : '';
        const newDate = date.date ? new Date(date.date).toDateString() : '';
        return sameTitle && (dDate === newDate || !date.date || !d.date);
    });

    if (match) {
        // Merge descriptions / extra notes if new information is provided
        let shouldUpdate = false;
        if (date.description && date.description.trim() && date.description !== match.description) {
            const currentDesc = match.description || '';
            if (!currentDesc.includes(date.description.trim())) {
                match.description = currentDesc ? `${currentDesc}\n• ${date.description.trim()}` : date.description.trim();
                shouldUpdate = true;
            }
        }
        if (date.details && date.details.trim() && date.details !== match.details) {
            match.details = match.details ? `${match.details}\n${date.details.trim()}` : date.details.trim();
            shouldUpdate = true;
        }
        if (date.speaker && !match.speaker) {
            match.speaker = date.speaker;
            shouldUpdate = true;
        }
        if (shouldUpdate) {
            await db.put('dates', match);
        }
        return;
    }

    const whenPart = date.event.includes(' — ') ? ` — ${date.event.split(' — ')[1].trim()}` : (date.event.includes(' on ') ? ` on ${date.event.split(' on ')[1].trim()}` : '');
    await db.add('dates', {
        ...date,
        event: `${cleanTitle}${whenPart}`
    });
}

export async function appendDateExtraInfo(eventIdOrTitle: string, extraUtterance: string, speaker?: string): Promise<void> {
    if (!extraUtterance || !extraUtterance.trim()) return;
    const db = await initDatabase();
    const all = await db.getAll('dates');
    if (all.length === 0) return;
    
    // Find target event by ID or title match, or fallback to the latest active event
    let target = eventIdOrTitle ? all.find(d => d.id === eventIdOrTitle ||
        cleanEventTitle(d.event).toLowerCase() === cleanEventTitle(eventIdOrTitle).toLowerCase() ||
        d.event.toLowerCase().includes(eventIdOrTitle.toLowerCase())
    ) : undefined;

    if (!target) {
        // Sort by createdAt descending to pick the most recent event
        const sorted = [...all].sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
        target = sorted[0];
    }

    if (target) {
        const formattedNote = speaker ? `${speaker}: "${extraUtterance.trim()}"` : extraUtterance.trim();
        const currentDesc = target.description || '';
        if (!currentDesc.includes(extraUtterance.trim())) {
            target.description = currentDesc ? `${currentDesc}\n• ${formattedNote}` : formattedNote;
            if (speaker && !target.speaker) target.speaker = speaker;
            await db.put('dates', target);
        }
    }
}

export async function getAllDates(): Promise<ImportantDate[]> {
    const db = await initDatabase();
    const all = await db.getAll('dates');
    // Filter out corrupted legacy noise entries and duplicate entries
    const seen = new Set<string>();
    const valid: ImportantDate[] = [];

    for (const d of all) {
        const clean = cleanEventTitle(d.event, d.speaker);
        const isCorrupted = !clean || clean === 'Event' || clean.length < 2 ||
            /^(?:what|when|where|who|how|why|you\s+here|tomorrow\s+have|actually|brings\s+you|is\s+my\s+birthday|am\s+here\s+for)/i.test(clean);

        if (isCorrupted) {
            // Asynchronously delete corrupted record
            db.delete('dates', d.id).catch(() => {});
            continue;
        }

        const dateKey = d.date ? new Date(d.date).toDateString() : 'no-date';
        const key = `${clean.toLowerCase()}|${dateKey}`;
        if (seen.has(key)) {
            // Asynchronously delete duplicate record
            db.delete('dates', d.id).catch(() => {});
            continue;
        }

        seen.add(key);
        valid.push(d);
    }

    return valid;
}

export async function updateDate(date: ImportantDate): Promise<void> {
    const db = await initDatabase();
    await db.put('dates', date);
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

// ===== DISEASE PROGRESSION OPERATIONS =====
export async function getProgressionHistory(): Promise<ProgressionRecord[]> {
    const db = await initDatabase();
    let records = await db.getAll('progression');
    if (records.length === 0) {
        for (const item of INITIAL_PROGRESSION_HISTORY) {
            await db.put('progression', item);
        }
        records = await db.getAll('progression');
    }
    return records.sort((a, b) => a.timestamp - b.timestamp);
}

export async function addProgressionRecord(record: ProgressionRecord): Promise<void> {
    const db = await initDatabase();
    await db.put('progression', record);
}

// ===== BEHAVIOR OPERATIONS =====
export async function getBehaviorIncidents(): Promise<BehaviorIncident[]> {
    const db = await initDatabase();
    let records = await db.getAll('behavior');
    if (records.length === 0) {
        for (const item of INITIAL_BEHAVIOR_INCIDENTS) {
            await db.put('behavior', item);
        }
        records = await db.getAll('behavior');
    }
    return records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function addBehaviorIncident(incident: BehaviorIncident): Promise<void> {
    const db = await initDatabase();
    await db.put('behavior', incident);
}

// ===== CAREGIVER NOTES OPERATIONS =====
export async function getCaregiverNotes(): Promise<CaregiverNote[]> {
    const db = await initDatabase();
    let notes = await db.getAll('caregiverNotes');
    if (notes.length === 0) {
        const seedNotes: CaregiverNote[] = [
            {
                id: 'note-1',
                timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
                author: 'Dr. Sarah Jenkins',
                role: 'Neurologist / Memory Care Specialist',
                category: 'doctor_visit',
                title: 'Quarterly Neurocognitive Evaluation',
                note: 'Patient remains stable at CDR 1.0 (Mild Dementia). Advised continuing audio-visual familiarization and circadian lighting. Current Donepezil 10mg regimen retained.'
            },
            {
                id: 'note-2',
                timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
                author: 'Maya Sharma (Primary Caregiver)',
                role: 'Daughter / Family Caregiver',
                category: 'observation',
                title: 'Evening Calm Protocol Success',
                note: 'Played the 1970s acoustic playlist at 17:30 before sundowning onset. Patient was remarkably calm and enjoyed looking at old photo albums on the HUD.'
            },
            {
                id: 'note-3',
                timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
                author: 'Nurse Robert Vance',
                role: 'Home Health Aide',
                category: 'medication',
                title: 'Medication Administration & Fluid Intake',
                note: 'Morning Donepezil and Memantine taken on time with breakfast. 1.8L water intake achieved throughout the day.'
            }
        ];
        for (const note of seedNotes) {
            await db.put('caregiverNotes', note);
        }
        notes = await db.getAll('caregiverNotes');
    }
    return notes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function addCaregiverNote(note: CaregiverNote): Promise<void> {
    const db = await initDatabase();
    await db.put('caregiverNotes', note);
}

// ===== MEDICATION SCHEDULES & ADHERENCE =====
export const INITIAL_MEDICATION_SCHEDULES: MedicationSchedule[] = [
    {
        id: 'med-donepezil',
        name: 'Donepezil (Aricept)',
        dosage: '10mg',
        instructions: 'Take 1 tablet daily in the morning with a glass of water and breakfast.',
        scheduledTimes: ['08:00'],
        frequency: 'morning',
        reason: 'Cholinesterase inhibitor to enhance acetylcholine and preserve episodic memory.',
        prescribedBy: 'Dr. Sarah Jenkins (Neurology)',
        isActive: true
    },
    {
        id: 'med-memantine',
        name: 'Memantine (Namenda)',
        dosage: '10mg',
        instructions: 'Take 1 tablet twice daily: with morning breakfast and evening dinner.',
        scheduledTimes: ['08:00', '20:00'],
        frequency: 'morning_evening',
        reason: 'NMDA receptor antagonist to protect neural cells from toxic glutamate accumulation.',
        prescribedBy: 'Dr. Sarah Jenkins (Neurology)',
        isActive: true
    },
    {
        id: 'med-melatonin',
        name: 'Melatonin',
        dosage: '3mg',
        instructions: 'Take 1 tablet 30 minutes before bedtime with dim room lighting.',
        scheduledTimes: ['21:30'],
        frequency: 'bedtime',
        reason: 'Circadian neuro-hormone to reduce sundowning restlessness and nocturnal awakenings.',
        prescribedBy: 'Dr. Sarah Jenkins (Neurology)',
        isActive: true
    }
];

export async function getMedicationSchedules(): Promise<MedicationSchedule[]> {
    const db = await initDatabase();
    let schedules = await db.getAll('medicationSchedules');
    if (schedules.length === 0) {
        for (const s of INITIAL_MEDICATION_SCHEDULES) {
            await db.put('medicationSchedules', s);
        }
        schedules = await db.getAll('medicationSchedules');
    }
    return schedules;
}

export const SCHEDULES_CHANGED_EVENT = 'mnemosync:schedules-changed';

function notifySchedulesChanged() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(SCHEDULES_CHANGED_EVENT));
    }
}

export async function addMedicationSchedule(schedule: MedicationSchedule): Promise<void> {
    const db = await initDatabase();
    await db.put('medicationSchedules', schedule);
    notifySchedulesChanged();
}

export async function updateMedicationSchedule(schedule: MedicationSchedule): Promise<void> {
    const db = await initDatabase();
    await db.put('medicationSchedules', schedule);
    notifySchedulesChanged();
}

export async function getMedicationAdherenceLogs(): Promise<MedicationAdherenceLog[]> {
    const db = await initDatabase();
    let logs = await db.getAll('medicationAdherence');
    if (logs.length === 0) {
        // Seed realistic 7-day adherence history
        const now = Date.now();
        const seedLogs: MedicationAdherenceLog[] = [];
        
        for (let i = 6; i >= 1; i--) {
            const dayTimestamp = now - i * 24 * 60 * 60 * 1000;
            const dateStr = new Date(dayTimestamp).toISOString().split('T')[0];

            // Donepezil morning
            seedLogs.push({
                id: `log-don-${i}`,
                scheduleId: 'med-donepezil',
                medicationName: 'Donepezil (Aricept)',
                dosage: '10mg',
                scheduledTime: `${dateStr}T08:00:00.000Z`,
                confirmedAt: `${dateStr}T08:07:00.000Z`,
                confirmedBy: i % 2 === 0 ? 'Patient' : 'Caregiver',
                status: 'taken_on_time',
                notes: 'Taken with morning oatmeal.'
            });

            // Memantine morning
            seedLogs.push({
                id: `log-mem-am-${i}`,
                scheduleId: 'med-memantine',
                medicationName: 'Memantine (Namenda)',
                dosage: '10mg',
                scheduledTime: `${dateStr}T08:00:00.000Z`,
                confirmedAt: `${dateStr}T08:08:00.000Z`,
                confirmedBy: 'Patient',
                status: 'taken_on_time'
            });

            // Memantine evening
            seedLogs.push({
                id: `log-mem-pm-${i}`,
                scheduleId: 'med-memantine',
                medicationName: 'Memantine (Namenda)',
                dosage: '10mg',
                scheduledTime: `${dateStr}T20:00:00.000Z`,
                confirmedAt: `${dateStr}T20:18:00.000Z`,
                confirmedBy: 'Caregiver',
                status: i === 3 ? 'taken_delayed' : 'taken_on_time'
            });

            // Melatonin bedtime
            seedLogs.push({
                id: `log-mel-${i}`,
                scheduleId: 'med-melatonin',
                medicationName: 'Melatonin',
                dosage: '3mg',
                scheduledTime: `${dateStr}T21:30:00.000Z`,
                confirmedAt: `${dateStr}T21:35:00.000Z`,
                confirmedBy: 'Patient',
                status: 'taken_on_time'
            });
        }

        for (const log of seedLogs) {
            await db.put('medicationAdherence', log);
        }
        logs = await db.getAll('medicationAdherence');
    }

    return logs.sort((a, b) => new Date(b.confirmedAt).getTime() - new Date(a.confirmedAt).getTime());
}

export async function addMedicationAdherenceLog(log: MedicationAdherenceLog): Promise<void> {
    const db = await initDatabase();
    await db.put('medicationAdherence', log);
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
    await db.clear('progression');
    await db.clear('behavior');
    await db.clear('caregiverNotes');
    await db.clear('medicationSchedules');
    await db.clear('medicationAdherence');
}
