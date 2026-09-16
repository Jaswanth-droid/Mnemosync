import nlp from 'compromise';
import { cleanEventTitle } from './nlpExtractor';

export interface Occasion {
    title: string;                       // concise event, e.g. "Hackathon", "Doctor appointment"
    when: string;                        // normalised temporal phrase, e.g. "September 16th", "on Friday"
    date?: Date;                         // resolved date when possible
    type: 'appointment' | 'reminder' | 'event';
}

const MONTHS = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const DAYS = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday';

// A "when" phrase we can act on. Ordered longest-first so greedy alternation
// prefers the most specific match.
const TEMPORAL_RE = new RegExp(
    `(?:` +
    `\\b(?:day\\s+after\\s+tomorrow|tomorrow|today|tonight)\\b` +
    `|\\bthis\\s+(?:morning|afternoon|evening|week|month|weekend|${DAYS})\\b` +
    `|\\bnext\\s+(?:week|month|weekend|${DAYS})\\b` +
    `|\\b(?:on|by|before|after|until|at)\\s+(?:the\\s+)?(?:${DAYS})\\b` +
    `|\\b(?:on|by|before|after|until)?\\s*(?:${MONTHS})\\s+\\d{1,2}(?:st|nd|rd|th)?\\b` +
    `|\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${MONTHS})\\b` +
    `|\\b(?:${DAYS})\\b` +
    `|\\bat\\s+\\d{1,2}(?::\\d{2})?\\s*(?:am|pm|a\\.m\\.|p\\.m\\.)\\b` +
    `|\\bin\\s+the\\s+(?:morning|afternoon|evening)\\b` +
    `)`,
    'gi'
);

const FILLER_PREFIXES = [
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

const RELATIVE_CLAUSES = [
    /\s*,\s*(?:so|and\s+so|because|that's\s+why|which\s+is\s+why|since)\s+.*$/i,
    /\s+(?:so|because)\s+(?:i|we|you)\s+.*$/i,
    /\s+(?:which|that)\s+(?:is|was|will\s+be|falls\s+on|takes\s+place\s+on).*$/i,
    /\s*,\s*(?:it\s+is|it's|which\s+is|that\s+is|falling\s+on|scheduled\s+for)\s+.*$/i,
    /\s+(?:it\s+is|it's|which\s+is|that\s+is)\s+(?:on|for|at|scheduled|set|planned).*$/i,
    /\s+(?:scheduled\s+for|set\s+for|planned\s+for).*$/i
];

function titleCase(phrase: string): string {
    return phrase
        .split(/\s+/)
        .map((w, i) => {
            if (i !== 0 && /^(?:to|the|a|an|for|on|at|of|in|with|and)$/i.test(w)) return w.toLowerCase();
            return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        })
        .join(' ');
}

/** Parse a resolved Date from a natural phrase */
export function parseDateFromText(text: string): Date {
    const now = new Date();
    const currentYear = now.getFullYear();
    const lower = text.toLowerCase();

    const monthMap: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6,
        aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
    };

    if (lower.includes('day after tomorrow')) return addDays(now, 2);
    if (lower.includes('tomorrow')) return addDays(now, 1);
    if (lower.includes('today') || lower.includes('tonight')) return now;
    if (lower.includes('next week')) return addDays(now, 7);
    if (lower.includes('next month')) { const d = new Date(now); d.setMonth(d.getMonth() + 1); return d; }

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < dayNames.length; i++) {
        if (lower.includes(dayNames[i])) {
            const d = new Date(now);
            let daysUntil = i - d.getDay();
            if (daysUntil <= 0) daysUntil += 7;
            return addDays(now, daysUntil);
        }
    }

    const monthDay = text.match(new RegExp(`\\b(${MONTHS})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'));
    if (monthDay) {
        const month = monthMap[monthDay[1].toLowerCase().slice(0, 3)];
        const day = parseInt(monthDay[2], 10);
        if (month !== undefined && day >= 1 && day <= 31) {
            let year = currentYear;
            let target = new Date(year, month, day);
            if (target < now) { year++; target = new Date(year, month, day); }
            return target;
        }
    }

    const dayMonth = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTHS})\\b`, 'i'));
    if (dayMonth) {
        const day = parseInt(dayMonth[1], 10);
        const month = monthMap[dayMonth[2].toLowerCase().slice(0, 3)];
        if (month !== undefined && day >= 1 && day <= 31) {
            let year = currentYear;
            let target = new Date(year, month, day);
            if (target < now) { year++; target = new Date(year, month, day); }
            return target;
        }
    }

    const standard = new Date(text);
    if (!isNaN(standard.getTime())) return standard;
    return now;
}

function addDays(base: Date, days: number): Date {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d;
}

function classify(clause: string): Occasion['type'] {
    const l = clause.toLowerCase();
    if (/(doctor|dentist|clinic|hospital|appointment|check-?up|therapy|physio|lab|test)/.test(l)) return 'appointment';
    if (/(remind|remember|don'?t forget|take your|medicine|medication|pill|call|pay|buy)/.test(l)) return 'reminder';
    return 'event';
}

function normaliseWhen(raw: string): string {
    return raw.replace(/\s{2,}/g, ' ').trim().replace(/^,/g, '').trim();
}

/**
 * Extract concise occasions from conversational transcript/utterance.
 * Converts "So actually tomorrow I have a hackathon which is 16th September" -> "Hackathon" on "September 16th"
 */
export function extractOccasions(input: string, speakerName?: string): Occasion[] {
    if (!input || !input.trim()) return [];
    const results: Occasion[] = [];
    const seen = new Set<string>();

    // Split compound utterances into clean clauses
    const clauses = input
        .split(/(?<=[.?!])\s+|[;.\n!?]|\band\s+also\b|\band\s+then\b|\bplus\b/i)
        .map(c => c.trim())
        .filter(c => c.length > 2);

    for (const clause of clauses) {
        // Skip pure greetings or conversational questions
        if (/^(?:hi|hello|hey|good\s+morning|how\s+are\s+you|what\s+brings\s+you\s+here|what\s+is\s+your\s+name|my\s+name\s+is|sure\s+i'll\s+be\s+there|sure\s+i\s+will)[\s?.,!]*$/i.test(clause)) {
            continue;
        }

        // Find all temporal matches in the clause
        TEMPORAL_RE.lastIndex = 0;
        const matches: { text: string; index: number }[] = [];
        let m: RegExpExecArray | null;
        while ((m = TEMPORAL_RE.exec(clause)) !== null) {
            matches.push({ text: m[0], index: m.index });
        }

        if (matches.length === 0) continue;

        // Choose the most specific date when multiple exist (e.g. "16th September" over "tomorrow")
        let primaryWhen = matches[0].text;
        for (const match of matches) {
            if (new RegExp(MONTHS, 'i').test(match.text)) {
                primaryWhen = match.text;
                break;
            }
        }

        // Remove relative clause tails (e.g. "which is 16th September")
        let candidate = clause;
        for (const rel of RELATIVE_CLAUSES) {
            candidate = candidate.replace(rel, ' ');
        }

        // Remove all temporal phrases from candidate to isolate the event noun
        for (const match of matches) {
            candidate = candidate.replace(new RegExp(`\\b${match.text}\\b`, 'gi'), ' ');
        }

        // Remove conversational filler prefixes repeatedly
        let changed = true;
        let guard = 0;
        while (changed && guard < 8) {
            changed = false;
            guard++;
            for (const pat of FILLER_PREFIXES) {
                if (pat.test(candidate.trim())) {
                    candidate = candidate.trim().replace(pat, '');
                    changed = true;
                }
            }
        }

        // Clean trailing and leading punctuation/prepositions
        candidate = candidate.replace(/\s+(?:on|at|by|for|this|next|in|during|is|to|a|an|the|which|that)$/i, '').trim();
        candidate = candidate.replace(/^[\s,?.!-]+|[\s,?.!-]+$/g, '').trim();

        // Use cleanEventTitle & NLP entity refinement
        let eventName = cleanEventTitle(candidate, speakerName);

        // Filter out residual garbage words
        if (
            !eventName ||
            eventName === 'Event' ||
            eventName.length < 2 ||
            /^(?:what|when|where|who|how|why|you|here|there|something|stuff|actually|tomorrow|today|is\s+my|am\s+here)$/i.test(eventName)
        ) {
            continue;
        }

        let title = titleCase(eventName);
        // If speaker is a visitor and phrase referred to "my birthday" / "my anniversary", attribute to visitor
        if (speakerName && speakerName !== 'You' && speakerName !== 'User' && /^(?:birthday|anniversary|wedding|graduation|farewell|party)$/i.test(title)) {
            if (/\b(?:my|our)\b/i.test(clause)) {
                title = `${speakerName}'s ${title}`;
            }
        }

        const when = normaliseWhen(primaryWhen);
        const key = `${title}|${when}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        results.push({
            title,
            when,
            date: parseDateFromText(when),
            type: classify(clause),
        });
    }

    return results;
}

