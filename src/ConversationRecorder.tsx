import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, MessageSquare, Calendar, Users, Trash2 } from 'lucide-react';
import { addDate, generateId } from './memoryDatabase';

// Helper function to parse dates from text like "Feb 16", "tomorrow", "next Monday"
function parseDateFromText(text: string): Date {
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

    // Check for relative dates
    if (lower.includes('today')) return now;
    if (lower.includes('tomorrow')) {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        return d;
    }
    if (lower.includes('day after tomorrow')) {
        const d = new Date(now);
        d.setDate(d.getDate() + 2);
        return d;
    }
    if (lower.includes('next week')) {
        const d = new Date(now);
        d.setDate(d.getDate() + 7);
        return d;
    }
    if (lower.includes('next month')) {
        const d = new Date(now);
        d.setMonth(d.getMonth() + 1);
        return d;
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

    // Try to parse "Month Day" format (e.g., "Feb 16", "February 16th")
    const monthDayMatch = text.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{1,2})(?:st|nd|rd|th)?\b/i);
    if (monthDayMatch) {
        const monthStr = monthDayMatch[1].toLowerCase().substring(0, 3);
        const day = parseInt(monthDayMatch[2]);
        const month = months[monthStr];
        if (month !== undefined && day >= 1 && day <= 31) {
            // Use current year, or next year if the date has passed
            let year = currentYear;
            const targetDate = new Date(year, month, day);
            if (targetDate < now) {
                year++;
            }
            return new Date(year, month, day);
        }
    }

    // Try to parse "Day Month" format (e.g., "16 Feb", "16th February")
    const dayMonthMatch = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i);
    if (dayMonthMatch) {
        const day = parseInt(dayMonthMatch[1]);
        const monthStr = dayMonthMatch[2].toLowerCase().substring(0, 3);
        const month = months[monthStr];
        if (month !== undefined && day >= 1 && day <= 31) {
            let year = currentYear;
            const targetDate = new Date(year, month, day);
            if (targetDate < now) {
                year++;
            }
            return new Date(year, month, day);
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

    return `
VISITOR: ${visitorName}, ${visitorRelation}
SUMMARY: You had a conversation with ${visitorName}. You discussed ${mockDate !== 'None' ? 'dates: ' + mockDate : 'various topics'}.
DATES: ${mockDate}
ACTIONS: ${mockAction}
`;
};

interface ConversationRecorderProps {
    onDateDetected: (event: string) => void;
    onConversationUpdate: (summary: string, visitorInfo?: { name: string; relation: string }) => void;
    primaryModel: any;
    backupModel: any;
    identifiedPerson: { name: string; relation: string } | null;
    patientName?: string; // The Alzheimer's patient (Person A)
}

export default function ConversationRecorder({
    onDateDetected,
    onConversationUpdate,
    primaryModel,
    backupModel,
    identifiedPerson,
    patientName = 'User'
}: ConversationRecorderProps) {
    const [isListening, setIsListening] = useState(false);
    const [conversations, setConversations] = useState<ConversationEntry[]>([]);
    const [currentSpeaker, setCurrentSpeaker] = useState<'You' | 'Visitor'>('You');
    const [lastSummary, setLastSummary] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [visitorInfo, setVisitorInfo] = useState<{ name: string; relation: string } | null>(null);

    const recognitionRef = useRef<any>(null);
    const silenceTimerRef = useRef<number | null>(null);
    const lastSpeechTimeRef = useRef<number>(Date.now());
    const lastIdentifiedPersonRef = useRef<string | null>(null);
    const primarySpeakerRef = useRef<string | null>(null); // User baseline
    const lastSpeakerChangeTimeRef = useRef<number>(Date.now());
    const isManualSwitchRef = useRef<boolean>(false);
    const currentSpeakerRef = useRef<'You' | 'Visitor'>(currentSpeaker);

    // Sync ref with state
    useEffect(() => {
        currentSpeakerRef.current = currentSpeaker;
    }, [currentSpeaker]);

    // Enhanced speaker switch that handles both state and ref
    const updateSpeaker = useCallback((newSpeaker: 'You' | 'Visitor', manual = false) => {
        if (currentSpeakerRef.current === newSpeaker && !manual) return;

        setCurrentSpeaker(newSpeaker);
        currentSpeakerRef.current = newSpeaker;
        lastSpeakerChangeTimeRef.current = Date.now();
        if (manual) isManualSwitchRef.current = true;
        console.log(`[Speaker] Switch to ${newSpeaker} (${manual ? 'Manual' : 'Auto'})`);
    }, []);

    // Track identified person changes for speaker switching
    useEffect(() => {
        if (!identifiedPerson || !isListening) return;

        const currentName = identifiedPerson.name;
        const now = Date.now();
        const timeSinceChange = now - lastSpeakerChangeTimeRef.current;

        // Set primary speaker (User) on first identification
        if (!primarySpeakerRef.current) {
            primarySpeakerRef.current = currentName;
            updateSpeaker('You');
            console.log(`[Speaker] Primary speaker (you) set: ${currentName}`);
            return;
        }

        // 1. Switch to Visitor if a DIFFERENT person is explicitly identified
        if (currentName !== primarySpeakerRef.current && currentSpeakerRef.current === 'You') {
            updateSpeaker('Visitor');
            setVisitorInfo({
                name: identifiedPerson.name,
                relation: identifiedPerson.relation
            });
            isManualSwitchRef.current = false;
        }
        // 2. Switch back to "You" only if User is seen AND we haven't just switched/locked to Visitor
        else if (currentName === primarySpeakerRef.current && currentSpeakerRef.current === 'Visitor') {
            if (!isManualSwitchRef.current && timeSinceChange > 15000) {
                updateSpeaker('You');
            }
        }

        lastIdentifiedPersonRef.current = currentName;
    }, [identifiedPerson, isListening, currentSpeaker]);

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
- "You" = ${patientName} (the Alzheimer's patient)
- "Visitor" = ${visitorName} (${visitorRelation})

Conversation:
${conversationText}

Provide a gentle, caring summary for ${patientName} explaining:
1. WHO they were talking to (use the visitor's name and relationship if known)
2. WHAT they discussed (key topics in simple terms)
3. Any IMPORTANT things to remember (dates, promises, tasks)

Also, double check if the "You" and "Visitor" speakers are logically correct. For example, if someone says "Hi User", they must be the Visitor. If there are mistakes, fix them in the transcript.

Respond in this exact format:
VISITOR: [visitor's name and their relationship to ${patientName}, or "Unknown visitor" if not clear]
SUMMARY: [A warm, simple 1-2 sentence summary written as if speaking directly to ${patientName}]
DATES: [Any dates, appointments, or deadlines mentioned, or "None"]
ACTIONS: [Any promises made or tasks to do, or "None"]
TRANSCRIPT:
[Speaker]: "Corrected text"
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
                    extractedVisitor = {
                        name: visitorText.split(',')[0].trim(),
                        relation: visitorText.includes(',') ? visitorText.split(',')[1].trim() : 'visitor'
                    };
                    setVisitorInfo(extractedVisitor);
                }
            }

            if (summaryMatch) {
                const summary = summaryMatch[1].trim();
                setLastSummary(summary);
                onConversationUpdate(summary, extractedVisitor || undefined);
            }

            if (datesMatch) {
                const datesText = datesMatch[1].trim();
                console.log('[Date Extraction] Dates text:', datesText);
                if (datesText && !datesText.toLowerCase().includes('none')) {
                    // Split by newlines OR commas to catch various formatting
                    const dateLines = datesText.split(/\n|,/).filter((l: string) => l.trim());
                    console.log('[Date Extraction] Found date lines:', dateLines);
                    dateLines.forEach(async (dateLine: string) => {
                        const cleanedDate = dateLine.replace(/^-\s*|^[📅✅]\s*/, '').trim();
                        console.log('[Date Extraction] Processing:', cleanedDate);

                        // Parse the actual date from the text
                        const parsedDate = parseDateFromText(cleanedDate);
                        console.log('[Date Extraction] Parsed date:', parsedDate);

                        // onDateDetected(`📅 ${cleanedDate}`);
                        // Save to IndexedDB with the ACTUAL event date
                        try {
                            await addDate({
                                id: generateId(),
                                date: parsedDate.toISOString(), // Use ISO string for reliability
                                event: cleanedDate,
                                type: 'appointment',
                                createdAt: parsedDate // Store the actual event date here!
                            });
                            console.log('[Date Extraction] ✅ Date saved for:', parsedDate.toISOString());
                        } catch (error) {
                            console.error('[Date Extraction] ❌ Error saving date:', error);
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
                        // onDateDetected(`✅ ${cleanedAction}`);
                        // Save to IndexedDB with the parsed date
                        await addDate({
                            id: generateId(),
                            date: parsedDate.toISOString(), // Use ISO string for reliability
                            event: cleanedAction,
                            type: 'reminder',
                            createdAt: parsedDate
                        });
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
                                next[idx].speaker = match[1].trim();
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

    // Handle speech result
    const handleSpeechResult = useCallback((transcript: string) => {
        if (!transcript.trim()) return;

        const now = Date.now();
        const timeSinceLastSpeech = now - lastSpeechTimeRef.current;

        // Asymmetric Turn-Taking Heuristic:
        // You -> Visitor: 1.2s (Quickly detect someone else starting)
        // Visitor -> You: 4.0s (Very patient)
        const pauseThreshold = currentSpeakerRef.current === 'You' ? 1200 : 4000;

        if (timeSinceLastSpeech > pauseThreshold && conversations.length > 0) {
            const nextSpeaker = currentSpeakerRef.current === 'You' ? 'Visitor' : 'You';
            updateSpeaker(nextSpeaker);
            isManualSwitchRef.current = false; // Turn-taking resets manual lock
        }
        lastSpeechTimeRef.current = now;

        // Determining the current speaker name
        let speakerName: string = currentSpeakerRef.current;

        // If face recognition explicitly sees someone ELSE, use their name
        if (identifiedPerson && identifiedPerson.name !== primarySpeakerRef.current) {
            speakerName = identifiedPerson.name;
        }
        // If we're in Visitor mode and we know the visitor's name (from conversation or face), use it
        else if (currentSpeakerRef.current === 'Visitor') {
            // Use visitorInfo.name if available (extracted from conversation or face)
            const visitorName = visitorInfo?.name;
            if (visitorName && visitorName !== 'the visitor') {
                speakerName = visitorName;
            } else {
                speakerName = 'Visitor';
            }
        }
        // If face recognition sees the User (User), and we are in 'You' mode
        else if (currentSpeaker === 'You' && identifiedPerson?.name === primarySpeakerRef.current) {
            speakerName = 'You';
        }

        const newEntry: ConversationEntry = {
            speaker: speakerName,
            text: transcript,
            timestamp: new Date()
        };

        setConversations(prev => {
            const updated = [...prev, newEntry];
            // Analyze after every 3 entries
            if (updated.length % 3 === 0 || updated.length === 1) {
                analyzeConversation(updated);
            }
            return updated;
        });

        // Real-time Task Extraction
        const foundTasks: string[] = [];
        const segments = transcript.split(/\b(?:and|then|also)\b/i);

        segments.forEach(segment => {
            const cleanSegment = segment.trim();
            if (!cleanSegment) return;

            const timeTerms = '(?:tomorrow|tonight|today|next\\s+(?:week|month)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)';
            const dateRegex = new RegExp(`\\b([a-zA-Z\\s]{3,30})\\s+(on|at|by|for|this)\\s+(${timeTerms}(?:\\s+\\d{1,2}(?:st|nd|rd|th)?)?)`, 'gi');

            let match;
            while ((match = dateRegex.exec(cleanSegment)) !== null) {
                const taskName = match[1].trim();
                const timeInfo = match[3].trim();
                if (taskName.length > 2 && !['what', 'when', 'how', 'going'].includes(taskName.toLowerCase())) {
                    foundTasks.push(`📅 ${taskName} on ${timeInfo}`);
                }
            }

            const actionRegex = /\b(?:remember to|don't forget to|remind me to)\s+([a-zA-Z\s]{3,40})/gi;
            while ((match = actionRegex.exec(cleanSegment)) !== null) {
                foundTasks.push(`✅ ${match[1].trim()}`);
            }
        });

        foundTasks.forEach(task => onDateDetected(task));
    }, [currentSpeaker, conversations.length, identifiedPerson, analyzeConversation, onDateDetected]);

    // Handler ref to avoid stale listeners
    const speechHandlerRef = useRef(handleSpeechResult);
    useEffect(() => {
        speechHandlerRef.current = handleSpeechResult;
    }, [handleSpeechResult]);

    // Initialize Web Speech API
    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event: any) => {
                const current = event.resultIndex;
                const transcript = event.results[current][0].transcript;

                if (event.results[current].isFinal) {
                    speechHandlerRef.current(transcript);
                }
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
                if (event.error !== 'no-speech') {
                    // Update state if error occurs (ref will be updated by effect)
                    setIsListening(false);
                }
            };

            recognitionRef.current.onend = () => {
                if (isListeningRef.current) {
                    // Restart if still supposed to be listening
                    console.log('Recognition ended but should be listening, restarting...');
                    try {
                        recognitionRef.current.start();
                    } catch (e) {
                        console.log('Recognition restart failed');
                    }
                }
            };
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
            }
        };
    }, []); // Run once on mount

    // Toggle listening
    const toggleListening = useCallback(() => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);

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
                foundTasks.forEach(task => {
                    onDateDetected(task);
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

            try {
                recognitionRef.current?.start();
                setIsListening(true);
            } catch (e) {
                console.error('Failed to start recognition:', e);
            }
        }
    }, [isListening, conversations, lastSummary, visitorInfo, primaryModel, backupModel, onConversationUpdate, onDateDetected, analyzeConversation]);

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
                                    className={`flex-1 py-2.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-2 ${currentSpeaker === 'You'
                                        ? 'bg-indigo-600 text-white shadow-lg ring-1 ring-white/20'
                                        : 'text-dim hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    <Users size={14} className={currentSpeaker === 'You' ? 'opacity-100' : 'opacity-50'} />
                                    Me {isManualSwitchRef.current && currentSpeaker === 'You' && <span className="text-[10px] ml-1 bg-white/20 px-1 rounded">Locked</span>}
                                </button>
                                <button
                                    onClick={() => switchSpeaker('Visitor')}
                                    className={`flex-1 py-2.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-2 ${currentSpeaker === 'Visitor'
                                        ? 'bg-emerald-600 text-white shadow-lg ring-1 ring-white/20'
                                        : 'text-dim hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    <Users size={14} className={currentSpeaker === 'Visitor' ? 'opacity-100' : 'opacity-50'} />
                                    {visitorInfo?.name || 'Visitor'} {isManualSwitchRef.current && currentSpeaker === 'Visitor' && <span className="text-[10px] ml-1 bg-white/20 px-1 rounded">Locked</span>}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Conversation log */}
            {conversations.length > 0 && (
                <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                    {conversations.slice(-5).map((entry, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`text-xs p-2 rounded border ${(entry.speaker === 'You' || entry.speaker === patientName)
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
