// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { Check, AlarmClockOff, Clock } from 'lucide-react';
import { MedicationSchedule, getMedicationSchedules, SCHEDULES_CHANGED_EVENT } from './memoryDatabase';
import { chimePlayer, logMedicationAdherence } from './medicationReminder';

interface FiringAlarm {
    schedule: MedicationSchedule;
    timeStr: string;          // e.g. '08:00'
    doseKey: string;          // e.g. 'med-donepezil|2026-09-16|08:00'
    scheduledTimeToday: string; // ISO string for adherence logging
}

interface SnoozedAlarm extends FiringAlarm {
    fireAt: number;           // epoch ms when the snoozed alarm should re-fire
}

const SNOOZE_MS = 5 * 60 * 1000;      // 5 minutes
const ACK_STORAGE_KEY = 'mnemosync_alarm_ack_v1';

function readAck(): Record<string, string> {
    try {
        return JSON.parse(localStorage.getItem(ACK_STORAGE_KEY) || '{}');
    } catch {
        return {};
    }
}

function writeAck(key: string, status: 'taken' | 'dismissed') {
    const ack = readAck();
    ack[key] = status;
    localStorage.setItem(ACK_STORAGE_KEY, JSON.stringify(ack));
}

function isResolved(key: string): boolean {
    const val = readAck()[key];
    return val === 'taken' || val === 'dismissed';
}

function Pill3D() {
    const group = useRef<THREE.Group>(null);
    const ringA = useRef<THREE.Mesh>(null);
    const ringB = useRef<THREE.Mesh>(null);

    useFrame((state, delta) => {
        const t = state.clock.elapsedTime;
        if (group.current) {
            group.current.rotation.y += delta * 1.1;
            group.current.rotation.z = Math.sin(t * 0.9) * 0.22;
        }
        if (ringA.current) {
            ringA.current.rotation.x = t * 0.9;
            ringA.current.rotation.y = t * 0.5;
        }
        if (ringB.current) {
            ringB.current.rotation.y = -t * 0.7;
            ringB.current.rotation.z = t * 0.4;
        }
    });

    return (
        <group>
            <Float speed={2} rotationIntensity={0.4} floatIntensity={0.8}>
                <group ref={group} rotation={[0.5, 0, 0.3]}>
                    {/* Capsule top half */}
                    <mesh position={[0, 0.55, 0]}>
                        <capsuleGeometry args={[0.55, 0.6, 12, 32]} />
                        <meshStandardMaterial color="#f9a8d4" roughness={0.25} metalness={0.1} emissive="#f9a8d4" emissiveIntensity={0.25} />
                    </mesh>
                    {/* Capsule bottom half */}
                    <mesh position={[0, -0.55, 0]}>
                        <capsuleGeometry args={[0.55, 0.6, 12, 32]} />
                        <meshStandardMaterial color="#ffffff" roughness={0.2} metalness={0.05} emissive="#ffffff" emissiveIntensity={0.15} />
                    </mesh>
                    {/* Seam band */}
                    <mesh>
                        <cylinderGeometry args={[0.56, 0.56, 0.12, 32]} />
                        <meshStandardMaterial color="#c4b5fd" roughness={0.3} emissive="#c4b5fd" emissiveIntensity={0.3} />
                    </mesh>
                </group>
            </Float>
            <mesh ref={ringA} rotation={[0.6, 0, 0]}>
                <torusGeometry args={[1.5, 0.03, 16, 64]} />
                <meshStandardMaterial color="#f9a8d4" emissive="#f9a8d4" emissiveIntensity={0.6} roughness={0.2} />
            </mesh>
            <mesh ref={ringB} rotation={[0, 0.5, 0.4]}>
                <torusGeometry args={[1.8, 0.025, 16, 64]} />
                <meshStandardMaterial color="#a5b8f3" emissive="#a5b8f3" emissiveIntensity={0.6} roughness={0.2} />
            </mesh>
            <Sparkles count={60} scale={[5, 4, 4]} size={3} speed={0.5} opacity={0.8} color="#ffffff" />
        </group>
    );
}

function PillScene() {
    return (
        <Canvas
            dpr={[1, 2]}
            camera={{ position: [0, 0, 5], fov: 45 }}
            gl={{ antialias: true, alpha: true }}
            style={{ width: '100%', height: '150px', pointerEvents: 'none' }}
        >
            <ambientLight intensity={1.4} color="#fff2f9" />
            <directionalLight position={[4, 5, 6]} intensity={1.4} color="#ffe0ef" />
            <pointLight position={[-4, -2, 4]} intensity={0.8} color="#cfe3ff" />
            <Pill3D />
        </Canvas>
    );
}

/**
 * MedicationAlarm
 *
 * Watches the clock and fires a full-screen, phone-timer-style alarm popup the
 * moment a scheduled medication time is reached (not 30 minutes before — the
 * exact minute). Plays a repeating chime and speaks the reminder aloud.
 * Taken / Snooze / Dismiss actions are persisted per-dose-per-day so the same
 * alarm never re-fires.
 */
export default function MedicationAlarm() {
    const [schedules, setSchedules] = useState<MedicationSchedule[]>([]);
    const [alarm, setAlarm] = useState<FiringAlarm | null>(null);
    const alarmRef = useRef<FiringAlarm | null>(null);
    const snoozeQueue = useRef<SnoozedAlarm[]>([]);
    alarmRef.current = alarm;

    useEffect(() => {
        let mounted = true;
        const load = () => getMedicationSchedules().then((s) => { if (mounted) setSchedules(s); }).catch(() => {});
        load();
        window.addEventListener(SCHEDULES_CHANGED_EVENT, load);
        return () => {
            mounted = false;
            window.removeEventListener(SCHEDULES_CHANGED_EVENT, load);
        };
    }, []);

    useEffect(() => {
        function announce(schedule: MedicationSchedule) {
            if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
            try {
                const u = new SpeechSynthesisUtterance(
                    `Medication reminder. It is time to take ${schedule.name}, ${schedule.dosage}. ${schedule.instructions}`
                );
                u.rate = 0.92;
                u.pitch = 1.05;
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(u);
            } catch { /* ignore */ }
        }

        function fire(next: FiringAlarm) {
            setAlarm(next);
            chimePlayer.startRepeatingChime(60000);
            announce(next.schedule);
        }

        function tick() {
            // Don't stack a second alarm on top of one already firing
            if (alarmRef.current) return;

            // 1. Re-fire any snoozed alarm whose snooze window has elapsed
            const due = snoozeQueue.current.find((s) => s.fireAt <= Date.now() && !isResolved(s.doseKey));
            if (due) {
                snoozeQueue.current = snoozeQueue.current.filter((s) => s.doseKey !== due.doseKey);
                fire(due);
                return;
            }

            // 2. Check for a fresh exact-time alarm
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const hh = now.getHours().toString().padStart(2, '0');
            const mm = now.getMinutes().toString().padStart(2, '0');
            const currentTime = `${hh}:${mm}`;

            for (const schedule of schedules) {
                if (!schedule.isActive) continue;
                for (const timeStr of schedule.scheduledTimes) {
                    if (timeStr !== currentTime) continue;
                    const doseKey = `${schedule.id}|${today}|${timeStr}`;
                    if (isResolved(doseKey)) continue;

                    const [h, m] = timeStr.split(':').map(Number);
                    const schedDate = new Date(now);
                    schedDate.setHours(h, m, 0, 0);

                    fire({
                        schedule,
                        timeStr,
                        doseKey,
                        scheduledTimeToday: schedDate.toISOString(),
                    });
                    return;
                }
            }
        }

        tick();
        const interval = window.setInterval(tick, 15000);
        return () => window.clearInterval(interval);
    }, [schedules]);

    async function handleTaken() {
        const a = alarmRef.current;
        if (!a) return;
        try {
            await logMedicationAdherence(a.schedule, a.scheduledTimeToday, 'Patient', 'Confirmed from exact-time alarm.');
        } catch (e) {
            console.error('[MedicationAlarm] adherence log failed:', e);
        }
        writeAck(a.doseKey, 'taken');
        stopAlarm();
    }

    function handleSnooze() {
        const a = alarmRef.current;
        if (!a) return;
        snoozeQueue.current = snoozeQueue.current.filter((s) => s.doseKey !== a.doseKey);
        snoozeQueue.current.push({ ...a, fireAt: Date.now() + SNOOZE_MS });
        stopAlarm();
    }

    function handleDismiss() {
        const a = alarmRef.current;
        if (!a) return;
        writeAck(a.doseKey, 'dismissed');
        stopAlarm();
    }

    function stopAlarm() {
        chimePlayer.stopRepeatingChime();
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        setAlarm(null);
    }

    return (
        <AnimatePresence>
            {alarm && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 10000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(30, 20, 45, 0.55)',
                        backdropFilter: 'blur(10px)',
                        padding: '1.5rem',
                    }}
                >
                    <motion.div
                        initial={{ scale: 0.85, y: 30 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20, opacity: 0 }}
                        transition={{ type: 'spring', damping: 22, stiffness: 280 }}
                        style={{
                            width: '100%',
                            maxWidth: '420px',
                            borderRadius: '2rem',
                            background: 'linear-gradient(160deg, #fff7fb 0%, #f3f0ff 55%, #eefbf5 100%)',
                            boxShadow: '0 40px 80px -30px rgba(120, 80, 200, 0.7)',
                            border: '1px solid rgba(167, 139, 250, 0.35)',
                            overflow: 'hidden',
                            textAlign: 'center',
                        }}
                    >
                        {/* Pulsing header */}
                        <div
                            style={{
                                padding: '2rem 1.5rem 1.25rem',
                                background: 'linear-gradient(135deg, #c4b5fd, #f9a8d4)',
                                color: 'white',
                                position: 'relative',
                            }}
                        >
                            <div style={{ height: '150px', margin: '0 auto', position: 'relative' }}>
                                <PillScene />
                            </div>
                            <div style={{ fontSize: '2.6rem', fontWeight: 800, letterSpacing: '0.04em', lineHeight: 1 }}>
                                {alarm.timeStr}
                            </div>
                            <div style={{ fontSize: '0.8rem', letterSpacing: '0.22em', textTransform: 'uppercase', opacity: 0.92, marginTop: '0.4rem', fontWeight: 700 }}>
                                Medication Time
                            </div>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#3b2f52', margin: 0 }}>
                                {alarm.schedule.name}
                            </h2>
                            <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#8b5cf6', marginTop: '0.25rem' }}>
                                {alarm.schedule.dosage}
                            </p>
                            <p style={{ fontSize: '0.9rem', color: 'rgba(71,63,82,0.85)', marginTop: '0.75rem', lineHeight: 1.6 }}>
                                {alarm.schedule.instructions}
                            </p>
                            {alarm.schedule.reason && (
                                <p style={{ fontSize: '0.78rem', color: 'rgba(71,63,82,0.6)', marginTop: '0.6rem', fontStyle: 'italic' }}>
                                    Why: {alarm.schedule.reason}
                                </p>
                            )}

                            {/* Actions */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '1.5rem' }}>
                                <button
                                    onClick={handleTaken}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                        padding: '0.95rem', borderRadius: '999px', border: 'none', cursor: 'pointer',
                                        background: 'linear-gradient(135deg, #34d399, #10b981)', color: 'white',
                                        fontSize: '1.05rem', fontWeight: 800, letterSpacing: '0.02em',
                                        boxShadow: '0 12px 26px -12px rgba(16,185,129,0.8)',
                                    }}
                                >
                                    <Check size={20} /> I've Taken It
                                </button>
                                <div style={{ display: 'flex', gap: '0.6rem' }}>
                                    <button
                                        onClick={handleSnooze}
                                        style={{
                                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                                            padding: '0.8rem', borderRadius: '999px', cursor: 'pointer',
                                            background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.4)',
                                            color: '#b45309', fontSize: '0.9rem', fontWeight: 700,
                                        }}
                                    >
                                        <Clock size={16} /> Snooze 5m
                                    </button>
                                    <button
                                        onClick={handleDismiss}
                                        style={{
                                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                                            padding: '0.8rem', borderRadius: '999px', cursor: 'pointer',
                                            background: 'rgba(148,120,220,0.12)', border: '1px solid rgba(148,120,220,0.35)',
                                            color: '#6d5ba8', fontSize: '0.9rem', fontWeight: 700,
                                        }}
                                    >
                                        <AlarmClockOff size={16} /> Dismiss
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
