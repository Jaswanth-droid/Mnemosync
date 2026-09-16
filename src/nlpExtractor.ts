import nlp from 'compromise';

export interface ExtractedTask {
    rawText: string;
    event: string;        // Clean event name (e.g. "Birthday", "Doctor Appointment")
    dateText: string;     // Extracted date string (e.g. "16th of Jan", "Tomorrow")
    parsedDate: Date;     // Computed JS Date
    type: 'date' | 'action';
    formattedEvent: string; // e.g. "Birthday on Jan 16"
}

// Month name mapping
const MONTHS_MAP: Record<string, number> = {
    'jan': 0, 'january': 0, 'feb': 1, 'february': 1, 'mar': 2, 'march': 2,
    'apr': 3, 'april': 3, 'may': 4, 'jun': 5, 'june': 5, 'jul': 6, 'july': 6,
    'aug': 7, 'august': 7, 'sep': 8, 'sept': 8, 'september': 8,
    'oct': 9, 'october': 9, 'nov': 10, 'november': 10, 'dec': 11, 'december': 11
};

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Clean leading conversational filler phrases, pronouns, verbs, questions, and dates
 * e.g. "Tomorrow Have" -> "Event"
 * "you here? actually" -> filtered / "Event"
 * "So actually tomorrow I have a hackathon which is 16th September" -> "Hackathon"
 * "I have a Birthday" -> "Birthday"
 * "We are going to a dinner" -> "Dinner"
 * "There is a meeting" -> "Meeting"
 */
/**
 * Clean leading conversational filler phrases, pronouns, verbs, questions, and dates
 * e.g. "Tomorrow Have" -> "Event"
 * "you here? actually" -> filtered / "Event"
 * "I'm here for my birthday, it is on 17th September." -> "Birthday"
 * "We will be having DJ party in our" -> "DJ Party"
 * "So actually tomorrow I have a hackathon which is 16th September" -> "Hackathon"
 * "I have a Birthday" -> "Birthday"
 * "We are going to a dinner" -> "Dinner"
 * "There is a meeting" -> "Meeting"
 */
export function cleanEventTitle(raw: string, speakerName?: string): string {
    if (!raw || !raw.trim()) return 'Event';
    let clean = raw.trim();

    // 1. Remove markdown, icons, emojis, bullets
    clean = clean.replace(/^[📅✅⏰•\-\*\s◆◇💡🔔📌🎯]+/, '');

    // 2. Reject questions or pure conversational statements outright
    if (/\?$/.test(clean) || /^(?:what|who|where|when|why|how)\s+(?:is|are|was|were|brings|did|do|can|could)\b/i.test(clean)) {
        return 'Event';
    }

    // 3. If title contains a separator like ' — ' or ' – ' or ' on ' or ' at '
    if (clean.includes(' — ')) {
        clean = clean.split(' — ')[0].trim();
    } else if (clean.includes(' – ')) {
        clean = clean.split(' – ')[0].trim();
    }

    // 4. Remove consequence and relative clause tails
    clean = clean.replace(/\s*,\s*(?:so|and\s+so|because|that's\s+why|which\s+is\s+why|since)\s+.*$/i, '');
    clean = clean.replace(/\s+(?:so|because)\s+(?:i|we|you)\s+.*$/i, '');
    clean = clean.replace(/\s+(?:which|that)\s+(?:is|was|will\s+be|falls\s+on|takes\s+place\s+on).*$/i, '');
    clean = clean.replace(/\s*,\s*(?:it\s+is|it's|which\s+is|that\s+is|falling\s+on|scheduled\s+for)\s+.*$/i, '');
    clean = clean.replace(/\s+(?:it\s+is|it's|which\s+is|that\s+is)\s+(?:on|for|at|scheduled|set|planned).*$/i, '');
    clean = clean.replace(/\s+(?:scheduled\s+for|set\s+for|planned\s+for).*$/i, '');

    // 5. List of conversational prefixes, copulas, possessives to strip
    const fillerPatterns = [
        /^(?:hi|hello|hey|good\s+morning|good\s+afternoon|good\s+evening)[\s,?.!-]+/i,
        /^(?:what|who|how|where|when|why)\s+(?:brings\s+you\s+here|is\s+your\s+name|are\s+you|did\s+you\s+say|is\s+this|is\s+that)\??[\s,.-]*/i,
        /^(?:so\s+)?(?:actually\s+)?(?:well\s+)?(?:by\s+the\s+way\s+)?(?:you\s+know\s+)?(?:i\s+think\s+)?/i,
        /^(?:tomorrow|today|tonight|yesterday|next\s+week|next\s+month)\s+(?:i|we|you)?\s*(?:have|has|had|is|are|got)?\s*/i,
        /^(?:i'm|i\s+am|i\s+was|i\s+will\s+be|we're|we\s+are|they're|they\s+are|he's|he\s+is|she's|she\s+is)\s+(?:here\s+for|here\s+to|coming\s+for|coming\s+to|going\s+to|having|planning\s+for|planning\s+to|attending|celebrating|doing|organizing|holding|joining|visiting\s+for|visiting)?\s*(?:a|an|the|my|our|his|her|their)?\s*/i,
        /^(?:am|im|i'm)\s+(?:here\s+for|here\s+to|coming\s+for|having|celebrating|visiting)?\s*(?:a|an|the|my|our|his|her)?\s*/i,
        /^(?:here\s+for|here\s+to|came\s+for|coming\s+for|planning\s+for|celebrating|attending|organizing|having|for)\s+(?:a|an|the|my|our|his|her|their)?\s*/i,
        /^(?:have|has|had|having|got)\s+(?:a|an|the|my|our|some)?\s*/i,
        /^(?:have\s+my|have\s+a|have\s+our|have\s+the|having\s+my|having\s+a|having\s+our)\s+/i,
        /^(?:we\s+will\s+be\s+having|we'll\s+be\s+having|will\s+be\s+having|having)\s+(?:a|an|the|my|our)?\s*/i,
        /^(?:there\s+is|there's|there\s+will\s+be|it\s+is|it's|that's|this\s+is)\s+(?:a|an|the|my|our|your)?\s*/i,
        /^(?:is\s+my|is\s+our|is\s+your|is\s+a|is\s+an|is\s+the|is|was|will\s+be|are|were|be)\s+/i,
        /^(?:my|your|his|her|our|their)\s+/i,
        /^(?:going\s+for|going\s+to|planning\s+for|attending|scheduled\s+for)\s+(?:a|an|the)?\s+/i,
        /^(?:don't\s+forget\s+to|remember\s+to|remind\s+me\s+to|please\s+remind\s+me\s+to|please\s+remember\s+to|make\s+sure\s+to|need\s+to|have\s+to|has\s+to|got\s+to|supposed\s+to)\s+/i,
        /^(?:i\s+want\s+to|i\s+need\s+to|we\s+need\s+to|you\s+need\s+to)\s+/i,
        /^(?:a|an|the)\s+/i
    ];

    let changed = true;
    let guard = 0;
    while (changed && guard < 10) {
        changed = false;
        guard++;
        for (const pattern of fillerPatterns) {
            if (pattern.test(clean)) {
                clean = clean.replace(pattern, '').trim();
                changed = true;
            }
        }
    }

    // 6. Remove trailing prepositions, punctuation & relative words if left hanging
    clean = clean.replace(/\s+(?:on|at|by|for|this|during|in|from|which|that|is|it|to|a|an|the)$/i, '').trim();
    clean = clean.replace(/^[\s,?.!-]+|[\s,?.!-]+$/g, '').trim();

    // 7. Use Compromise NLP to isolate noun/action entity if messy
    try {
        if (clean.length > 0) {
            const doc = nlp(clean) as any;
            const nouns = doc.nouns ? doc.nouns().out('array') : [];
            if (nouns.length === 1 && clean.split(/\s+/).length > 3 && !/^(?:take|call|buy|visit|meet|attend|submit|prepare)\b/i.test(clean)) {
                const singleNoun = nouns[0].replace(/^(?:a|an|the|my|our)\s+/i, '').trim();
                if (singleNoun.length >= 2) {
                    clean = singleNoun;
                }
            }
        }
    } catch {
        // Fallback to regex clean
    }

    // 8. Strip single question/pronoun/noise words
    if (/^(?:what|when|where|who|how|why|you|here|there|something|stuff|actually|tomorrow|today|is\s+my|brings\s+you|am\s+here|sure\s+i'll|i'll\s+be\s+there)$/i.test(clean)) {
        return 'Event';
    }

    // 9. Capitalize into Title Case
    if (clean.length > 0) {
        clean = clean
            .split(/\s+/)
            .map((w, i) => {
                if (i !== 0 && /^(?:to|the|a|an|for|on|at|of|in|with|and)$/i.test(w)) return w.toLowerCase();
                return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
            })
            .join(' ');
    }

    return clean || 'Event';
}

/**
 * Robust date parser supporting all conversational & numerical formats
 */
export function parseDateFromText(text: string): Date {
    const now = new Date();
    const currentYear = now.getFullYear();
    const lower = text.toLowerCase().trim();

    // 1. Relative keywords
    if (lower.includes('today') || lower.includes('tonight')) return now;
    if (lower.includes('day after tomorrow')) {
        const d = new Date(now);
        d.setDate(d.getDate() + 2);
        return d;
    }
    if (lower.includes('tomorrow')) {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
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

    // 2. Day names (e.g., "next Friday", "this Sunday", "Monday")
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < dayNames.length; i++) {
        if (lower.includes(dayNames[i])) {
            const d = new Date(now);
            const currentDay = d.getDay();
            let daysUntil = i - currentDay;
            if (daysUntil <= 0) daysUntil += 7;
            if (lower.includes('next') && daysUntil < 7) daysUntil += 7;
            d.setDate(d.getDate() + daysUntil);
            return d;
        }
    }

    // 3. Format: "16th of Jan", "16th of January", "16 Jan", "16th January"
    const dayOfMonMatch = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i);
    if (dayOfMonMatch) {
        const day = parseInt(dayOfMonMatch[1]);
        const monthKey = dayOfMonMatch[2].substring(0, 3).toLowerCase();
        const month = MONTHS_MAP[monthKey];
        if (month !== undefined && day >= 1 && day <= 31) {
            let year = currentYear;
            const targetDate = new Date(year, month, day);
            if (targetDate < now) {
                year++;
            }
            return new Date(year, month, day);
        }
    }

    // 4. Format: "Jan 16", "January 16th", "Jan 16th"
    const monDayMatch = lower.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
    if (monDayMatch) {
        const monthKey = monDayMatch[1].substring(0, 3).toLowerCase();
        const day = parseInt(monDayMatch[2]);
        const month = MONTHS_MAP[monthKey];
        if (month !== undefined && day >= 1 && day <= 31) {
            let year = currentYear;
            const targetDate = new Date(year, month, day);
            if (targetDate < now) {
                year++;
            }
            return new Date(year, month, day);
        }
    }

    // 5. Standard date object fallback
    const std = new Date(text);
    if (!isNaN(std.getTime()) && std.getFullYear() > 2000) {
        return std;
    }

    return now;
}

/**
 * Format a Date object into clean human-readable date e.g. "Jan 16"
 */
export function formatHumanDate(date: Date): string {
    const month = MONTH_NAMES[date.getMonth()].substring(0, 3);
    const day = date.getDate();
    return `${month} ${day}`;
}

/**
 * Main NLP Extractor: Takes raw speech transcript and extracts structured tasks/events
 * Handles cases like: "I have a Birthday on 16th of Jan" -> Event: "Birthday", on "Jan 16"
 */
export function extractTasksAndDatesNLP(transcript: string): ExtractedTask[] {
    const results: ExtractedTask[] = [];
    if (!transcript || !transcript.trim()) return results;

    // Split compound sentences into segments
    const segments = transcript.split(/\b(?:and\s+also|and\s+then|and|then|also|plus|but)\b/i);

    // Regex components for date phrases
    const monthTerms = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
    const dayTerms = '(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)';
    const relTerms = '(?:today|tonight|tomorrow|day\\s+after\\s+tomorrow|next\\s+week|next\\s+month)';

    // Date Pattern 1: "... on/for 16th of Jan" or "... on 16th January"
    // e.g. "I have a Birthday on 16th of Jan"
    const pattern1 = new RegExp(
        `(.+?)\\s+(?:on|for|at|by|this)\\s+(?:the\\s+)?(\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${monthTerms}|${monthTerms}\\s+\\d{1,2}(?:st|nd|rd|th)?|${relTerms}|(?:next\\s+)?${dayTerms})`,
        'i'
    );

    // Action Pattern 2: "Remember to / Don't forget to take medicine"
    const actionPattern = /\b(?:remember\s+to|don't\s+forget\s+to|remind\s+me\s+to|make\s+sure\s+to|need\s+to)\s+([^,.\n]+)/i;

    segments.forEach(seg => {
        const cleanSeg = seg.trim();
        if (!cleanSeg || cleanSeg.length < 4) return;

        // Try Pattern 1 (Event with Date)
        const match1 = cleanSeg.match(pattern1);
        if (match1) {
            const rawEventPart = match1[1].trim();
            const rawDatePart = match1[2].trim();

            const cleanEvent = cleanEventTitle(rawEventPart);
            const parsedDate = parseDateFromText(rawDatePart);
            const humanDate = formatHumanDate(parsedDate);

            // Filter out junk questions like "What", "How", "Why"
            if (cleanEvent.length >= 2 && !['What', 'When', 'How', 'Where', 'Why', 'Who'].includes(cleanEvent)) {
                results.push({
                    rawText: cleanSeg,
                    event: cleanEvent,
                    dateText: rawDatePart,
                    parsedDate,
                    type: 'date',
                    formattedEvent: `${cleanEvent} on ${humanDate}`
                });
                return;
            }
        }

        // Try Action Pattern (Direct Reminders)
        const matchAction = cleanSeg.match(actionPattern);
        if (matchAction) {
            const actionText = matchAction[1].trim();
            const cleanAction = cleanEventTitle(actionText);
            const parsedDate = parseDateFromText(actionText);

            if (cleanAction.length >= 2) {
                results.push({
                    rawText: cleanSeg,
                    event: cleanAction,
                    dateText: 'Today',
                    parsedDate,
                    type: 'action',
                    formattedEvent: cleanAction
                });
                return;
            }
        }

        // Try Compromise NLP Entity & Date detection as a fallback
        try {
            const doc = nlp(cleanSeg) as any;
            const dates = doc.dates ? doc.dates().out('array') : [];
            const nouns = doc.nouns ? doc.nouns().out('array') : [];

            if (dates.length > 0 && nouns.length > 0) {
                const dateText = dates[0];
                // Remove dateText from segment to isolate the noun phrase
                const eventWithoutDate = cleanSeg.replace(new RegExp(dateText, 'gi'), '');
                const cleanEvent = cleanEventTitle(eventWithoutDate);
                const parsedDate = parseDateFromText(dateText);
                const humanDate = formatHumanDate(parsedDate);

                if (cleanEvent.length >= 2 && cleanEvent.toLowerCase() !== 'event') {
                    results.push({
                        rawText: cleanSeg,
                        event: cleanEvent,
                        dateText,
                        parsedDate,
                        type: 'date',
                        formattedEvent: `${cleanEvent} on ${humanDate}`
                    });
                }
            }
        } catch (nlpErr) {
            console.warn('[NLP Extractor] Compromise fallback notice:', nlpErr);
        }
    });

    return results;
}
