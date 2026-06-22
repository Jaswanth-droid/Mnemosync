import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Calendar as CalendarIcon, Info, X, Check } from 'lucide-react';
import { updateDate } from './memoryDatabase';

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

    if (!task) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="modal-card"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-content">
                    <div className="flex justify-between items-center mb-4" style={{ paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <h3 className="font-bold text-white" style={{ fontSize: '1.25rem' }}>{task.event.split(' on ')[0]}</h3>
                        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                            <X size={20} />
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Info size={16} color="#f472b6" />
                                <h4 className="text-sm font-bold" style={{ color: '#d1d5db' }}>Description</h4>
                            </div>
                            <p className="text-sm text-dim" style={{ paddingLeft: '1.5rem', lineHeight: '1.5' }}>
                                {task.description || "No specific details were mentioned in the conversation."}
                            </p>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <CalendarIcon size={16} color="#34d399" />
                                <h4 className="text-sm font-bold" style={{ color: '#d1d5db' }}>Date</h4>
                            </div>
                            <p className="text-sm text-dim" style={{ paddingLeft: '1.5rem' }}>
                                {new Date(task.rawDate || Date.now()).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div className="flex items-center gap-2 mb-2">
                                <Clock size={16} color="#60a5fa" />
                                <h4 className="text-sm font-bold" style={{ color: '#d1d5db' }}>Time Tracking</h4>
                            </div>
                            
                            {task.hasExactTime && !isEditingTime ? (
                                <div className="flex flex-col items-center" style={{ padding: '1rem 0' }}>
                                    <div style={{ fontSize: '1.5rem', fontFamily: 'monospace', color: 'white', letterSpacing: '2px', textShadow: '0 0 20px rgba(96, 165, 250, 0.4)' }}>
                                        {timeLeft}
                                    </div>
                                    <button onClick={() => setIsEditingTime(true)} style={{ background: 'transparent', border: 'none', fontSize: '0.75rem', color: '#60a5fa', marginTop: '0.5rem', textDecoration: 'underline', cursor: 'pointer', opacity: 0.8 }}>
                                        Change Time
                                    </button>
                                </div>
                            ) : (
                                <div style={{ paddingLeft: '1.5rem' }}>
                                    {!isEditingTime && (
                                        <div className="flex flex-col" style={{ alignItems: 'flex-start', gap: '0.75rem' }}>
                                            <span className="text-sm text-dim">No exact time was set for this task.</span>
                                            <button 
                                                onClick={() => setIsEditingTime(true)}
                                                style={{ padding: '0.5rem 1rem', background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', borderRadius: '0.5rem', fontSize: '0.875rem', border: '1px solid rgba(59, 130, 246, 0.3)', cursor: 'pointer', fontWeight: 500 }}
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
                                                style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', color: 'white', outline: 'none' }}
                                            />
                                            <button 
                                                onClick={handleSaveTime}
                                                style={{ padding: '0.5rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', borderRadius: '0.5rem', border: '1px solid rgba(16, 185, 129, 0.3)', cursor: 'pointer' }}
                                            >
                                                <Check size={18} />
                                            </button>
                                            <button 
                                                onClick={() => setIsEditingTime(false)}
                                                style={{ padding: '0.5rem', background: 'rgba(107, 114, 128, 0.2)', color: '#9ca3af', borderRadius: '0.5rem', border: '1px solid rgba(107, 114, 128, 0.3)', cursor: 'pointer' }}
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
