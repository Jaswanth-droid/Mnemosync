import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mic, Camera, MessageCircle } from 'lucide-react';
import { getAllPeople, getAllConversations, type PersonRecord } from './memoryDatabase';

/**
 * "Who is this?" recall card.
 *
 * The single most common distress moment for an Alzheimer's patient is not
 * recognising someone in front of them. When a voice or face is matched, this
 * card appears large and calm with the person's name, relationship, photo and
 * the last thing you talked about — so one glance is enough to remember.
 */
export interface RecognizedPerson {
    name: string;
    relation: string;
    source: 'voice' | 'face';
    ts: number;
}

interface RecallCardProps {
    person: RecognizedPerson | null;
    patientName?: string;
    onDismiss?: () => void;
}

export default function RecallCard({ person, patientName = 'User', onDismiss }: RecallCardProps) {
    const [record, setRecord] = useState<PersonRecord | null>(null);
    const [lastChat, setLastChat] = useState<string>('');

    useEffect(() => {
        let alive = true;
        if (!person) { setRecord(null); setLastChat(''); return; }
        (async () => {
            try {
                const people = await getAllPeople();
                const match = people.find(p => p.name.toLowerCase() === person.name.toLowerCase()) || null;
                const convos = await getAllConversations();
                const relevant = convos.find(c => c.participants?.some(pt => pt.toLowerCase() === person.name.toLowerCase()));
                if (alive) {
                    setRecord(match);
                    setLastChat(relevant?.summary || match?.conversationContext || '');
                }
            } catch {
                if (alive) { setRecord(null); setLastChat(''); }
            }
        })();
        return () => { alive = false; };
    }, [person]);

    return (
        <AnimatePresence>
            {person && (
                <motion.div
                    initial={{ opacity: 0, y: 24, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 24, scale: 0.96 }}
                    transition={{ type: 'spring', damping: 24, stiffness: 260 }}
                    className="card"
                    style={{
                        background: 'linear-gradient(135deg, rgba(221,208,247,0.85), rgba(249,200,221,0.7))',
                        border: '1px solid rgba(167,139,250,0.5)',
                        boxShadow: '0 20px 50px rgba(167,139,250,0.35)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                >
                    <div className="flex items-center gap-2 mb-3">
                        {person.source === 'voice' ? <Mic size={14} style={{ color: '#6d5ba8' }} /> : <Camera size={14} style={{ color: '#6d5ba8' }} />}
                        <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#6d5ba8' }}>
                            {person.source === 'voice' ? 'Voice recognised' : 'Face recognised'}
                        </span>
                        {onDismiss && (
                            <button onClick={onDismiss} className="ml-auto text-[11px] px-2 py-0.5 rounded-lg"
                                style={{ background: 'rgba(255,255,255,0.6)', color: '#5b4b7a', border: '1px solid rgba(167,139,250,0.3)' }}>
                                Dismiss
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        <div style={{
                            width: 72, height: 72, borderRadius: '1rem', overflow: 'hidden', flexShrink: 0,
                            background: 'linear-gradient(135deg,#c4b5fd,#f9a8d4)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 0 25px rgba(167,139,250,0.5)'
                        }}>
                            {record?.faceImage
                                ? <img src={record.faceImage} alt={person.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <User size={34} color="#4b3f63" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-dim">You're with</p>
                            <h2 className="font-bold leading-tight" style={{ fontSize: '1.6rem', color: '#3b2f4a' }}>{person.name}</h2>
                            <p className="text-sm" style={{ color: '#6d5ba8', fontWeight: 600 }}>{person.relation || 'Someone who cares about you'}</p>
                        </div>
                    </div>

                    {lastChat && (
                        <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(167,139,250,0.3)' }}>
                            <div className="flex items-center gap-2 mb-1">
                                <MessageCircle size={12} style={{ color: '#7c6bc4' }} />
                                <span className="text-[11px] font-bold" style={{ color: '#7c6bc4' }}>Last time you talked</span>
                            </div>
                            <p className="text-xs" style={{ color: '#5b4b7a', fontStyle: 'italic' }}>{lastChat}</p>
                        </div>
                    )}

                    <p className="text-xs mt-3" style={{ color: '#6d5ba8' }}>
                        Hello {patientName} — this is {person.name}. You're safe, and you're not alone.
                    </p>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
