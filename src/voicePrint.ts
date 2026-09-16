/**
 * VoicePrint — a lightweight, dependency-free speaker identification engine.
 *
 * It captures microphone audio through the Web Audio API, derives an MFCC-style
 * feature embedding for each short window, and compares that embedding against
 * enrolled profiles using cosine similarity. This lets Mnemosync recognise the
 * owner's voice AND other specific enrolled people (family, caregivers), and
 * tell them apart from unenrolled strangers — the core of the Alzheimer's
 * companion's "who is talking to me?" reassurance.
 *
 * This is deliberately a pragmatic in-browser approach (mean/std of MFCCs plus a
 * few spectral stats), not a research-grade x-vector model. It runs entirely on
 * device, needs no server, and is good enough to distinguish a handful of known
 * voices in a calm home environment.
 */

const STORAGE_KEY = 'mnemosync_voice_profiles_v1';
const NUM_MFCC = 13;
const NUM_MEL_FILTERS = 26;
const FFT_SIZE = 2048;

// Cosine similarity at or above this counts as a confident match to a known voice.
export const MATCH_THRESHOLD = 0.82;

export interface VoiceProfile {
    id: string;
    name: string;
    relation: string;
    isOwner: boolean;
    embedding: number[];
    sampleCount: number;
    createdAt: number;
    updatedAt: number;
}

export interface VoiceMatch {
    profile: VoiceProfile | null;
    score: number;
    isKnown: boolean;
}

// ---- DSP helpers -----------------------------------------------------------

function hzToMel(hz: number): number {
    return 2595 * Math.log10(1 + hz / 700);
}

function melToHz(mel: number): number {
    return 700 * (Math.pow(10, mel / 2595) - 1);
}

/** Precompute triangular mel filterbank bin indices/weights for a given FFT. */
function buildMelFilterbank(sampleRate: number): { start: number; center: number; end: number }[] {
    const numBins = FFT_SIZE / 2;
    const lowMel = hzToMel(0);
    const highMel = hzToMel(sampleRate / 2);
    const melStep = (highMel - lowMel) / (NUM_MEL_FILTERS + 1);
    const centers: number[] = [];
    for (let i = 0; i < NUM_MEL_FILTERS + 2; i++) {
        const hz = melToHz(lowMel + i * melStep);
        centers.push(Math.floor((hz * FFT_SIZE) / sampleRate));
    }
    const filters: { start: number; center: number; end: number }[] = [];
    for (let m = 1; m <= NUM_MEL_FILTERS; m++) {
        filters.push({
            start: Math.max(0, centers[m - 1]),
            center: Math.max(0, centers[m]),
            end: Math.min(numBins - 1, centers[m + 1]),
        });
    }
    return filters;
}

/** Type-II DCT keeping the first `numOut` coefficients. */
function dct(input: number[], numOut: number): number[] {
    const N = input.length;
    const out: number[] = [];
    for (let k = 0; k < numOut; k++) {
        let sum = 0;
        for (let n = 0; n < N; n++) {
            sum += input[n] * Math.cos((Math.PI * k * (2 * n + 1)) / (2 * N));
        }
        out.push(sum);
    }
    return out;
}

function mean(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[]): number {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((acc, v) => acc + (v - m) * (v - m), 0) / arr.length);
}

export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0;
    // Map [-1,1] -> [0,1] so thresholds are intuitive.
    return (dot / (Math.sqrt(na) * Math.sqrt(nb)) + 1) / 2;
}

function l2Normalize(vec: number[]): number[] {
    const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0));
    if (norm === 0) return vec;
    return vec.map(v => v / norm);
}

// ---- Engine ----------------------------------------------------------------

type FrameFeatures = {
    mfcc: number[];      // NUM_MFCC values
    centroid: number;
    rolloff: number;
    zcr: number;
    rms: number;
};

export class VoicePrintEngine {
    private audioCtx: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    private stream: MediaStream | null = null;
    private freqData = new Float32Array(0);
    private timeData = new Float32Array(0);
    private filterbank: { start: number; center: number; end: number }[] = [];
    private loopHandle: number | null = null;

    private profiles: VoiceProfile[] = [];
    private currentEmbedding: number[] | null = null;
    private running = false;

    constructor() {
        this.profiles = this.loadProfiles();
    }

    // -- persistence --
    private loadProfiles(): VoiceProfile[] {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? (JSON.parse(raw) as VoiceProfile[]) : [];
        } catch {
            return [];
        }
    }

    private saveProfiles(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profiles));
        } catch (e) {
            console.warn('[VoicePrint] Failed to persist profiles:', e);
        }
    }

    getProfiles(): VoiceProfile[] {
        return [...this.profiles];
    }

    getOwner(): VoiceProfile | null {
        return this.profiles.find(p => p.isOwner) || null;
    }

    hasProfiles(): boolean {
        return this.profiles.length > 0;
    }

    deleteProfile(id: string): void {
        this.profiles = this.profiles.filter(p => p.id !== id);
        this.saveProfiles();
    }

    // -- audio lifecycle --
    async start(): Promise<boolean> {
        if (this.running) return true;
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true },
            });
            const Ctx = window.AudioContext || (window as any).webkitAudioContext;
            this.audioCtx = new Ctx();
            if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
            this.source = this.audioCtx.createMediaStreamSource(this.stream);
            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = FFT_SIZE;
            this.analyser.smoothingTimeConstant = 0.2;
            this.source.connect(this.analyser);
            this.freqData = new Float32Array(this.analyser.frequencyBinCount);
            this.timeData = new Float32Array(FFT_SIZE);
            this.filterbank = buildMelFilterbank(this.audioCtx.sampleRate);
            this.running = true;
            this.loop();
            return true;
        } catch (e) {
            console.error('[VoicePrint] Microphone access failed:', e);
            this.cleanupAudio();
            return false;
        }
    }

    stop(): void {
        this.running = false;
        if (this.loopHandle !== null) {
            clearTimeout(this.loopHandle);
            this.loopHandle = null;
        }
        this.cleanupAudio();
        this.currentEmbedding = null;
    }

    isRunning(): boolean {
        return this.running;
    }

    private cleanupAudio(): void {
        try {
            this.stream?.getTracks().forEach(t => t.stop());
            this.source?.disconnect();
            this.analyser?.disconnect();
            this.audioCtx?.close();
        } catch {
            /* ignore */
        }
        this.stream = null;
        this.source = null;
        this.analyser = null;
        this.audioCtx = null;
    }

    /** Extract per-frame features from the analyser's current buffers. */
    private extractFrame(): FrameFeatures | null {
        if (!this.analyser || !this.audioCtx) return null;
        this.analyser.getFloatFrequencyData(this.freqData);
        this.analyser.getFloatTimeDomainData(this.timeData);

        const sampleRate = this.audioCtx.sampleRate;
        const binHz = sampleRate / FFT_SIZE;

        // Reject near-silent frames (dB floor is typically -100).
        let rms = 0;
        for (let i = 0; i < this.timeData.length; i++) rms += this.timeData[i] * this.timeData[i];
        rms = Math.sqrt(rms / this.timeData.length);
        if (rms < 0.01) return null;

        // Power spectrum from dB.
        const power: number[] = new Array(this.freqData.length);
        for (let i = 0; i < this.freqData.length; i++) {
            power[i] = Math.pow(10, this.freqData[i] / 10);
        }

        // Spectral centroid & rolloff.
        let weighted = 0, total = 0;
        for (let i = 0; i < power.length; i++) {
            weighted += i * binHz * power[i];
            total += power[i];
        }
        const centroid = total > 0 ? weighted / total : 0;
        let cumulative = 0, rolloff = 0;
        for (let i = 0; i < power.length; i++) {
            cumulative += power[i];
            if (total > 0 && cumulative >= 0.85 * total) {
                rolloff = i * binHz;
                break;
            }
        }

        // Zero-crossing rate.
        let zc = 0;
        for (let i = 1; i < this.timeData.length; i++) {
            if ((this.timeData[i - 1] < 0 && this.timeData[i] >= 0) ||
                (this.timeData[i - 1] >= 0 && this.timeData[i] < 0)) zc++;
        }
        const zcr = zc / this.timeData.length;

        // Mel filterbank energies -> log -> DCT -> MFCCs.
        const melEnergies: number[] = [];
        for (const f of this.filterbank) {
            let energy = 0;
            const span = Math.max(1, f.end - f.start);
            for (let i = f.start; i <= f.end; i++) {
                const weight = i <= f.center
                    ? (i - f.start) / Math.max(1, f.center - f.start)
                    : (f.end - i) / Math.max(1, f.end - f.center);
                energy += power[i] * weight;
            }
            melEnergies.push(Math.log((energy / span) + 1e-10));
        }
        const mfcc = dct(melEnergies, NUM_MFCC).slice(1); // drop c0 (overall energy)

        return { mfcc, centroid, rolloff, zcr, rms };
    }

    /** Continuously refresh a rolling embedding while running. */
    private loop = (): void => {
        if (!this.running) return;
        const windowFeatures: FrameFeatures[] = [];
        const collect = () => {
            const f = this.extractFrame();
            if (f) windowFeatures.push(f);
        };
        // Sample ~8 frames spread over ~240ms to form one embedding window.
        collect();
        let n = 0;
        const step = () => {
            collect();
            n++;
            if (n < 7) {
                this.loopHandle = window.setTimeout(step, 30);
            } else {
                this.currentEmbedding = this.embed(windowFeatures);
                this.loopHandle = window.setTimeout(this.loop, 120);
            }
        };
        this.loopHandle = window.setTimeout(step, 30);
    };

    /** Turn a list of frame features into one normalised embedding vector. */
    private embed(frames: FrameFeatures[]): number[] | null {
        if (frames.length === 0) return null;
        const vec: number[] = [];
        for (let c = 0; c < NUM_MFCC - 1; c++) {
            const col = frames.map(f => f.mfcc[c]);
            vec.push(mean(col), std(col));
        }
        vec.push(mean(frames.map(f => f.centroid)), std(frames.map(f => f.centroid)));
        vec.push(mean(frames.map(f => f.rolloff)));
        vec.push(mean(frames.map(f => f.zcr)));
        vec.push(mean(frames.map(f => f.rms)), std(frames.map(f => f.rms)));
        return l2Normalize(vec);
    }

    getCurrentEmbedding(): number[] | null {
        return this.currentEmbedding;
    }

    /**
     * Record for `durationMs` and return a stable embedding, used for enrolment.
     * Accumulates several internal windows and averages them.
     */
    async captureEmbedding(durationMs = 3000): Promise<number[] | null> {
        if (!this.running) {
            const ok = await this.start();
            if (!ok) return null;
        }
        const samples: number[][] = [];
        const startTs = Date.now();
        await new Promise<void>(resolve => {
            const tick = () => {
                const emb = this.getCurrentEmbedding();
                if (emb) samples.push(emb);
                if (Date.now() - startTs >= durationMs) resolve();
                else window.setTimeout(tick, 150);
            };
            tick();
        });
        if (samples.length === 0) return null;
        const dim = samples[0].length;
        const avg: number[] = new Array(dim).fill(0);
        for (const s of samples) for (let i = 0; i < dim; i++) avg[i] += s[i];
        for (let i = 0; i < dim; i++) avg[i] /= samples.length;
        return l2Normalize(avg);
    }

    /** Enrol (or update) a named voice. Multiple samples are averaged in. */
    async enroll(name: string, relation: string, isOwner: boolean, durationMs = 3500): Promise<VoiceProfile | null> {
        const embedding = await this.captureEmbedding(durationMs);
        if (!embedding) return null;

        const existing = this.profiles.find(p => p.name.toLowerCase() === name.toLowerCase());
        if (existing) {
            const n = existing.sampleCount;
            existing.embedding = l2Normalize(
                existing.embedding.map((v, i) => (v * n + embedding[i]) / (n + 1))
            );
            existing.sampleCount = n + 1;
            existing.relation = relation || existing.relation;
            existing.isOwner = isOwner || existing.isOwner;
            existing.updatedAt = Date.now();
            this.saveProfiles();
            return existing;
        }

        const profile: VoiceProfile = {
            id: `vp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name,
            relation,
            isOwner,
            embedding,
            sampleCount: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        // Only one owner allowed.
        if (isOwner) this.profiles.forEach(p => (p.isOwner = false));
        this.profiles.push(profile);
        this.saveProfiles();
        return profile;
    }

    /** Identify the closest enrolled voice to an embedding. */
    identify(embedding: number[] | null): VoiceMatch {
        if (!embedding || this.profiles.length === 0) {
            return { profile: null, score: 0, isKnown: false };
        }
        let best: VoiceProfile | null = null;
        let bestScore = -1;
        for (const p of this.profiles) {
            const score = cosineSimilarity(embedding, p.embedding);
            if (score > bestScore) {
                bestScore = score;
                best = p;
            }
        }
        const isKnown = best !== null && bestScore >= MATCH_THRESHOLD;
        return { profile: isKnown ? best : null, score: Math.max(0, bestScore), isKnown };
    }

    /** Convenience: identify whoever is speaking right now. */
    identifyCurrent(): VoiceMatch {
        return this.identify(this.getCurrentEmbedding());
    }
}

// Shared singleton so the recorder and any enrolment UI use one audio pipeline.
let engineInstance: VoicePrintEngine | null = null;
export function getVoicePrintEngine(): VoicePrintEngine {
    if (!engineInstance) engineInstance = new VoicePrintEngine();
    return engineInstance;
}
