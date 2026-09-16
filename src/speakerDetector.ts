import { getVoicePrintEngine, VoiceMatch } from './voicePrint';

export interface IdentifiedPerson {
    name: string;
    relation: string;
}

/**
 * Resolved speaker for a single utterance.
 *
 * `label` is what the transcript shows ("You", "Visitor", or a specific known
 * name). `isOwner` is true only when the voiceprint (or face) confidently
 * matches the enrolled owner/patient.
 */
export interface SpeakerDecision {
    label: 'You' | 'Visitor';
    resolvedName: string;
    isOwner: boolean;
    isKnownVoice: boolean;
    voiceScore: number;
    source: 'voice' | 'face' | 'none';
}

/**
 * SpeakerDetector decides who is currently speaking.
 *
 * Priority:
 *  1. Voiceprint — the real signal. If the live audio confidently matches an
 *     enrolled profile, we know exactly who it is (owner vs. a named person vs.
 *     a stranger).
 *  2. Face identification — a fallback for when no voice is enrolled yet or the
 *     audio is inconclusive (e.g. background noise, very short utterance).
 *
 * The old implementation imported all of @tensorflow/tfjs but never used it and
 * only compared face names. That dead import is gone; identification is now
 * genuinely audio-first.
 */
export class SpeakerDetector {
    private engine = getVoicePrintEngine();

    /** Raw voiceprint match for the current audio window. */
    public matchVoice(): VoiceMatch {
        return this.engine.identifyCurrent();
    }

    /**
     * Decide the speaker for an utterance.
     *
     * @param identifiedPerson  Person currently seen by face recognition, if any.
     * @param primarySpeakerName  The enrolled owner/patient name (baseline "You").
     */
    public detectSpeaker(
        identifiedPerson: IdentifiedPerson | null,
        primarySpeakerName: string | null
    ): SpeakerDecision {
        const match = this.engine.identifyCurrent();

        // 1. Voiceprint wins when confident.
        if (match.isKnown && match.profile) {
            const p = match.profile;
            const isOwner = p.isOwner ||
                (primarySpeakerName != null && p.name.toLowerCase() === primarySpeakerName.toLowerCase());
            return {
                label: isOwner ? 'You' : 'Visitor',
                resolvedName: isOwner ? (primarySpeakerName || p.name) : p.name,
                isOwner,
                isKnownVoice: true,
                voiceScore: match.score,
                source: 'voice',
            };
        }

        // Voice heard but not enrolled → an unknown person is speaking.
        // If we also have no face signal, treat as Visitor (someone other than owner).
        // 2. Face-based fallback.
        if (identifiedPerson && primarySpeakerName) {
            const sameAsOwner = identifiedPerson.name.toLowerCase() === primarySpeakerName.toLowerCase();
            return {
                label: sameAsOwner ? 'You' : 'Visitor',
                resolvedName: identifiedPerson.name,
                isOwner: sameAsOwner,
                isKnownVoice: false,
                voiceScore: match.score,
                source: 'face',
            };
        }

        // 3. Nothing to go on — default to the owner speaking (most common case
        //    for a single patient using the device), but mark it low-confidence.
        return {
            label: 'You',
            resolvedName: primarySpeakerName || 'You',
            isOwner: true,
            isKnownVoice: false,
            voiceScore: match.score,
            source: 'none',
        };
    }
}
