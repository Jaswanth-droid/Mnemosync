import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, MessageSquare, Calendar, Users, Trash2, UserCircle2, AlertCircle } from 'lucide-react';
import { addDate, generateId, addConversation, getPerson, updatePerson, updateConversation } from './memoryDatabase';
// Helper function to parse dates from text like "Feb 16", "23rd on July", "tomorrow", "next Monday"
export function parseDateFromText(text: string): Date {
    const now = new Date();
    const currentYear = now.getFullYear();
    const lower = text.toLowerCase();

    // Month name mapping
    const months: Record<string, number> = {
        'jan': 0, 'january': 0, 'feb': 1, 'february': 1, 'mar': 2, 'march': 2,
        'apr': 3, 'april': 3, 'may': 4, 'jun': 5, 'june': 5, 'jul': 6, 'july': 6,
        'aug': 7, 'august': 7, 'sep': 8, 'sept': 8, 'september': 8,
        'oct': 9, 'october': 9, 'nov': 10, 'november': 10, 'dec': 11, 'december': 11
    };

    const monthPattern = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

    // Check for relative dates
    if (lower.includes('day after tomorrow')) {
        const d = new Date(now); d.setDate(d.getDate() + 2); return d;
    }
    if (lower.includes('today')) return now;
    if (lower.includes('tonight')) return now;
    if (lower.includes('tomorrow')) {
        const d = new Date(now); d.setDate(d.getDate() + 1); return d;
    }
    if (lower.includes('next week')) {
        const d = new Date(now); d.setDate(d.getDate() + 7); return d;
    }
    if (lower.includes('next month')) {
        const d = new Date(now); d.setMonth(d.getMonth() + 1); return d;
    }

    // Check for day names (next Monday, this Friday, etc.)
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < dayNames.length; i++) {
        if (lower.includes(dayNames[i])) {
            const d = new Date(now);
            const currentDay = d.getDay();
            let daysUntil = i - currentDay;
            if (daysUntil <= 0) daysUntil += 7; // Next occurrence
            d.setDate(d.getDate() + daysUntil);
            return d;
        }
    }

    // Helper to resolve year (current or next if date has passed)
    const resolveYear = (month: number, day: number): Date => {
        let year = currentYear;
        const targetDate = new Date(year, month, day);
        if (targetDate < now) year++;
        return new Date(year, month, day);
    };

    // Pattern 1: "Month Day" — "July 24", "July 24th", "Jul 24"
    const monthDayMatch = text.match(new RegExp(`\\b(${monthPattern})\\s+(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'));
    if (monthDayMatch) {
        const monthStr = monthDayMatch[1].toLowerCase().substring(0, 3);
        const day = parseInt(monthDayMatch[2]);
        const month = months[monthStr];
        if (month !== undefined && day >= 1 && day <= 31) {
            console.log(`[Date Parser] Matched "Month Day": ${monthDayMatch[1]} ${day}`);
            return resolveYear(month, day);
        }
    }

    // Pattern 2: "Day Month" (directly adjacent) — "24th July", "24 July", "24th Jul"
    const dayMonthMatch = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthPattern})\\b`, 'i'));
    if (dayMonthMatch) {
        const day = parseInt(dayMonthMatch[1]);
        const monthStr = dayMonthMatch[2].toLowerCase().substring(0, 3);
        const month = months[monthStr];
        if (month !== undefined && day >= 1 && day <= 31) {
            console.log(`[Date Parser] Matched "Day Month": ${day} ${dayMonthMatch[2]}`);
            return resolveYear(month, day);
        }
    }

    // Pattern 3: "Day <preposition> Month" — "23rd on July", "24th of July", "23rd in July"
    const dayPrepMonthMatch = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:on|of|in|for)\\s+(${monthPattern})\\b`, 'i'));
    if (dayPrepMonthMatch) {
        const day = parseInt(dayPrepMonthMatch[1]);
        const monthStr = dayPrepMonthMatch[2].toLowerCase().substring(0, 3);
        const month = months[monthStr];
        if (month !== undefined && day >= 1 && day <= 31) {
            console.log(`[Date Parser] Matched "Day prep Month": ${day} on ${dayPrepMonthMatch[2]}`);
            return resolveYear(month, day);
        }
    }

    // Pattern 4: "on/for Month Day" — "on July 24th", "for July 24"
    const prepMonthDayMatch = text.match(new RegExp(`\\b(?:on|for|in|by)\\s+(${monthPattern})\\s+(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'));
    if (prepMonthDayMatch) {
        const monthStr = prepMonthDayMatch[1].toLowerCase().substring(0, 3);
        const day = parseInt(prepMonthDayMatch[2]);
        const month = months[monthStr];
        if (month !== undefined && day >= 1 && day <= 31) {
            console.log(`[Date Parser] Matched "prep Month Day": on ${prepMonthDayMatch[1]} ${day}`);
            return resolveYear(month, day);
        }
    }

    // Pattern 5: Scattered — day number and month name anywhere in the text (fallback)
    // Find any day number (1-31) and any month name in the text
    const anyDayMatch = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
    const anyMonthMatch = text.match(new RegExp(`\\b(${monthPattern})\\b`, 'i'));
    if (anyDayMatch && anyMonthMatch) {
        const day = parseInt(anyDayMatch[1]);
        const monthStr = anyMonthMatch[1].toLowerCase().substring(0, 3);
        const month = months[monthStr];
        if (month !== undefined && day >= 1 && day <= 31) {
            console.log(`[Date Parser] Matched scattered day+month: ${day} + ${anyMonthMatch[1]}`);
            return resolveYear(month, day);
        }
    }

    // Pattern 6: Standalone month name — "in July", "July" → default to 1st of that month
    if (anyMonthMatch && !anyDayMatch) {
        const monthStr = anyMonthMatch[1].toLowerCase().substring(0, 3);
        const month = months[monthStr];
        if (month !== undefined) {
            console.log(`[Date Parser] Matched standalone month: ${anyMonthMatch[1]} → 1st`);
            return resolveYear(month, 1);
        }
    }

    // Try standard date formats (M/D/YYYY, YYYY-MM-DD, etc.)
    const standardDate = new Date(text);
    if (!isNaN(standardDate.getTime())) {
        return standardDate;
    }

    // Default to today if no date could be parsed
    console.log('[Date Parser] Could not parse date from:', text, '- using today');
    return now;
}

import nlp from 'compromise';

// Lightweight NLP helper to extract the Named Entity (the core event/task)
// Strips out leading verbs, pronouns, articles, and filler words to present clean tasks.
function cleanTaskName(text: string): string {
    let cleaned = text.trim();

    // 1. Strip conversational/invitation prefixes from the beginning of the task
    const prefixRegexes = [
        /^(?:i\s+)?(?:wanted\s+to\s+|came\s+to\s+)?(?:invite|invited)\s+(?:you|yoy|ya|u|him|her|them|us)?\s*(?:to|for|on)\s+(?:my|a|the|our|your)?\s*/i,
        /^(?:remember\s+to|don't\s+forget\s+to|remind\s+me\s+to|need\s+to|should|have\s+to|want\s+to|got\s+to)\s+/i,
        /^(?:i'm\s+)?(?:going\s+to|planning\s+to)\s+/i
    ];
    
    for (const regex of prefixRegexes) {
        cleaned = cleaned.replace(regex, '');
    }

    // 2. Replace abbreviations like bday -> Birthday
    cleaned = cleaned.replace(/\bbday\b/gi, 'Birthday');
    cleaned = cleaned.replace(/\bb'day\b/gi, 'Birthday');

    // 3. Run compromise NLP to clean up parts of speech
    // We remove pronouns, determiners, conjunctions, and adverbs, but NOT verbs or prepositions
    // to preserve actions (e.g. "Buy Milk", "Call Dentist") and relations (e.g. "Dinner with Family").
    let doc = nlp(cleaned);
    doc.remove('#Pronoun');
    doc.remove('#Conjunction');
    doc.remove('#Determiner'); 
    doc.remove('#Adverb');
    
    // Remove specific conversational fillers
    doc.remove('(so|well|just|really|also|like|basically|literally|actually)');
    
    let nlpCleaned = doc.out('text').replace(/\s+/g, ' ').trim();
    
    // If the NLP stripped absolutely everything, fallback to our pre-cleaned text
    if (!nlpCleaned || nlpCleaned.length < 2) {
        nlpCleaned = cleaned.trim();
        const fillers = ['so', 'i', 'have', 'a', 'an', 'the', 'my', 'our', 'just', 'got'];
        const words = nlpCleaned.split(/\s+/);
        nlpCleaned = words.filter((w: string) => !fillers.includes(w.toLowerCase())).join(' ');
        if (!nlpCleaned) nlpCleaned = cleaned.trim(); // Ultimate fallback
    }

    // Capitalize the first letter of each word (Title Case) for a clean UI presentation
    return nlpCleaned.split(' ')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

interface ConversationEntry {
    speaker: string;
    text: string;
    timestamp: Date;
}

// Helper: Generate Mock AI Response using Regex
const generateMockResponse = (text: string, visitorName: string, visitorRelation: string): string => {
    const lowerText = text.toLowerCase();
    let mockDate = "None";
    let mockAction = "None";

    // Extract dates using heuristic (global match) - now finds ALL dates
    const dateRegex = /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?/gi;
    const matches = text.match(dateRegex);

    if (matches) {
        const foundDates = matches.map(m => m.trim());
        const uniqueDates = [...new Set(foundDates)];
        mockDate = uniqueDates.join(', ');
    } else if (text.match(/((?:today|tomorrow|next week|next month))/i)) {
        const relMatch = text.match(/((?:today|tomorrow|next week|next month))/i);
        mockDate = relMatch ? relMatch[0] : "None";
    }

    // Extract possible actions
    if (lowerText.includes('remind') || lowerText.includes('remember') || lowerText.includes('don\'t forget')) {
        mockAction = text;
    }

    // Extract name if visitor introduces themselves
    let extractedName = visitorName;
    const nameMatch = lowerText.match(/my name is\s+([a-z]+)/i);
    const imMatch = lowerText.match(/i'm\s+([a-z]+)/i);
    const iAmMatch = lowerText.match(/i am\s+([a-z]+)/i);
    
    if (nameMatch) extractedName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1);
    else if (imMatch) extractedName = imMatch[1].charAt(0).toUpperCase() + imMatch[1].slice(1);
    else if (iAmMatch) extractedName = iAmMatch[1].charAt(0).toUpperCase() + iAmMatch[1].slice(1);

    if (extractedName !== visitorName && visitorRelation === 'someone') {
        visitorRelation = 'Visitor'; // Upgrade from 'someone' to 'Visitor' if we got a name
    }

    return `
VISITOR: ${extractedName}, ${visitorRelation}
SUMMARY: You had a conversation with ${extractedName !== 'the visitor' ? extractedName : 'a visitor'}. You discussed ${mockDate !== 'None' ? 'dates: ' + mockDate : 'various topics'}.
DATES: ${mockDate}
ACTIONS: ${mockAction}
`;
};

interface ConversationRecorderProps {
    onDateDetected: (event: string) => void;
    onConversationUpdate: (summary: string, visitorInfo?: { name: string; relation: string }) => void;
    primaryModel: any;
    backupModel: any;
    patientName?: string; // The Alzheimer's patient (Person A)
    captureScreenshot?: () => string | null;
}

export default function ConversationRecorder({
    onDateDetected,
    onConversationUpdate,
    primaryModel,
    backupModel,
    patientName = 'User',
    captureScreenshot
}: ConversationRecorderProps) {
    const [isListening, setIsListening] = useState(false);
    const [conversations, setConversations] = useState<ConversationEntry[]>([]);
    const [currentSpeaker, setCurrentSpeaker] = useState<'You' | 'Visitor'>('You');
    const [lastSummary, setLastSummary] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [visitorInfo, setVisitorInfo] = useState<{ id?: string; name: string; relation: string } | null>(null);
    const [interimTranscript, setInterimTranscript] = useState<string>('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const recognitionRef = useRef<any>(null);
    const silenceTimerRef = useRef<number | null>(null);
    const lastSpeechTimeRef = useRef<number>(Date.now());
    const isManualSwitchRef = useRef<boolean>(false);
    const lastAutoSpeakerRef = useRef<'User' | 'Visitor'>('Visitor');
    const currentSpeakerRef = useRef<'You' | 'Visitor'>(currentSpeaker);
    const convoIdRef = useRef<string | null>(null);
    const convoImageRef = useRef<string | null>(null);
    const onDateDetectedRef = useRef(onDateDetected);

    // Keep refs in sync
    useEffect(() => {
        currentSpeakerRef.current = currentSpeaker;
    }, [currentSpeaker]);
    useEffect(() => {
        onDateDetectedRef.current = onDateDetected;
    }, [onDateDetected]);

    // Enhanced speaker switch that handles both state and ref
    const updateSpeaker = useCallback((newSpeaker: 'You' | 'Visitor', manual = false) => {
        if (currentSpeakerRef.current === newSpeaker && !manual) return;

        setCurrentSpeaker(newSpeaker);
        currentSpeakerRef.current = newSpeaker;
        if (manual) isManualSwitchRef.current = true;
        console.log(`[Speaker] Switch to ${newSpeaker} (${manual ? 'Manual' : 'Auto'})`);
    }, []);



    // Auto-update past conversation entries when visitor name is revealed
    useEffect(() => {
        if (visitorInfo && visitorInfo.name && visitorInfo.name !== 'the visitor') {
            setConversations(prev => prev.map(entry => ({
                ...entry,
                speaker: entry.speaker === 'Visitor' ? visitorInfo.name : entry.speaker
            })));
            console.log(`[Conversation] Updated 'Visitor' labels to '${visitorInfo.name}'`);
        }
    }, [visitorInfo]);

    // Track listening state in ref for callbacks
    const isListeningRef = useRef(isListening);
    useEffect(() => {
        isListeningRef.current = isListening;
    }, [isListening]);

    // Analyze conversation with Gemini - Alzheimer's focused
    const analyzeConversation = useCallback(async (convos: ConversationEntry[]) => {
        if (!primaryModel || convos.length === 0 || isProcessing) return;

        setIsProcessing(true);
        try {
            const conversationText = convos
                .map(c => `${c.speaker}: "${c.text}"`)
                .join('\n');

            // Get visitor name from conversation if available
            const visitorName = visitorInfo?.name || 'the visitor';
            const visitorRelation = visitorInfo?.relation || 'someone';

            let response = '';
            let isQuotaError = false;

            // Flags
            const FORCE_MOCK_AI = false; // Set to true only if you want to bypass Gemini completely

            if (FORCE_MOCK_AI) {
                console.log('[Mock AI] Generating response locally (Forced)...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                response = generateMockResponse(conversationText, visitorName, visitorRelation);
            } else {
                // Hybrid Tiered Mode: Primary (G3) -> Backup (G2.5) -> Mock (Regex)
                const prompt = `You are helping an Alzheimer's patient named ${patientName} remember a conversation they just had.

The conversation was between:
- "User" = ${patientName} (the Alzheimer's patient)
- "Visitor" = ${visitorName} (${visitorRelation})

Conversation:
${conversationText}

Provide a gentle, caring summary for ${patientName} explaining:
1. WHO they were talking to (use the visitor's name and relationship if known)
2. WHAT they discussed (key topics in simple terms)
3. Any IMPORTANT things to remember (dates, promises, tasks)

Also, double check if the "User" and "Visitor" speakers are logically correct. For example, if someone says "Hi ${patientName}", they must be the Visitor. If there are mistakes, fix them in the transcript.

Respond in this exact format:
VISITOR: [visitor's name and their relationship to ${patientName}, or "Unknown visitor" if not clear]
SUMMARY: [A warm, simple 1-2 sentence summary written as if speaking directly to ${patientName}]
DATES: [Extract any tasks or events in the format: Title | Description | Date | Time (or 'None'). E.g., "Doctor Appointment | Annual checkup | 23rd July | 2:00 PM" or "None"]
ACTIONS: [Any promises made or tasks to do, or "None"]
TRANSCRIPT:
User: "Corrected text"
Visitor: "Corrected text"
...`;

                try {
                    console.log('[Conversation] Attempting Primary Model...');
                    const result = await primaryModel.generateContent(prompt);
                    response = result.response.text();
                } catch (primaryError: any) {
                    console.warn('[Conversation] Primary Model failed, trying Backup...', primaryError.message);

                    if (backupModel) {
                        try {
                            const result = await backupModel.generateContent(prompt);
                            response = result.response.text();
                        } catch (backupError: any) {
                            console.error('[Conversation] Backup Model also failed. Using Mock AI fallback.', backupError.message);
                            response = generateMockResponse(conversationText, visitorName, visitorRelation);
                        }
                    } else {
                        console.log('[Conversation] No backup model available. Using Mock AI fallback.');
                        response = generateMockResponse(conversationText, visitorName, visitorRelation);
                    }
                }
            }

            // Parse the response (from Gemini or Mock)
            const visitorMatch = response.match(/VISITOR:\s*(.+?)(?=SUMMARY:|$)/s);
            const summaryMatch = response.match(/SUMMARY:\s*(.+?)(?=DATES:|$)/s);
            let datesMatch = response.match(/DATES:\s*(.+?)(?=ACTIONS:|$)/s); // Let allows modification

            // HYBRID ENHANCEMENT: Always run Regex for dates and append to Gemini's result
            const dateRegex = /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?/gi;
            const regexMatches = conversationText.match(dateRegex);

            if (regexMatches) {
                const foundDates = regexMatches.map(m => m.trim());
                const uniqueRegexDates = [...new Set(foundDates)];

                console.log('[Hybrid] Regex found:', uniqueRegexDates.join(', '));

                let combinedDates = '';
                if (datesMatch) {
                    let existingDates = datesMatch[1].trim();
                    if (existingDates.toLowerCase().includes('none')) {
                        // Gemini found nothing, replace with Regex result
                        console.log('[Hybrid] Gemini missed dates. Using Regex.');
                        combinedDates = uniqueRegexDates.join(', ');
                    } else {
                        console.log('[Hybrid] Merging Gemini dates with Regex dates.');
                        const existingDateArray = existingDates.split(',').map(d => d.trim()).filter(d => d);
                        const allDates = [...new Set([...existingDateArray, ...uniqueRegexDates])];
                        combinedDates = allDates.join(', ');
                    }
                } else {
                    // No datesMatch from Gemini at all, just use regex dates
                    combinedDates = uniqueRegexDates.join(', ');
                }

                // Update datesMatch to reflect the combined result for subsequent processing
                // Only merge if we actually found something worth adding
                if (combinedDates) {
                    datesMatch = [`DATES: ${combinedDates}`, combinedDates] as RegExpMatchArray;
                }
            }
            const actionsMatch = response.match(/ACTIONS:\s*(.+?)$/s);

            let extractedVisitor = visitorInfo;
            if (visitorMatch) {
                const visitorText = visitorMatch[1].trim();
                if (!visitorText.toLowerCase().includes('unknown')) {
                    const newName = visitorText.split(',')[0].trim();
                    const newRelation = visitorText.includes(',') ? visitorText.split(',')[1].trim() : 'visitor';
                    
                    extractedVisitor = {
                        ...visitorInfo,
                        name: newName,
                        relation: newRelation
                    };
                    setVisitorInfo(extractedVisitor);
                    
                    // Update or Add to database
                    try {
                        const { getPerson, getPersonByName, addPerson, updatePerson, generateId } = await import('./memoryDatabase');
                        
                        let existingPerson = null;
                        if (visitorInfo?.id) {
                            existingPerson = await getPerson(visitorInfo.id);
                        }
                        if (!existingPerson) {
                            existingPerson = await getPersonByName(newName);
                        }

                        if (existingPerson) {
                            existingPerson.name = newName;
                            existingPerson.relation = newRelation;
                            // Update the image if the person doesn't have one and we captured one
                            if (convoImageRef.current && (!existingPerson.faceImage || existingPerson.faceImage.includes('api.dicebear.com'))) {
                                existingPerson.faceImage = convoImageRef.current;
                            }
                            await updatePerson(existingPerson);
                            console.log(`[Database] Updated existing visitor ${newName}`);
                            extractedVisitor.id = existingPerson.id;
                        } else {
                            const newPersonId = generateId();
                            await addPerson({
                                id: newPersonId,
                                name: newName,
                                relation: newRelation,
                                faceImage: convoImageRef.current || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(newName)}`,
                                firstSeen: new Date(),
                                lastSeen: new Date(),
                                conversationContext: 'First meeting via conversation.'
                            });
                            extractedVisitor.id = newPersonId;
                            console.log(`[Database] Added new person ${newName}`);
                        }
                        setVisitorInfo(extractedVisitor);
                    } catch (e) {
                        console.error('[Database] Failed to save/update person:', e);
                    }
                }
            }

            if (summaryMatch) {
                const summary = summaryMatch[1].trim();
                setLastSummary(summary);
                onConversationUpdate(summary, extractedVisitor || undefined);
                
                // Save conversation to database
                if (convos.length > 0) {
                    try {
                        const participantList = [patientName];
                        if (extractedVisitor?.name) {
                            participantList.push(extractedVisitor.name);
                        } else if (visitorInfo?.name) {
                            participantList.push(visitorInfo.name);
                        }
                        
                        const convoToSave = {
                            id: convoIdRef.current || generateId(),
                            timestamp: new Date(),
                            participants: participantList,
                            summary: summary,
                            fullTranscript: convos,
                            convoImage: convoImageRef.current || undefined
                        };
                        
                        await updateConversation(convoToSave);
                        if (!convoIdRef.current) convoIdRef.current = convoToSave.id;

                        console.log('[Database] Saved/Updated conversation successfully.');
                    } catch (e) {
                        console.error('[Database] Failed to save conversation:', e);
                    }
                }
            }

            if (datesMatch) {
                const datesText = datesMatch[1].trim();
                console.log('[Date Extraction] Dates text:', datesText);
                if (datesText && !datesText.toLowerCase().includes('none')) {
                    // Split by newlines and only process lines with the pipe delimiter
                    const dateLines = datesText.split(/\n/).filter((l: string) => l.trim() && l.includes('|'));
                    console.log('[Date Extraction] Found structured date lines:', dateLines);
                    dateLines.forEach(async (dateLine: string) => {
                        const parts = dateLine.split('|').map(p => p.trim());
                        if (parts.length >= 3) {
                            const title = parts[0].replace(/^-\s*|^[📅✅]\s*/, '').trim();
                            const description = parts[1];
                            const dateStr = parts[2];
                            const timeStr = parts[3] || 'None';
                            
                            const hasExactTime = timeStr.toLowerCase() !== 'none';
                            
                            // Parse base date
                            const parsedDate = parseDateFromText(`${dateStr} ${hasExactTime ? timeStr : ''}`);
                            
                            // Carefully parse time if provided
                            if (hasExactTime) {
                                const timeMatch = timeStr.match(/(\d+)(?::(\d+))?\s*(AM|PM|am|pm)?/);
                                if (timeMatch) {
                                    let hours = parseInt(timeMatch[1]);
                                    const mins = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
                                    const ampm = timeMatch[3]?.toLowerCase();
                                    if (ampm === 'pm' && hours < 12) hours += 12;
                                    if (ampm === 'am' && hours === 12) hours = 0;
                                    parsedDate.setHours(hours, mins, 0, 0);
                                }
                            }

                            // Notify App.tsx so the task appears in the UI immediately
                            onDateDetected(`📅 ${title} on ${dateStr}`);
                            
                            // Save to IndexedDB
                            try {
                                await addDate({
                                    id: generateId(),
                                    date: parsedDate.toISOString(),
                                    event: title,
                                    description: description,
                                    hasExactTime: hasExactTime,
                                    type: 'appointment',
                                    createdAt: parsedDate
                                });
                                console.log('[Date Extraction] ✅ Date saved for:', parsedDate.toISOString());
                            } catch (error) {
                                console.error('[Date Extraction] ❌ Error saving date:', error);
                            }
                        }
                    });
                }
            }

            if (actionsMatch) {
                const actionsText = actionsMatch[1].trim();
                if (actionsText && !actionsText.toLowerCase().includes('none')) {
                    // Split by newlines OR commas
                    const actionLines = actionsText.split(/\n|,/).filter((l: string) => l.trim());
                    actionLines.forEach(async (actionLine: string) => {
                        const cleanedAction = actionLine.replace(/^-\s*|^[📅✅]\s*/, '').trim();
                        const parsedDate = parseDateFromText(cleanedAction);
                        // Notify App.tsx so the action appears in the UI immediately
                        onDateDetected(`✅ ${cleanedAction}`);
                        // Save to IndexedDB with the parsed date
                        try {
                            await addDate({
                                id: generateId(),
                                date: parsedDate.toISOString(),
                                event: cleanedAction,
                                type: 'reminder',
                                createdAt: parsedDate
                            });
                            console.log('[Action Extraction] ✅ Action saved:', cleanedAction);
                        } catch (error) {
                            console.error('[Action Extraction] ❌ Error saving action:', error);
                        }
                    });
                }
            }

            // Handle transcript correction
            const transcriptMatch = response.match(/TRANSCRIPT:\s*(.+)$/s);
            if (transcriptMatch) {
                const transcriptLines = transcriptMatch[1].trim().split('\n');
                setConversations(prev => {
                    const next = [...prev];
                    transcriptLines.forEach((line: string, idx: number) => {
                        if (idx < next.length) {
                            const match = line.match(/^(.+?):\s*"(.*)"$/);
                            if (match) {
                                // Strictly enforce User/Visitor mapping
                                const rawSpeaker = match[1].trim().toLowerCase();
                                next[idx].speaker = (rawSpeaker === 'user' || rawSpeaker === patientName.toLowerCase() || rawSpeaker === 'you') ? 'User' : 'Visitor';
                                next[idx].text = match[2].trim();
                            }
                        }
                    });
                    return next;
                });
            }
        } catch (error) {
            console.error('Conversation analysis error:', error);
        }
        setIsProcessing(false);
    }, [primaryModel, backupModel, isProcessing, onConversationUpdate, onDateDetected, patientName, visitorInfo]);

    // Handle speech result — Pure Rotation Speaker Assignment
    // Each speech utterance alternates: User → Visitor → User → Visitor
    // Manual toggle buttons override the automatic rotation.
    const handleSpeechResult = useCallback((transcript: string) => {
        if (!transcript.trim()) return;

        const now = Date.now();
        lastSpeechTimeRef.current = now;

        // ──────────────────────────────────────────────────
        // SPEAKER DETERMINATION (Pure Rotation)
        // ──────────────────────────────────────────────────
        let speakerName: string;

        if (isManualSwitchRef.current) {
            // Manual override: use whatever the user selected
            speakerName = currentSpeakerRef.current === 'Visitor' ? 'Visitor' : 'User';
        } else {
            // Alternate automatically: User → Visitor → User → Visitor
            const nextSpeaker = lastAutoSpeakerRef.current === 'User' ? 'Visitor' : 'User';
            speakerName = nextSpeaker;
            lastAutoSpeakerRef.current = nextSpeaker;
        }

        // Update speaker UI state
        updateSpeaker(speakerName === 'User' ? 'You' : 'Visitor');

        console.log(`[Speaker] Attributed "${transcript.substring(0, 30)}..." to: ${speakerName}`);

        const newEntry: ConversationEntry = {
            speaker: speakerName,
            text: transcript,
            timestamp: new Date()
        };

        setConversations(prev => {
            const updated = [...prev, newEntry];
            
            // Capture image and init convo ID if it's the first entry
            if (updated.length === 1) {
                if (captureScreenshot && !convoImageRef.current) {
                    convoImageRef.current = captureScreenshot();
                }
                if (!convoIdRef.current) {
                    convoIdRef.current = generateId();
                }
            }

            return updated;
        });

        // Real-time Task Extraction — Multi-pattern approach for natural speech
        const foundTasks: string[] = [];
        const segments = transcript.split(/\b(?:and|then|also)\b/i);

        // Month names for matching
        const monthNames = '(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)';
        // Relative time terms (no months — handled separately)
        const relativeTerms = '(?:tomorrow|tonight|today|next\\s+(?:week|month)|monday|tuesday|wednesday|thursday|friday|saturday|sunday)';
        // Full date pattern: captures "13th July", "July 13th", "13th of July", or just "tomorrow"/"Monday"/month name
        const fullDatePattern = `(?:(?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+|on\\s+)?)?${monthNames}(?:\\s+\\d{1,2}(?:st|nd|rd|th)?)?|${relativeTerms})`;

        segments.forEach(segment => {
            const cleanSegment = segment.trim();
            if (!cleanSegment) return;

            let match;

            // Pattern 0: Direct "day month" or "month day" extraction (highest priority)
            // Catches "13th July", "July 13th", "13th of July", "23rd on July" anywhere in text
            const directDateRegex = new RegExp(
                `\\b(\\d{1,2}(?:st|nd|rd|th)?)\\s+(?:of\\s+|on\\s+|in\\s+)?(${monthNames})\\b` + '|' +
                `\\b(${monthNames})\\s+(?:the\\s+)?(\\d{1,2}(?:st|nd|rd|th)?)\\b`,
                'gi'
            );
            while ((match = directDateRegex.exec(cleanSegment)) !== null) {
                // match[1]+match[2] = "13th July" form, match[3]+match[4] = "July 13th" form
                const day = match[1] || match[4];
                const month = match[2] || match[3];
                if (!day || !month) continue;

                const dateStr = `${month} ${day}`;
                // Skip if already captured
                if (foundTasks.some(t => t.toLowerCase().includes(day.toLowerCase()) && t.toLowerCase().includes(month.toLowerCase()))) continue;

                // Grab context around the date for the task name
                const fullMatch = match[0];
                const idx = match.index;
                const prefix = cleanSegment.substring(Math.max(0, idx - 50), idx).trim();
                const suffix = cleanSegment.substring(idx + fullMatch.length, Math.min(cleanSegment.length, idx + fullMatch.length + 50)).trim();

                // Clean up prefix: remove trailing prepositions
                const cleanPrefix = prefix.replace(/\b(?:on|at|by|for|this|the)\s*$/i, '').trim();
                // Clean up suffix: remove leading prepositions
                const cleanSuffix = suffix.replace(/^\s*(?:on|at|by|for|this|the)\b/i, '').trim();

                const contextWords = (cleanPrefix + ' ' + cleanSuffix).split(/\s+/);
                const context = contextWords.slice(0, 5).join(' ');
                
                const cleanedContext = cleanTaskName(context);

                if (cleanedContext.length > 3) {
                    foundTasks.push(`📅 ${cleanedContext} on ${dateStr}`);
                } else {
                    foundTasks.push(`📅 Event on ${dateStr}`);
                }
            }

            // Pattern 1: "<task> on/at/by/for <relative date>" — "meeting on Friday", "appointment at tomorrow"
            const dateRegex1 = new RegExp(`\\b([a-zA-Z\\s]{3,30})\\s+(on|at|by|for|this)\\s+(${relativeTerms})`, 'gi');
            while ((match = dateRegex1.exec(cleanSegment)) !== null) {
                const taskName = match[1].trim();
                const timeInfo = match[3].trim();
                const cleanedTask = cleanTaskName(taskName);
                if (cleanedTask.length > 2 && !['what', 'when', 'how', 'going', 'the', 'that', 'this', 'its', 'it'].includes(cleanedTask.toLowerCase())) {
                    const task = `📅 ${cleanedTask} on ${timeInfo}`;
                    if (!foundTasks.some(t => t.toLowerCase().includes(timeInfo.toLowerCase()))) {
                        foundTasks.push(task);
                    }
                }
            }

            // Pattern 2: "<relative date> <task>" — "tomorrow I have a doctor", "Friday meeting"
            const dateRegex2 = new RegExp(`\\b(${relativeTerms})\\s+(?:I\\s+(?:have|need|got)\\s+(?:a\\s+|an\\s+|the\\s+)?)?([a-zA-Z\\s]{3,30})`, 'gi');
            while ((match = dateRegex2.exec(cleanSegment)) !== null) {
                const timeInfo = match[1].trim();
                const taskName = match[2].trim();
                const cleanedTask = cleanTaskName(taskName);
                if (cleanedTask.length > 2 && !['what', 'when', 'how', 'going', 'the', 'that', 'this', 'its', 'it', 'is', 'we', 'and'].includes(cleanedTask.toLowerCase())) {
                    const task = `📅 ${cleanedTask} on ${timeInfo}`;
                    if (!foundTasks.some(t => t.toLowerCase().includes(timeInfo.toLowerCase()))) {
                        foundTasks.push(task);
                    }
                }
            }

            // Pattern 3: Standalone relative date mentions with surrounding context
            const dateRegex3 = new RegExp(`\\b(${relativeTerms})\\b`, 'gi');
            while ((match = dateRegex3.exec(cleanSegment)) !== null) {
                const dateStr = match[1].trim();
                if (foundTasks.some(t => t.toLowerCase().includes(dateStr.toLowerCase()))) continue;

                const idx = match.index;
                const prefix = cleanSegment.substring(Math.max(0, idx - 40), idx).trim();
                const suffix = cleanSegment.substring(idx + dateStr.length, Math.min(cleanSegment.length, idx + dateStr.length + 40)).trim();
                const contextWords = (prefix + ' ' + suffix).split(/\s+/);
                const context = contextWords.slice(0, 4).join(' ');
                
                const cleanedContext = cleanTaskName(context);

                if (cleanedContext.length > 3) {
                    foundTasks.push(`📅 ${cleanedContext} on ${dateStr}`);
                } else {
                    foundTasks.push(`📅 Event on ${dateStr}`);
                }
            }

            // Pattern 4: Action items — "remember to...", "don't forget to...", "remind me to..."
            const actionRegex = /\b(?:remember to|don't forget to|remind me to|i need to|i have to|i must|i should)\s+([a-zA-Z\s]{3,40})/gi;
            while ((match = actionRegex.exec(cleanSegment)) !== null) {
                foundTasks.push(`✅ ${match[1].trim()}`);
            }
        });

        console.log('[Real-time Extraction] Found tasks:', foundTasks);

        foundTasks.forEach(async (task) => {
            onDateDetected(task);
            
            const type = task.includes('📅') ? 'appointment' : 'reminder';
            const cleanEvent = task.replace(/^[📅✅]\s*/, '').trim();
            const parsedDate = parseDateFromText(cleanEvent);
            
            try {
                await addDate({
                    id: generateId(),
                    date: parsedDate.toISOString(),
                    event: cleanEvent,
                    type,
                    createdAt: new Date()
                });
                console.log('[Real-time Extraction] ✅ Date saved:', cleanEvent);
            } catch (err) {
                console.error('[Real-time Extraction] ❌ Error saving date:', err);
            }
        });
    }, []);  // Zero deps — all state accessed via refs and functional updates for stability

    // speechHandlerRef is assigned directly (not via useEffect) to avoid timing gaps
    const speechHandlerRef = useRef(handleSpeechResult);
    speechHandlerRef.current = handleSpeechResult;

    // Helper to initialize and start speech recognition on-demand
    const startSpeechRecognition = useCallback(() => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.error('Speech recognition not supported in this browser.');
            return;
        }

        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            let finalTranscript = '';
            let interim = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalTranscript += result[0].transcript;
                } else {
                    interim += result[0].transcript;
                }
            }

            if (finalTranscript.trim()) {
                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                    silenceTimerRef.current = null;
                }
                setInterimTranscript('');
                speechHandlerRef.current(finalTranscript.trim());
            }

            if (interim.trim()) {
                setInterimTranscript(interim);

                // Safety: if Chrome never finalizes, force-commit after 3s of silence
                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                }
                silenceTimerRef.current = window.setTimeout(() => {
                    if (interim.trim()) {
                        console.log('[Speech] Silence timeout — forcing commit');
                        speechHandlerRef.current(interim.trim());
                        setInterimTranscript('');
                    }
                }, 3000);
            } else if (!finalTranscript.trim()) {
                setInterimTranscript('');
            }
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'not-allowed') {
                setErrorMsg('Microphone access denied. Please check browser settings and permissions.');
            } else if (event.error === 'audio-capture') {
                setErrorMsg('No microphone found or it is in use by another application.');
            } else if (event.error === 'network') {
                // Network errors are extremely common in Chrome Web Speech API when connection drops momentarily.
                // We will log it and let onend auto-restart it, instead of showing a scary red error box.
                console.warn('Speech recognition network error. Auto-restarting silently...');
            } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
                setErrorMsg(`Speech recognition error: ${event.error}`);
            }

            // Only permanently stop listening for fatal hardware or permission errors
            if (event.error === 'not-allowed' || event.error === 'audio-capture') {
                if (recognitionRef.current === recognition) {
                    setIsListening(false);
                    isListeningRef.current = false;
                }
            }
        };

        recognition.onend = () => {
            setInterimTranscript('');
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
            }
            // Only restart if we are still supposed to be listening AND this is the active recognition instance
            if (isListeningRef.current && recognitionRef.current === recognition) {
                console.log('Recognition ended but should be listening, restarting in 300ms...');
                setTimeout(() => {
                    if (isListeningRef.current && recognitionRef.current === recognition) {
                        try {
                            recognition.start();
                            console.log('[Recording] Restarted session successfully');
                        } catch (e) {
                            console.error('Failed to restart recognition:', e);
                        }
                    }
                }, 300);
            }
        };

        recognitionRef.current = recognition;

        try {
            setErrorMsg(null);
            setInterimTranscript('');
            isListeningRef.current = true;
            recognition.start();
            setIsListening(true);
            console.log('[Recording] Started new session');
        } catch (e) {
            console.error('Failed to start recognition:', e);
            setIsListening(false);
            isListeningRef.current = false;
            recognitionRef.current = null;
        }
    }, []);

    // Cleanup SpeechRecognition on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
            }
        };
    }, []);

    // Toggle listening
    const toggleListening = useCallback(() => {
        if (isListening) {
            // CRITICAL: Set the ref to false BEFORE calling .stop()
            // so the onend handler does NOT auto-restart recognition.
            isListeningRef.current = false;
            recognitionRef.current?.stop();
            setIsListening(false);
            setInterimTranscript('');

            // When stopping, save the conversation for recall
            if (conversations.length > 0) {
                // Create a simple summary from conversation if Gemini hasn't analyzed yet
                const conversationText = conversations
                    .map(c => `${c.speaker}: "${c.text}"`)
                    .join(' | ');

                // Improved date extraction with context
                const fullText = conversations.map(c => c.text).join(' ');
                const datePatterns = [
                    /\b(on|at|by|until|during)\s+([a-zA-Z0-9\s]+)?\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(st|nd|rd|th)?\b/gi,
                    /\b(on|at|by|until|during)\s+([a-zA-Z0-9\s]+)?\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}(st|nd|rd|th)?\b/gi,
                    /\b(on|at|by|until|during)\s+([a-zA-Z0-9\s]+)?\b\d{1,2}(st|nd|rd|th)?\s+(of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi,
                    /\b(on|at|by|until|during)\s+([a-zA-Z0-9\s]+)?\b(tomorrow|next\s+week|next\s+month|today|tonight)\b/gi,
                    /\b(on|at|by|until|during)\s+([a-zA-Z0-9\s]+)?\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi
                ];

                const foundTasks: string[] = [];

                // Pre-process: split by common conjunctions to handle "Doc on Friday and Lunch on Monday"
                const segments = fullText.split(/\b(?:and|then|also)\b/i);

                segments.forEach(segment => {
                    const cleanSegment = segment.trim();
                    if (!cleanSegment) return;

                    // Improved non-greedy regex for dates
                    const timeTerms = '(?:tomorrow|tonight|today|next\\s+(?:week|month)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)';
                    const dateRegex = new RegExp(`\\b([a-zA-Z\\s]{3,30})\\s+(on|at|by|for|this)\\s+(${timeTerms}(?:\\s+\\d{1,2}(?:st|nd|rd|th)?)?)`, 'gi');

                    let match;
                    while ((match = dateRegex.exec(cleanSegment)) !== null) {
                        const taskName = match[1].trim();
                        const timeInfo = match[3].trim();
                        if (taskName.length > 2 && !['what', 'when', 'how', 'going'].includes(taskName.toLowerCase())) {
                            const task = `📅 ${taskName} on ${timeInfo}`;
                            if (!foundTasks.includes(task)) foundTasks.push(task);
                        }
                    }

                    // Action items: "remind me to..."
                    const actionRegex = /\b(?:remember to|don't forget to|remind me to)\s+([a-zA-Z\s]{3,40})/gi;
                    while ((match = actionRegex.exec(cleanSegment)) !== null) {
                        const task = `✅ ${match[1].trim()}`;
                        if (!foundTasks.includes(task)) foundTasks.push(task);
                    }
                });

                // Fallback for isolated simple dates
                const simpleDatePatterns = [
                    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(st|nd|rd|th)?\b/gi,
                    /\b(tomorrow|tonight|today|next\s+(?:week|month))\b/gi,
                    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi
                ];

                simpleDatePatterns.forEach(pattern => {
                    let match;
                    while ((match = pattern.exec(fullText)) !== null) {
                        const dateStr = match[0];
                        // Avoid duplicates if already caught
                        if (foundTasks.some(t => t.toLowerCase().includes(dateStr.toLowerCase()))) continue;

                        const index = match.index;
                        const prefix = fullText.substring(Math.max(0, index - 30), index).trim();
                        const words = prefix.split(' ').filter(w => w.length > 2);
                        const context = words.slice(-3).join(' ');

                        const task = context.length > 3 ? `📅 ${context} on ${dateStr}` : `📅 Action on ${dateStr}`;
                        if (!foundTasks.includes(task)) foundTasks.push(task);
                    }
                });

                // Add detected tasks to memory log
                foundTasks.forEach(async (task) => {
                    onDateDetected(task);

                    const type = task.includes('📅') ? 'appointment' : 'reminder';
                    const cleanEvent = task.replace(/^[📅✅]\s*/, '').trim();
                    const parsedDate = parseDateFromText(cleanEvent);

                    try {
                        await addDate({
                            id: generateId(),
                            date: parsedDate.toISOString(),
                            event: cleanEvent,
                            type,
                            createdAt: new Date()
                        });
                        console.log('[Stop Recording Extraction] ✅ Date saved:', cleanEvent);
                    } catch (err) {
                        console.error('[Stop Recording Extraction] ❌ Error saving date:', err);
                    }
                });

                // If we have a Gemini-generated summary, use that; otherwise create a basic one
                const summaryToSave = lastSummary || `Conversation recorded: ${conversationText.substring(0, 200)}${conversationText.length > 200 ? '...' : ''}`;

                // Trigger the callback with whatever we have
                if (!lastSummary) {
                    onConversationUpdate(summaryToSave, visitorInfo || undefined);
                }

                // Also trigger Gemini analysis if available for better extraction
                if (primaryModel && !lastSummary) {
                    analyzeConversation(conversations);
                }
            }
        } else {
            // New conversation starting - Clear old state
            setConversations([]);
            setLastSummary('');
            setVisitorInfo(null);
            setIsProcessing(false); // Reset processing flag from any previous session
            isManualSwitchRef.current = false;
            lastAutoSpeakerRef.current = 'Visitor'; // Reset so first utterance goes to User
            convoIdRef.current = null; // Reset conversation ID so a new one is generated
            convoImageRef.current = null; // Reset image so a new one is captured
            setCurrentSpeaker('You');
            setErrorMsg(null);
            setInterimTranscript('');

            // Small delay to let the browser fully release any previous SpeechRecognition session.
            setTimeout(() => {
                startSpeechRecognition();
            }, 300);
        }
    }, [isListening, conversations, lastSummary, visitorInfo, primaryModel, backupModel, onConversationUpdate, onDateDetected, analyzeConversation, startSpeechRecognition]);

    // Manual speaker switch
    const switchSpeaker = (speaker: 'You' | 'Visitor') => {
        updateSpeaker(speaker, true);
    };

    // Clear conversation
    const clearConversation = () => {
        setConversations([]);
        setLastSummary('');
    };

    return (
        <div className="card card-enhanced">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div style={{
                        background: isListening
                            ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                            : 'linear-gradient(135deg, #10b981, #059669)',
                        padding: '0.5rem',
                        borderRadius: '0.75rem'
                    }}>
                        {isListening ? <Mic size={20} color="white" /> : <MicOff size={20} color="white" />}
                    </div>
                    <div>
                        <h3 className="font-bold text-sm">Conversation Recorder</h3>
                        <p className="text-xs text-dim">
                            {isListening ? `Listening • ${currentSpeaker === 'Visitor' && visitorInfo?.name ? visitorInfo.name : currentSpeaker}` : 'Tap to start recording'}
                        </p>
                    </div>
                </div>
                <div className="relative group">
                    {/* Ripple animation when recording */}
                    {isListening && (
                        <>
                            <motion.div
                                animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                                style={{ background: 'rgba(168, 85, 247, 0.4)' }}
                                className="absolute inset-0 rounded-xl -z-10"
                            />
                            <motion.div
                                animate={{ scale: [1, 1.2], opacity: [0.5, 0] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                                style={{ background: 'rgba(168, 85, 247, 0.3)' }}
                                className="absolute inset-0 rounded-xl -z-10"
                            />
                        </>
                    )}

                    <button
                        onClick={toggleListening}
                        className="px-8 py-4 rounded-xl text-sm font-bold transition-all flex items-center gap-3 shadow-xl relative overflow-hidden text-white hover:scale-105 border border-white/20"
                        style={{
                            background: isListening
                                ? 'linear-gradient(135deg, #ef4444 0%, #be123c 100%)' // Red gradient for Stop
                                : 'linear-gradient(135deg, #4c1d95 0%, #d946ef 100%)', // Deep Violet to Fuchsia for Start
                            boxShadow: isListening
                                ? '0 0 25px rgba(239, 68, 68, 0.6), inset 0 2px 0 rgba(255,255,255,0.2)'
                                : '0 8px 25px rgba(124, 58, 237, 0.5), inset 0 2px 0 rgba(255,255,255,0.2)'
                        }}
                    >
                        {/* Shimmer effect */}
                        {!isListening && (
                            <motion.div
                                initial={{ x: '-100%' }}
                                whileHover={{ x: '200%' }}
                                transition={{ duration: 0.6, ease: "easeInOut" }}
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
                            />
                        )}

                        <div className={`w-3 h-3 rounded-full transition-all duration-300 shadow-sm ${isListening ? 'bg-white animate-pulse' : 'bg-red-500 group-hover:scale-125'}`} />
                        <span className="tracking-wide uppercase font-extrabold" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                            {isListening ? 'STOP RECORDING' : 'START RECORDING'}
                        </span>
                    </button>
                </div>
            </div>

            {/* Active indicator */}
            <AnimatePresence>
                {isListening && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-4"
                    >
                        <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                            <div className="flex items-center justify-between text-xs font-medium text-dim">
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                    Recording Active
                                </span>
                                <span className="uppercase tracking-wider text-[10px] opacity-70">Tap listener</span>
                            </div>

                            <div className="flex bg-black/40 rounded-lg p-1 gap-1 relative">
                                <button
                                    onClick={() => switchSpeaker('You')}
                                    className={`flex-1 py-1.5 flex justify-center items-center gap-1.5 rounded text-xs font-semibold transition-all ${currentSpeaker === 'You' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.2)]' : 'text-gray-400 hover:bg-white/5 border border-transparent'}`}
                                >
                                    <UserCircle2 size={14} className={currentSpeaker === 'You' ? 'opacity-100' : 'opacity-50'} />
                                    User {isManualSwitchRef.current && currentSpeaker === 'You' && <span className="text-[10px] ml-1 bg-white/20 px-1 rounded">Locked</span>}
                                </button>
                                <button
                                    onClick={() => switchSpeaker('Visitor')}
                                    className={`flex-1 py-1.5 flex justify-center items-center gap-1.5 rounded text-xs font-semibold transition-all ${currentSpeaker === 'Visitor' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'text-gray-400 hover:bg-white/5 border border-transparent'}`}
                                >
                                    <Users size={14} className={currentSpeaker === 'Visitor' ? 'opacity-100' : 'opacity-50'} />
                                    Visitor {isManualSwitchRef.current && currentSpeaker === 'Visitor' && <span className="text-[10px] ml-1 bg-white/20 px-1 rounded">Locked</span>}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Error Message */}
            {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 mb-3 flex items-center gap-2">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    <span>{errorMsg}</span>
                </div>
            )}

            {/* Interim Transcript */}
            {isListening && interimTranscript && (
                <div className="text-xs p-2.5 rounded-xl bg-indigo-500/5 border border-indigo-500/10 italic text-gray-300 animate-pulse mb-3">
                    <span className="font-semibold text-indigo-400 not-italic mr-1.5">Listening:</span>"{interimTranscript}"
                </div>
            )}

            {/* Conversation log */}
            {conversations.length > 0 && (
                <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                    {conversations.slice(-5).map((entry, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`text-xs p-2 rounded border ${(entry.speaker === 'User' || entry.speaker === 'You' || entry.speaker === patientName)
                                ? 'bg-indigo-500/10 border-indigo-500/30'
                                : 'bg-emerald-500/10 border-emerald-500/30'
                                }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <Users size={10} />
                                <span className="font-bold">{entry.speaker}</span>
                                <span className="text-dim">
                                    {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <p className="text-dim">"{entry.text}"</p>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Summary */}
            {lastSummary && (
                <div className="p-2 rounded bg-purple-500/10 border border-purple-500/30 mb-3">
                    <div className="flex items-center gap-2 mb-1">
                        <MessageSquare size={12} className="text-purple-400" />
                        <span className="text-xs font-bold text-purple-400">AI Summary</span>
                    </div>
                    <p className="text-xs text-dim">{lastSummary}</p>
                </div>
            )}

            {/* Actions */}
            {conversations.length > 0 && (
                <div className="flex gap-2">
                    <button
                        onClick={() => analyzeConversation(conversations)}
                        disabled={isProcessing}
                        className="flex-1 text-xs py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        style={{
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                            boxShadow: '0 2px 10px rgba(99, 102, 241, 0.2)',
                            color: 'white'
                        }}
                    >
                        {isProcessing ? (
                            <>
                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Analyzing...
                            </>
                        ) : (
                            <>
                                <MessageSquare size={14} />
                                Analyze Conservation
                            </>
                        )}
                    </button>
                    <button
                        onClick={clearConversation}
                        className="text-xs py-2 px-4 rounded-lg font-medium transition-all flex items-center gap-2 text-gray-300 hover:text-white"
                        style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                            e.currentTarget.style.color = '#fca5a5';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                            e.currentTarget.style.color = '#d1d5db';
                        }}
                    >
                        <Trash2 size={14} />
                        Clear
                    </button>
                </div>
            )}

            {/* No speech API warning */}
            {!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window) && (
                <p className="text-xs text-red-400 mt-2">
                    ⚠️ Speech recognition not supported in this browser. Use Chrome for best results.
                </p>
            )}
        </div>
    );
}
