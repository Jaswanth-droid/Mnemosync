import React, { useEffect, useState } from 'react';
import { DueMedicationAlert, MedicationScheduler, logMedicationAdherence } from './medicationReminder';
import {
    MedicationSchedule,
    getMedicationSchedules,
    addMedicationSchedule,
    generateId,
    SCHEDULES_CHANGED_EVENT,
} from './memoryDatabase';
import TiltCard from './TiltCard';
import { Pill, Plus, X, Clock, Trash2 } from 'lucide-react';

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.6rem 0.8rem',
    borderRadius: '0.75rem',
    border: '1px solid rgba(167, 139, 250, 0.4)',
    background: 'rgba(255,255,255,0.7)',
    color: '#3b2f52',
    fontSize: '0.9rem',
    outline: 'none',
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#6d5ba8',
    marginBottom: '0.3rem',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
};

function formatTimeLabel(time24: string): string {
    const [h, m] = time24.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHours = h % 12 || 12;
    return `${displayHours.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`;
}

/**
 * MedicationReminderUI
 *
 * Shows active due-alerts with a confirm action, lists every saved medication
 * reminder as a 3D tilt card, and provides a form to add new reminders with
 * one or more daily times. Newly saved reminders are picked up live by the
 * exact-time alarm (MedicationAlarm) via SCHEDULES_CHANGED_EVENT.
 */
export default function MedicationReminderUI() {
    const [alerts, setAlerts] = useState<DueMedicationAlert[]>([]);
    const [scheduler] = useState(() => new MedicationScheduler());
    const [schedules, setSchedules] = useState<MedicationSchedule[]>([]);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [name, setName] = useState('');
    const [dosage, setDosage] = useState('');
    const [instructions, setInstructions] = useState('');
    const [reason, setReason] = useState('');
    const [times, setTimes] = useState<string[]>(['08:00']);

    useEffect(() => {
        scheduler.start((active) => setAlerts(active));
        const load = () => getMedicationSchedules().then(setSchedules).catch(() => {});
        load();
        window.addEventListener(SCHEDULES_CHANGED_EVENT, load);
        return () => {
            scheduler.stop();
            window.removeEventListener(SCHEDULES_CHANGED_EVENT, load);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleConfirm = async (alert: DueMedicationAlert) => {
        try {
            await logMedicationAdherence(alert.schedule, alert.scheduledTimeToday, 'Patient');
            setAlerts((prev) => prev.filter((a) => a !== alert));
        } catch (e) {
            console.error('Error logging medication adherence:', e);
        }
    };

    const handleSave = async () => {
        const cleanTimes = times.filter((t) => /^\d{2}:\d{2}$/.test(t));
        if (!name.trim() || cleanTimes.length === 0) return;
        const schedule: MedicationSchedule = {
            id: generateId(),
            name: name.trim(),
            dosage: dosage.trim() || 'As prescribed',
            instructions: instructions.trim() || `Take ${name.trim()} at the scheduled time.`,
            scheduledTimes: cleanTimes,
            frequency: 'custom',
            reason: reason.trim() || 'User-added medication reminder.',
            isActive: true,
        };
        try {
            await addMedicationSchedule(schedule);
            setSchedules((prev) => [...prev, schedule]);
            setName(''); setDosage(''); setInstructions(''); setReason('');
            setTimes(['08:00']);
            setShowForm(false);
        } catch (e) {
            console.error('Error saving medication schedule:', e);
        }
    };

    return (
        <div className="flex flex-col gap-4 p-4" style={{ perspective: '1200px' }}>
            {/* Active due alerts */}
            {alerts.map((alert) => (
                <div
                    key={`${alert.schedule.id}-${alert.scheduledTimeToday}`}
                    className={`card card-enhanced backdrop-blur-xl border border-border bg-glass transition-all ${
                        alert.isEscalatedToCaregiver ? 'ring-2 ring-red-500/60' : ''
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-lg text-white">{alert.schedule.name}</h3>
                            <p className="text-sm text-dim">
                                {alert.schedule.dosage} – due {alert.timeLabel}{' '}
                                {alert.isEscalatedToCaregiver && (
                                    <span className="ml-2 px-2 py-0.5 bg-red-600/20 text-red-300 text-xs rounded">Escalated</span>
                                )}
                            </p>
                        </div>
                        <button
                            onClick={() => handleConfirm(alert)}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
                        >
                            Taken
                        </button>
                    </div>
                </div>
            ))}

            {/* Saved reminders (3D tilt cards) */}
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>Saved Reminders</h3>
                <button
                    onClick={() => setShowForm((s) => !s)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-bold transition"
                    style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', boxShadow: '0 8px 20px -8px rgba(139,92,246,0.7)' }}
                >
                    {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? 'Cancel' : 'Add Medicine'}
                </button>
            </div>

            {schedules.length === 0 && !showForm && (
                <p className="text-sm text-dim text-center italic">No medication reminders yet. Add one above.</p>
            )}

            {schedules.map((s) => (
                <TiltCard key={s.id} className="card card-enhanced" maxTilt={7}>
                    <div className="flex items-start gap-3 p-3.5">
                        <div style={{ background: 'linear-gradient(135deg, #c4b5fd, #f9a8d4)', padding: '0.6rem', borderRadius: '0.9rem', boxShadow: '0 10px 22px -10px rgba(178,138,240,0.8)', transform: 'translateZ(30px)' }}>
                            <Pill size={20} color="white" />
                        </div>
                        <div className="flex-1" style={{ transform: 'translateZ(20px)' }}>
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold" style={{ color: 'var(--text)' }}>{s.name}</h4>
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.15)', color: '#7c3aed' }}>{s.dosage}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {s.scheduledTimes.map((t) => (
                                    <span key={t} className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.14)', color: '#047857' }}>
                                        <Clock size={11} /> {formatTimeLabel(t)}
                                    </span>
                                ))}
                            </div>
                            <p className="text-xs text-dim mt-2">{s.instructions}</p>
                        </div>
                    </div>
                </TiltCard>
            ))}

            {/* Add-medicine form */}
            {showForm && (
                <div className="card card-enhanced p-4 flex flex-col gap-3" style={{ background: 'rgba(255,255,255,0.75)' }}>
                    <div>
                        <label style={labelStyle}>Medicine name</label>
                        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Donepezil (Aricept)" />
                    </div>
                    <div>
                        <label style={labelStyle}>Dosage</label>
                        <input style={inputStyle} value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="e.g. 10mg" />
                    </div>
                    <div>
                        <label style={labelStyle}>Reminder times</label>
                        <div className="flex flex-wrap gap-2">
                            {times.map((t, i) => (
                                <div key={i} className="flex items-center gap-1">
                                    <input
                                        type="time"
                                        style={{ ...inputStyle, width: 'auto' }}
                                        value={t}
                                        onChange={(e) => setTimes((prev) => prev.map((x, xi) => (xi === i ? e.target.value : x)))}
                                    />
                                    {times.length > 1 && (
                                        <button onClick={() => setTimes((prev) => prev.filter((_, xi) => xi !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b45309' }}>
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                onClick={() => setTimes((prev) => [...prev, '12:00'])}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                                style={{ background: 'rgba(139,92,246,0.14)', color: '#7c3aed', border: '1px solid rgba(139,92,246,0.35)', cursor: 'pointer' }}
                            >
                                <Plus size={12} /> Add time
                            </button>
                        </div>
                    </div>
                    <div>
                        <label style={labelStyle}>Instructions</label>
                        <input style={inputStyle} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Take with breakfast and water" />
                    </div>
                    <div>
                        <label style={labelStyle}>Reason (optional)</label>
                        <input style={inputStyle} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Memory support" />
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={!name.trim() || times.every((t) => !/^\d{2}:\d{2}$/.test(t))}
                        className="px-4 py-2.5 rounded-full text-white font-bold transition disabled:opacity-40"
                        style={{ background: 'linear-gradient(135deg, #34d399, #10b981)', boxShadow: '0 12px 26px -12px rgba(16,185,129,0.8)', cursor: 'pointer' }}
                    >
                        Save Reminder
                    </button>
                </div>
            )}
        </div>
    );
}
