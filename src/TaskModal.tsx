import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Calendar as CalendarIcon, Info, X, Check, Trash2, CheckCircle2, User, MessageSquare } from 'lucide-react';
import { updateDate, deleteDate } from './memoryDatabase';
import { cleanEventTitle } from './nlpExtractor';

export default function TaskModal({ task, onClose, onUpdate }: { task: any; onClose: () => void; onUpdate: () => void }) {
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [timeInput, setTimeInput] = useState('');
    const [isEditingTime, setIsEditingTime] = useState(false);

    useEffect(() => {
        let interval: any;
        if (task?.hasExactTime && task?.rawDate) {
            const calculateTimeLeft = () => {
                const target = new Date(task.rawDate).getTime();
                const now = new Date().getTime();
                const diff = target - now;
                
                if (diff <= 0) {
                    setTimeLeft('Time is up!');
                } else {
                    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    const s = Math.floor((diff % (1000 * 60)) / 1000);
                    setTimeLeft(`${h}h ${m}m ${s}s remaining`);
                }
            };
            calculateTimeLeft();
            interval = setInterval(calculateTimeLeft, 1000);
        }
        return () => clearInterval(interval);
    }, [task]);

    const handleSaveTime = async () => {
        if (!timeInput) return;
        const [hours, minutes] = timeInput.split(':').map(Number);
        const newDate = new Date(task.rawDate || Date.now());
        newDate.setHours(hours, minutes, 0, 0);

        try {
            await updateDate({
                id: task.id,
                date: newDate.toISOString(),
                event: task.event,
                description: task.description,
                hasExactTime: true,
                type: task.type === 'action' ? 'reminder' : 'appointment',
                createdAt: newDate
            });
            setIsEditingTime(false);
            onUpdate(); // Reload tasks
            task.rawDate = newDate.toISOString();
            task.hasExactTime = true;
        } catch (e) {
            console.error('Error updating time', e);
        }
    };

    const handleDelete = async () => {
        try {
            await deleteDate(task.id);
        } catch (e) {}
        onUpdate();
        onClose();
    };

    if (!task) return null;

    const displayTitle = cleanEventTitle(task.event, task.speaker);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="modal-card"
                onClick={(e) => e.stopPropagation()}
                style={{
                    maxWidth: '520px',
                    background: 'linear-gradient(135deg, rgba(26, 26, 46, 0.98), rgba(18, 18, 32, 0.98))',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(52, 211, 153, 0.12)'
                }}
            >
                <div className="modal-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="flex justify-between items-center" style={{ paddingBottom: '0.85rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div style={{
                                background: task.type === 'action' ? 'linear-gradient(135deg, #ef4444, #f97316)' : 'linear-gradient(135deg, #10b981, #34d399)',
                                padding: '0.5rem',
                                borderRadius: '0.65rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {task.type === 'action' ? <CheckCircle2 size={18} color="white" /> : <CalendarIcon size={18} color="white" />}
                            </div>
                            <div>
                                <h3 className="font-bold text-white" style={{ fontSize: '1.25rem', margin: 0 }}>
                                    {displayTitle}
                                </h3>
                                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                    {task.type === 'action' ? 'Action / Reminder' : 'Upcoming Event / Occasion'}
                                </span>
                            </div>
                        </div>
                        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: '#9ca3af', cursor: 'pointer', padding: '0.4rem' }}>
                            <X size={18} />
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* Description & Spoken Details */}
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <MessageSquare size={16} color="#38bdf8" />
                                <h4 className="text-sm font-bold" style={{ color: '#d1d5db' }}>Conversation Details & Extra Notes</h4>
                            </div>
                            {task.description ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '0.85rem', borderRadius: '0.75rem', maxHeight: '160px', overflowY: 'auto' }}>
                                    {task.description.split('\n').map((line: string, idx: number) => {
                                        const cleanLine = line.replace(/^[•\-\s]+/, '');
                                        if (!cleanLine.trim()) return null;
                                        return (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                                                <span style={{ color: '#38bdf8', marginTop: '1px' }}>💬</span>
                                                <span>{cleanLine}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-dim" style={{ paddingLeft: '0.5rem', lineHeight: '1.5' }}>
                                    No specific details were mentioned in the conversation yet.
                                </p>
                            )}
                        </div>

                        {/* Date & Speaker info */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <CalendarIcon size={14} color="#34d399" />
                                    <h4 className="text-xs font-bold" style={{ color: '#9ca3af' }}>Scheduled Date</h4>
                                </div>
                                <p className="text-sm font-semibold text-white">
                                    {task.scheduled || new Date(task.rawDate || Date.now()).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                                </p>
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <User size={14} color="#ec4899" />
                                    <h4 className="text-xs font-bold" style={{ color: '#9ca3af' }}>Spoken By</h4>
                                </div>
                                <p className="text-sm font-semibold text-white">
                                    {task.speaker || 'Visitor / User'}
                                </p>
                            </div>
                        </div>

                        {/* Time Tracking */}
                        <div style={{ background: 'rgba(255,255,255,0.04)', padding: '1rem', borderRadius: '0.85rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div className="flex items-center gap-2 mb-2">
                                <Clock size={16} color="#60a5fa" />
                                <h4 className="text-sm font-bold" style={{ color: '#d1d5db' }}>Time Tracking & Countdown</h4>
                            </div>
                            
                            {task.hasExactTime && !isEditingTime ? (
                                <div className="flex flex-col items-center" style={{ padding: '0.5rem 0' }}>
                                    <div style={{ fontSize: '1.4rem', fontFamily: 'monospace', color: 'white', letterSpacing: '2px', textShadow: '0 0 20px rgba(96, 165, 250, 0.4)' }}>
                                        {timeLeft}
                                    </div>
                                    <button onClick={() => setIsEditingTime(true)} style={{ background: 'transparent', border: 'none', fontSize: '0.75rem', color: '#60a5fa', marginTop: '0.5rem', textDecoration: 'underline', cursor: 'pointer', opacity: 0.8 }}>
                                        Change Time
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    {!isEditingTime && (
                                        <div className="flex items-center justify-between" style={{ gap: '0.75rem' }}>
                                            <span className="text-xs text-dim">No exact time set for this task.</span>
                                            <button 
                                                onClick={() => setIsEditingTime(true)}
                                                style={{ padding: '0.4rem 0.85rem', background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', borderRadius: '0.5rem', fontSize: '0.8rem', border: '1px solid rgba(59, 130, 246, 0.3)', cursor: 'pointer', fontWeight: 500 }}
                                            >
                                                Set Exact Time
                                            </button>
                                        </div>
                                    )}
                                    
                                    {isEditingTime && (
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="time" 
                                                value={timeInput}
                                                onChange={(e) => setTimeInput(e.target.value)}
                                                style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem', padding: '0.4rem 0.65rem', color: 'white', outline: 'none' }}
                                            />
                                            <button 
                                                onClick={handleSaveTime}
                                                style={{ padding: '0.4rem 0.65rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', borderRadius: '0.5rem', border: '1px solid rgba(16, 185, 129, 0.3)', cursor: 'pointer' }}
                                            >
                                                <Check size={16} />
                                            </button>
                                            <button 
                                                onClick={() => setIsEditingTime(false)}
                                                style={{ padding: '0.4rem 0.65rem', background: 'rgba(107, 114, 128, 0.2)', color: '#9ca3af', borderRadius: '0.5rem', border: '1px solid rgba(107, 114, 128, 0.3)', cursor: 'pointer' }}
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.25rem' }}>
                            <button
                                onClick={handleDelete}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    padding: '0.5rem 0.85rem',
                                    borderRadius: '0.5rem',
                                    background: 'rgba(239, 68, 68, 0.12)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    color: '#f87171',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                <Trash2 size={14} />
                                Delete Task
                            </button>
                            <button
                                onClick={handleDelete}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    padding: '0.5rem 1.1rem',
                                    borderRadius: '0.5rem',
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    border: 'none',
                                    color: 'white',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
                                }}
                            >
                                <CheckCircle2 size={14} />
                                Mark Completed
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
