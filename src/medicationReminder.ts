import { 
    MedicationSchedule, 
    MedicationAdherenceLog, 
    getMedicationSchedules, 
    getMedicationAdherenceLogs, 
    addMedicationAdherenceLog, 
    generateId 
} from './memoryDatabase';

export interface DrugInteractionWarning {
    id: string;
    severity: 'mild' | 'moderate' | 'high' | 'critical';
    medications: string[];
    title: string;
    description: string;
    clinicalGuidance: string;
}

export interface DueMedicationAlert {
    schedule: MedicationSchedule;
    scheduledTimeToday: string; // e.g., '2026-09-15T08:00:00'
    timeLabel: string; // '08:00 AM'
    minutesUntilDue: number; // e.g. 30 (for 30 min before) or negative if past
    isEscalatedToCaregiver: boolean;
    hasBeenConfirmed: boolean;
}

/**
 * Synthesizes a gentle dual-tone medical chime using Web Audio API
 */
class ChimePlayer {
    private audioCtx: AudioContext | null = null;
    private chimeInterval: number | null = null;

    private getContext(): AudioContext | null {
        if (typeof window === 'undefined') return null;
        if (!this.audioCtx) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                this.audioCtx = new AudioContextClass();
            }
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
        return this.audioCtx;
    }

    public playGentleChime() {
        try {
            const ctx = this.getContext();
            if (!ctx) return;

            const now = ctx.currentTime;

            // Tone 1: 528 Hz (Solfeggio frequency - calming, clear)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(528, now);
            gain1.gain.setValueAtTime(0.001, now);
            gain1.gain.exponentialRampToValueAtTime(0.18, now + 0.05);
            gain1.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 1.2);

            // Tone 2: 660 Hz (harmonic major third chime, delayed by 180ms)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(660, now + 0.18);
            gain2.gain.setValueAtTime(0.001, now + 0.18);
            gain2.gain.exponentialRampToValueAtTime(0.14, now + 0.23);
            gain2.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.18);
            osc2.stop(now + 1.5);
        } catch (e) {
            console.warn('[ChimePlayer] Audio chime playback bypassed:', e);
        }
    }

    public startRepeatingChime(intervalMs = 120000) {
        this.stopRepeatingChime();
        this.playGentleChime();
        this.chimeInterval = window.setInterval(() => {
            this.playGentleChime();
        }, intervalMs);
    }

    public stopRepeatingChime() {
        if (this.chimeInterval !== null) {
            clearInterval(this.chimeInterval);
            this.chimeInterval = null;
        }
    }
}

export const chimePlayer = new ChimePlayer();

/**
 * Checks if a medication dose is due (triggers exactly 30 mins before scheduled time)
 * and verifies if 1 hour has elapsed without confirmation (caregiver escalation)
 */
export function checkMedicationDue(
    schedules: MedicationSchedule[],
    adherenceLogs: MedicationAdherenceLog[],
    nowDate: Date = new Date()
): DueMedicationAlert[] {
    const alerts: DueMedicationAlert[] = [];
    const todayStr = nowDate.toISOString().split('T')[0];

    for (const schedule of schedules) {
        if (!schedule.isActive) continue;

        for (const timeStr of schedule.scheduledTimes) {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const scheduledDate = new Date(nowDate);
            scheduledDate.setHours(hours, minutes, 0, 0);

            const diffMs = scheduledDate.getTime() - nowDate.getTime();
            const diffMinutes = Math.round(diffMs / 60000);

            // Check if already confirmed for this dose today
            const alreadyConfirmed = adherenceLogs.some(log => {
                const logDate = new Date(log.confirmedAt).toISOString().split('T')[0];
                return log.scheduleId === schedule.id && logDate === todayStr && log.status !== 'missed';
            });

            // Trigger window:
            // 1. Starts 30 minutes BEFORE scheduled dose (diffMinutes <= 30)
            // 2. Extends until 4 hours past scheduled time (diffMinutes >= -240)
            if (diffMinutes <= 30 && diffMinutes >= -240 && !alreadyConfirmed) {
                // If more than 60 minutes have passed past the scheduled time (diffMinutes < -60),
                // escalate alert to caregiver!
                const isEscalated = diffMinutes < -60;

                alerts.push({
                    schedule,
                    scheduledTimeToday: scheduledDate.toISOString(),
                    timeLabel: formatTimeLabel(timeStr),
                    minutesUntilDue: diffMinutes,
                    isEscalatedToCaregiver: isEscalated,
                    hasBeenConfirmed: false
                });
            }
        }
    }

    return alerts;
}

/**
 * Confirms that a medication has been taken and saves adherence record to IndexedDB
 */
export async function logMedicationAdherence(
    schedule: MedicationSchedule,
    scheduledTimeToday: string,
    confirmedBy: 'Patient' | 'Caregiver' = 'Patient',
    notes?: string
): Promise<MedicationAdherenceLog> {
    const scheduledDate = new Date(scheduledTimeToday);
    const now = new Date();
    const diffMinutes = Math.round((now.getTime() - scheduledDate.getTime()) / 60000);

    let status: MedicationAdherenceLog['status'] = 'taken_on_time';
    if (diffMinutes > 60) {
        status = 'escalated_to_caregiver';
    } else if (diffMinutes > 15) {
        status = 'taken_delayed';
    }

    const logEntry: MedicationAdherenceLog = {
        id: generateId(),
        scheduleId: schedule.id,
        medicationName: schedule.name,
        dosage: schedule.dosage,
        scheduledTime: scheduledTimeToday,
        confirmedAt: now.toISOString(),
        confirmedBy,
        status,
        notes: notes || `Confirmed taken by ${confirmedBy} at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    };

    await addMedicationAdherenceLog(logEntry);
    return logEntry;
}

/**
 * Analyzes medication schedules and recent doses for clinical interactions and timing conflicts
 */
export function detectDrugInteractions(
    schedules: MedicationSchedule[],
    recentLogs: MedicationAdherenceLog[] = []
): DrugInteractionWarning[] {
    const warnings: DrugInteractionWarning[] = [];
    const medNames = schedules.map(s => s.name.toLowerCase());

    // 1. Memantine + Donepezil proximity check
    const hasDonepezil = medNames.some(n => n.includes('donepezil') || n.includes('aricept'));
    const hasMemantine = medNames.some(n => n.includes('memantine') || n.includes('namenda'));

    if (hasDonepezil && hasMemantine) {
        warnings.push({
            id: 'warn-don-mem',
            severity: 'moderate',
            medications: ['Donepezil', 'Memantine'],
            title: 'Synergistic Cognitive Combination Monitoring',
            description: 'Donepezil (ChE-inhibitor) and Memantine (NMDA-antagonist) are co-prescribed for moderate Alzheimer\'s. Simultaneous high-dose ingestion may induce transient nausea or dizziness.',
            clinicalGuidance: 'Administer with breakfast or maintain 20-30 minutes spacing if GI upset or mild nausea occurs.'
        });
    }

    // 2. Evening Donepezil warning (Sundowning / Sleep disruption risk)
    const donepezilSchedule = schedules.find(s => s.name.toLowerCase().includes('donepezil'));
    if (donepezilSchedule) {
        const hasEveningTime = donepezilSchedule.scheduledTimes.some(t => {
            const hour = parseInt(t.split(':')[0], 10);
            return hour >= 18;
        });
        if (hasEveningTime) {
            warnings.push({
                id: 'warn-don-evening',
                severity: 'high',
                medications: ['Donepezil'],
                title: 'Donepezil Evening Administration Warning',
                description: 'Donepezil stimulates central cholinergic pathways. Evening administration frequently causes vivid nightmares, nocturnal insomnia, and aggravated sundowning agitation.',
                clinicalGuidance: 'Neurologists strongly recommend scheduling Donepezil at 08:00 AM (Breakfast) to prevent nighttime awakening.'
            });
        }
    }

    // 3. Melatonin Daytime Timing warning
    const melatoninSchedule = schedules.find(s => s.name.toLowerCase().includes('melatonin'));
    if (melatoninSchedule) {
        const hasDaytime = melatoninSchedule.scheduledTimes.some(t => {
            const hour = parseInt(t.split(':')[0], 10);
            return hour >= 6 && hour < 19;
        });
        if (hasDaytime) {
            warnings.push({
                id: 'warn-mel-daytime',
                severity: 'high',
                medications: ['Melatonin'],
                title: 'Melatonin Daytime Timing Conflict',
                description: 'Melatonin administered before 19:00 disrupts diurnal circadian rhythms, inducing daytime somnolence and disorientation.',
                clinicalGuidance: 'Administer Melatonin strictly 30-45 minutes before intended bedtime (21:00 - 22:00).'
            });
        }
    }

    // 4. Duplicate dose within 4-hour window
    if (recentLogs.length > 0) {
        const now = Date.now();
        const fourHoursAgo = now - 4 * 60 * 60 * 1000;
        const recentDoses = recentLogs.filter(l => new Date(l.confirmedAt).getTime() > fourHoursAgo);

        const counts: Record<string, number> = {};
        for (const dose of recentDoses) {
            counts[dose.medicationName] = (counts[dose.medicationName] || 0) + 1;
            if (counts[dose.medicationName] > 1) {
                warnings.push({
                    id: `warn-dup-${dose.medicationName}`,
                    severity: 'critical',
                    medications: [dose.medicationName],
                    title: `Possible Duplicate Dose: ${dose.medicationName}`,
                    description: `${dose.medicationName} was confirmed taken twice within the last 4 hours. High risk of adverse cholinergic or sedative reaction.`,
                    clinicalGuidance: 'Verify with the caregiver immediately. Do not administer another dose until the next scheduled cycle.'
                });
            }
        }
    }

    return warnings;
}

/**
 * Formats 24h '08:00' to '08:00 AM'
 */
function formatTimeLabel(time24: string): string {
    const [h, m] = time24.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHours = h % 12 || 12;
    return `${displayHours.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`;
}

/**
 * Core Medication Scheduler Class managing browser notifications, interval sweeps,
 * repeating chimes, and caregiver escalation alerts.
 */
export class MedicationScheduler {
    private checkInterval: number | null = null;
    private activeAlerts: DueMedicationAlert[] = [];
    private onAlertsChangedCallback: ((alerts: DueMedicationAlert[]) => void) | null = null;
    private notifiedDoseIds = new Set<string>();

    constructor() {
        this.requestNotificationPermission();
    }

    public requestNotificationPermission() {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'default') {
                Notification.requestPermission().catch(() => {});
            }
        }
    }

    public start(callback?: (alerts: DueMedicationAlert[]) => void) {
        if (callback) this.onAlertsChangedCallback = callback;
        this.runSweep();

        // Run sweep every 30 seconds
        if (this.checkInterval === null) {
            this.checkInterval = window.setInterval(() => {
                this.runSweep();
            }, 30000);
        }
    }

    public stop() {
        if (this.checkInterval !== null) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        chimePlayer.stopRepeatingChime();
    }

    public async runSweep() {
        try {
            const [schedules, logs] = await Promise.all([
                getMedicationSchedules(),
                getMedicationAdherenceLogs()
            ]);

            const dueAlerts = checkMedicationDue(schedules, logs);
            this.activeAlerts = dueAlerts;

            if (dueAlerts.length > 0) {
                // Play chime repeating every 2 minutes while unconfirmed
                chimePlayer.startRepeatingChime(120000);

                // Push browser notification for new alerts
                for (const alert of dueAlerts) {
                    const alertKey = `${alert.schedule.id}-${alert.scheduledTimeToday}`;
                    if (!this.notifiedDoseIds.has(alertKey)) {
                        this.notifiedDoseIds.add(alertKey);
                        this.sendBrowserNotification(alert);
                    }
                }
            } else {
                chimePlayer.stopRepeatingChime();
            }

            if (this.onAlertsChangedCallback) {
                this.onAlertsChangedCallback(dueAlerts);
            }
        } catch (err) {
            console.error('[MedicationScheduler] Sweep error:', err);
        }
    }

    private sendBrowserNotification(alert: DueMedicationAlert) {
        if (typeof window === 'undefined' || !('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;

        const title = alert.isEscalatedToCaregiver
            ? `⚠️ Caregiver Alert: Missed Dose - ${alert.schedule.name}`
            : `💊 Medication Reminder: ${alert.schedule.name} (${alert.schedule.dosage})`;

        const body = alert.isEscalatedToCaregiver
            ? `${alert.schedule.name} was scheduled for ${alert.timeLabel} (>1 hour ago) and has not been confirmed.`
            : `Scheduled for ${alert.timeLabel} (in ${Math.max(0, alert.minutesUntilDue)} mins). Reason: ${alert.schedule.reason}`;

        try {
            new Notification(title, {
                body,
                icon: '/mascot.jpg',
                tag: `med-${alert.schedule.id}`,
                requireInteraction: true
            });
        } catch (e) {
            console.warn('[MedicationScheduler] Browser notification failed:', e);
        }
    }

    public getActiveAlerts(): DueMedicationAlert[] {
        return this.activeAlerts;
    }
}
