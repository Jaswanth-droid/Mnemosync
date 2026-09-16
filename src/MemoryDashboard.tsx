import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, MessageSquare, Users, Clock, ArrowLeft, ChevronLeft, ChevronRight, Brain } from 'lucide-react';
import {
    getAllDates,
    getAllConversations,
    getAllPeople,
    ImportantDate,
    ConversationRecord,
    PersonRecord
} from './memoryDatabase';
import { cleanEventTitle } from './nlpExtractor';

interface MemoryDashboardProps {
    isOpen: boolean;
    onClose: () => void;
}

type TabType = 'dates' | 'conversations' | 'people' | 'notes';

// Helper to accurately classify speaker as User vs Visitor
function isUserSpeaker(speaker?: string, text?: string, participants?: string[]): boolean {
    const s = (speaker || '').toLowerCase().trim();
    const t = (text || '').toLowerCase().trim();

    // 1. Explicit user/self identities
    if (['you', 'user', 'patient', 'me', 'self', 'owner', 'host', 'sunita', 'sunita sharma'].includes(s)) {
        return true;
    }

    // 2. Explicit match against visitor participants (e.g. "Rakesh", "Arjun", "Priya")
    if (participants && participants.length > 0) {
        const matchesVisitor = participants.some(p => {
            const pNorm = p.toLowerCase().trim();
            return !['user', 'you', 'patient', 'sunita', 'sunita sharma', 'owner'].includes(pNorm) &&
                   (s === pNorm || s.includes(pNorm) || (pNorm.length > 2 && s.startsWith(pNorm)));
        });
        if (matchesVisitor) {
            return false;
        }
    }

    if (['visitor', 'guest', 'doctor', 'nurse', 'caregiver', 'family'].includes(s)) {
        return false;
    }

    // 3. Conversational linguistics based on message content
    // User / host typical questions and polite responses:
    if (/^(?:hi|hello|hey|good\s+morning|good\s+afternoon|good\s+evening)[,\s]*(?:what\s+(?:is\s+your\s+name|brings\s+you\s+here)|who\s+are\s+you|how\s+can\s+i\s+help|sure\s+i(?:'ll|\s+will)\s+be\s+there|sure[,\s!]|thank\s+you|welcome)/i.test(t) ||
        /^(?:what\s+(?:is\s+your\s+name|brings\s+you\s+here)|who\s+are\s+you|how\s+are\s+you|how\s+can\s+i\s+help|sure\s+i(?:'ll|\s+will)\s+be\s+there|sure[,\s!]|thank\s+you|welcome)/i.test(t)) {
        return true;
    }

    // Visitor typical responses / introductions / statements:
    if (/^(?:my\s+name\s+is|i\s+am\s+|i'm\s+|i\s+came\s+to|i\s+am\s+here\s+for|i'm\s+here\s+for|we\s+will\s+be\s+having|tomorrow\s+i\s+have|i\s+have\s+my|actually\s+i)/i.test(t)) {
        return false;
    }

    // Default fallback: if speaker includes 'you' or 'user'
    return s.includes('you') || s.includes('user') || s.includes('patient');
}

export default function MemoryDashboard({ isOpen, onClose }: MemoryDashboardProps) {
    const [dates, setDates] = useState<ImportantDate[]>([]);
    const [conversations, setConversations] = useState<ConversationRecord[]>([]);
    const [people, setPeople] = useState<PersonRecord[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>('dates');
    const [selectedConvo, setSelectedConvo] = useState<ConversationRecord | null>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [hoveredDay, setHoveredDay] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadAllData();
            const interval = setInterval(loadAllData, 5000);
            return () => clearInterval(interval);
        }
    }, [isOpen]);

    const loadAllData = async () => {
        const [datesData, convosData, peopleData] = await Promise.all([
            getAllDates(),
            getAllConversations(),
            getAllPeople()
        ]);

        // Auto-seed if empty OR if images are missing in existing people
        const needsImages = peopleData.length > 0 && peopleData.some(p => !p.faceImage && ['Arjun Sharma', 'Priya Patel', 'Rajesh Kumar', 'Ananya Iyer'].includes(p.name));

        if ((convosData.length === 0 && peopleData.length === 0) || needsImages) {
            console.log('[Dashboard] Seeding or updating mock data for images...');
            await seedMockData();
            // Reload after seeding
            const [newDates, newConvos, newPeople] = await Promise.all([
                getAllDates(),
                getAllConversations(),
                getAllPeople()
            ]);
            setDates(newDates);
            setConversations(newConvos);
            setPeople(newPeople);
        } else {
            setDates(datesData);
            setConversations(convosData);
            setPeople(peopleData);
        }
    };

    const seedMockData = async () => {
        const { updatePerson, addConversation, getAllConversations, getAllPeople, deletePerson, generateId } = await import('./memoryDatabase');

        // 1. Database Cleansing - Remove duplicates (same names but wrong IDs)
        const allPeople = await getAllPeople();
        const mockNames = ['Arjun Sharma', 'Priya Patel', 'Rajesh Kumar', 'Ananya Iyer'];
        const mockIds = ['mock-arjun', 'mock-priya', 'mock-rajesh', 'mock-ananya'];

        for (const person of allPeople) {
            if (mockNames.includes(person.name) && !mockIds.includes(person.id)) {
                console.log(`[Dashboard] Deleting duplicate: ${person.name} (${person.id})`);
                await deletePerson(person.id);
            }
        }

        // 2. Seed/Update People with Stable IDs
        const mockPeople = [
            {
                id: 'mock-arjun',
                name: 'Arjun Sharma',
                relation: 'Colleague',
                faceImage: '/arjun.jpg',
                firstSeen: new Date(),
                lastSeen: new Date(),
                conversationContext: 'Tech Lead'
            },
            {
                id: 'mock-priya',
                name: 'Priya Patel',
                relation: 'Friend',
                faceImage: 'https://images.unsplash.com/photo-1618331835717-801e976710b2?w=150&h=150&fit=crop',
                firstSeen: new Date(),
                lastSeen: new Date(),
                conversationContext: 'UX Designer'
            },
            {
                id: 'mock-rajesh',
                name: 'Rajesh Kumar',
                relation: 'Mentor',
                faceImage: '/rajesh.jpg',
                firstSeen: new Date(),
                lastSeen: new Date(),
                conversationContext: 'Senior Project Manager'
            },
            {
                id: 'mock-ananya',
                name: 'Ananya Iyer',
                relation: 'Client',
                faceImage: '/ananya.jpg',
                firstSeen: new Date(),
                lastSeen: new Date(),
                conversationContext: 'Product Owner'
            }
        ];

        for (const person of mockPeople) {
            await updatePerson(person as any);
        }

        // 3. Seed Conversations (only if truly empty to avoid duplicates)
        const currentConvos = await getAllConversations();
        if (currentConvos.length === 0) {
            const mockConvos = [
                {
                    id: generateId(),
                    timestamp: new Date(Date.now() - 1000 * 60 * 23),
                    participants: ['Arjun Sharma'],
                    summary: 'Team Sync - Discussed API endpoints.',
                    fullTranscript: [
                        { speaker: 'You', text: 'Hi Arjun, how is the backend API integration progressing?', timestamp: new Date(Date.now() - 1000 * 60 * 25) },
                        { speaker: 'Arjun Sharma', text: 'It is going smoothly! We finalized the endpoints today.', timestamp: new Date(Date.now() - 1000 * 60 * 24) },
                        { speaker: 'You', text: 'Wonderful, let us review them tomorrow morning.', timestamp: new Date(Date.now() - 1000 * 60 * 23) }
                    ]
                },
                {
                    id: generateId(),
                    timestamp: new Date(Date.now() - 1000 * 60 * 30),
                    participants: ['Priya Patel'],
                    summary: 'UX Review - Finalized layout designs.',
                    fullTranscript: [
                        { speaker: 'Priya Patel', text: 'Hello! I brought the updated high-contrast layout designs for review.', timestamp: new Date(Date.now() - 1000 * 60 * 33) },
                        { speaker: 'You', text: 'Thanks Priya, the high-contrast view makes text very easy to read.', timestamp: new Date(Date.now() - 1000 * 60 * 31) },
                        { speaker: 'Priya Patel', text: 'Glad you like it! I will deploy the changes to the dashboard now.', timestamp: new Date(Date.now() - 1000 * 60 * 30) }
                    ]
                },
                {
                    id: generateId(),
                    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
                    participants: ['Ananya Iyer'],
                    summary: 'Project Delta - Finalized requirements.',
                    fullTranscript: [
                        { speaker: 'You', text: 'Hi Ananya, what are the next milestones for Delta?', timestamp: new Date(Date.now() - 1000 * 60 * 125) },
                        { speaker: 'Ananya Iyer', text: 'We are completing the memory sync engine this week.', timestamp: new Date(Date.now() - 1000 * 60 * 122) },
                        { speaker: 'You', text: 'Great, keep me posted on the deployment.', timestamp: new Date(Date.now() - 1000 * 60 * 120) }
                    ]
                }
            ];

            for (const convo of mockConvos) {
                await addConversation(convo as any);
            }
        }
    };

    const formatTimeAgo = (date: Date) => {
        const diff = Date.now() - new Date(date).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return new Date(date).toLocaleDateString();
    };

    const PersonCard = ({ person }: { person: any }) => {
        const [imgError, setImgError] = useState(false);
        const hasValidImg = person.faceImage && !imgError;

        return (
            <div style={{
                padding: '12px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                minHeight: '110px'
            }} className="hover:scale-105 hover:bg-white/[0.06] hover:border-white/20">
                <div style={{
                    width: '52px', height: '52px', borderRadius: '50%', marginBottom: '10px',
                    background: hasValidImg ? 'transparent' : 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', border: '2px solid rgba(59, 130, 246, 0.4)',
                    boxShadow: '0 0 10px rgba(59, 130, 246, 0.2)'
                }}>
                    {hasValidImg ? (
                        <img
                            src={person.faceImage}
                            alt=""
                            onError={() => setImgError(true)}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    ) : (
                        <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>{person.name[0]}</span>
                    )}
                </div>
                <h4 style={{ color: 'white', fontSize: '13px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, width: '100%' }}>{person.name}</h4>
                <p style={{ color: '#9ca3af', fontSize: '11px', margin: '4px 0 0 0' }}>{person.relation}</p>
            </div>
        );
    };

    // Calendar helpers
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        return { firstDay, daysInMonth };
    };

    const { firstDay, daysInMonth } = getDaysInMonth(currentMonth);
    const monthName = currentMonth.toLocaleString('default', { month: 'long' });
    const today = new Date();
    const isCurrentMonth = today.getMonth() === currentMonth.getMonth() && today.getFullYear() === currentMonth.getFullYear();

    // Helper to parse date from the stored date string (e.g., "2/16/2026")
    const parseDateString = (dateStr: string): Date | null => {
        // Try direct parsing first
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) return parsed;
        return null;
    };

    // Map of day number to list of events for that day
    const eventsByDay: Record<number, ImportantDate[]> = {};

    console.log('[Calendar] Processing dates:', dates.length, 'events');
    console.log('[Calendar] Current month:', currentMonth.getMonth() + 1, '/', currentMonth.getFullYear());

    dates.forEach(event => {
        // First try to parse from the 'date' field (which stores the ACTUAL event date)
        let eventDate = parseDateString(event.date);

        // Fallback to createdAt if date field doesn't parse
        if (!eventDate) {
            eventDate = new Date(event.createdAt);
        }

        const eventMonth = eventDate.getMonth();
        const eventYear = eventDate.getFullYear();
        const eventDay = eventDate.getDate();

        console.log('[Calendar] Event:', event.event, '| Stored date:', event.date, '| Parsed:', eventMonth + 1, '/', eventDay, '/', eventYear);

        // Check if this event is in the currently displayed month
        if (eventMonth === currentMonth.getMonth() && eventYear === currentMonth.getFullYear()) {
            if (!eventsByDay[eventDay]) eventsByDay[eventDay] = [];
            eventsByDay[eventDay].push(event);
            console.log('[Calendar] ✓ Added to day', eventDay);
        }
    });

    const eventDays = Object.keys(eventsByDay).map(Number);
    console.log('[Calendar] Marked days:', eventDays);

    if (!isOpen) return null;

    const tabs = [
        { id: 'dates' as TabType, label: 'Registered Dates', icon: Calendar, count: dates.length },
        { id: 'conversations' as TabType, label: 'Past Conversations', icon: MessageSquare, count: conversations.length },
        { id: 'people' as TabType, label: 'People', icon: Users, count: people.length },
        { id: 'notes' as TabType, label: 'Notes', icon: Clock, count: 0 },
    ];

    // Generate calendar days array including empty cells
    const calendarDays: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) calendarDays.push(null);
    for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                background: 'linear-gradient(180deg, #0a0a0f 0%, #121218 100%)',
                overflow: 'auto'
            }}
        >
            {/* Header */}
            <div style={{ padding: '16px 32px', borderBottom: '1px solid rgba(236, 72, 153, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                    onClick={onClose}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 16px', borderRadius: '8px',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        color: 'white', cursor: 'pointer', fontSize: '14px'
                    }}
                >
                    <ArrowLeft size={18} />
                    Back to Assistant
                </button>
                <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', margin: 0 }}>Personal Memory Dashboard</h1>
                <div style={{ width: '160px' }}></div>
            </div>

            {/* Tab Navigation */}
            <div style={{ padding: '16px 32px', display: 'flex', justifyContent: 'center', gap: '16px' }}>
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            position: 'relative',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                            padding: '16px 32px', borderRadius: '12px', cursor: 'pointer',
                            background: activeTab === tab.id ? 'linear-gradient(180deg, rgba(236,72,153,0.2) 0%, transparent 100%)' : 'rgba(255,255,255,0.05)',
                            border: activeTab === tab.id ? '2px solid #ec4899' : '1px solid rgba(255,255,255,0.1)',
                            boxShadow: activeTab === tab.id ? '0 0 20px rgba(236,72,153,0.3)' : 'none'
                        }}
                    >
                        <div style={{
                            padding: '12px', borderRadius: '8px',
                            background: activeTab === tab.id ? 'rgba(236,72,153,0.3)' : 'rgba(255,255,255,0.1)'
                        }}>
                            <tab.icon size={24} color={activeTab === tab.id ? '#f472b6' : '#9ca3af'} />
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 500, color: activeTab === tab.id ? 'white' : '#9ca3af' }}>
                            {tab.label}
                        </span>
                        {tab.count > 0 && (
                            <span style={{
                                position: 'absolute', top: '-4px', right: '-4px',
                                padding: '2px 8px', fontSize: '11px', fontWeight: 'bold',
                                background: '#ec4899', color: 'white', borderRadius: '99px'
                            }}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Main Content: Either Selected Conversation Detail OR 4-Column Layout */}
            {selectedConvo ? (
                <div style={{
                    maxWidth: '820px',
                    margin: '0 auto',
                    padding: '24px 20px 48px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px'
                }}>
                    {/* Header with Back Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button
                            onClick={() => setSelectedConvo(null)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '40px', height: '40px', borderRadius: '50%',
                                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                                color: 'white', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                        >
                            <ArrowLeft size={18} />
                        </button>
                        {(() => {
                            const visitorName = selectedConvo.participants.find(p => !['user', 'you', 'patient', 'sunita', 'sunita sharma', 'owner'].includes(p.toLowerCase())) ||
                                (selectedConvo.fullTranscript?.find(t => !isUserSpeaker(t.speaker, t.text, selectedConvo.participants))?.speaker) ||
                                'Visitor';
                            const initial = visitorName && visitorName !== 'Visitor' ? visitorName[0].toUpperCase() : 'V';
                            return (
                                <>
                                    <div style={{
                                        width: '48px', height: '48px', borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontWeight: 'bold', fontSize: '18px', flexShrink: 0
                                    }}>
                                        {initial}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', margin: 0 }}>
                                            Conversation with {visitorName}
                                        </h2>
                                        <p style={{ fontSize: '13px', color: '#9ca3af', margin: '4px 0 0 0' }}>
                                            {selectedConvo.summary || `Conversation recorded with ${visitorName}.`}
                                        </p>
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)' }} />

                    {/* Captured Scene Image (if any) */}
                    {selectedConvo.imageUrl && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                width: '100%', maxWidth: '640px', borderRadius: '16px', overflow: 'hidden',
                                border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
                            }}>
                                <img
                                    src={selectedConvo.imageUrl}
                                    alt="Captured Scene"
                                    style={{ width: '100%', height: 'auto', maxHeight: '360px', objectFit: 'cover', display: 'block' }}
                                />
                            </div>
                            <span style={{ fontSize: '12px', color: '#9ca3af' }}>Captured Scene</span>
                        </div>
                    )}

                    {/* Speech Bubbles - Left for Visitor, Right for User */}
                    <div style={{
                        display: 'flex', flexDirection: 'column', gap: '14px',
                        padding: '16px 8px', minHeight: '260px'
                    }}>
                        {(() => {
                            const entries: { speaker: string; text: string; timestamp?: Date | string }[] = (selectedConvo.fullTranscript && selectedConvo.fullTranscript.length > 0)
                                ? selectedConvo.fullTranscript
                                : [
                                    { speaker: 'You', text: 'Hi, what is your name?', timestamp: selectedConvo.timestamp },
                                    { speaker: selectedConvo.participants.find(p => !['user', 'you', 'patient'].includes(p.toLowerCase())) || 'Visitor', text: `I am ${selectedConvo.participants.find(p => !['user', 'you', 'patient'].includes(p.toLowerCase())) || 'Visitor'}.`, timestamp: selectedConvo.timestamp }
                                ];

                            return entries.map((entry, idx) => {
                                const isUser = isUserSpeaker(entry.speaker, entry.text, selectedConvo.participants);
                                const timeStr = entry.timestamp ? formatTimeAgo(new Date(entry.timestamp)) : formatTimeAgo(new Date(selectedConvo.timestamp));
                                const visitorParticipant = selectedConvo.participants.find(p => !['user', 'you', 'patient', 'sunita', 'sunita sharma', 'owner'].includes(p.toLowerCase())) || 'Visitor';
                                const displaySpeaker = isUser ? 'You' : (entry.speaker && !['user', 'you', 'visitor'].includes(entry.speaker.toLowerCase()) ? entry.speaker : visitorParticipant);

                                return (
                                    <div
                                        key={idx}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: isUser ? 'flex-end' : 'flex-start',
                                            width: '100%'
                                        }}
                                    >
                                        <div
                                            style={{
                                                maxWidth: '75%',
                                                minWidth: '140px',
                                                padding: '10px 16px 8px 16px',
                                                borderRadius: isUser ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                                                background: isUser
                                                    ? 'linear-gradient(135deg, #005c4b 0%, #064e3b 100%)'
                                                    : '#202c33',
                                                border: isUser
                                                    ? '1px solid rgba(16, 185, 129, 0.4)'
                                                    : '1px solid rgba(255, 255, 255, 0.08)',
                                                boxShadow: isUser
                                                    ? '0 4px 14px rgba(5, 150, 105, 0.25)'
                                                    : '0 4px 14px rgba(0, 0, 0, 0.3)',
                                                color: 'white',
                                                fontSize: '14px',
                                                position: 'relative'
                                            }}
                                        >
                                            <div style={{
                                                fontSize: '11px',
                                                fontWeight: 'bold',
                                                color: isUser ? '#6ee7b7' : '#53bdeb',
                                                marginBottom: '4px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                {!isUser && <span>~</span>}
                                                <span>{displaySpeaker}</span>
                                            </div>

                                            <p style={{ margin: 0, fontWeight: 400, lineHeight: 1.5, color: '#e9edef', wordBreak: 'break-word' }}>
                                                {entry.text}
                                            </p>

                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'flex-end',
                                                alignItems: 'center',
                                                gap: '4px',
                                                marginTop: '4px'
                                            }}>
                                                <span style={{ fontSize: '10px', color: '#8696a0' }}>
                                                    {timeStr}
                                                </span>
                                                {isUser && (
                                                    <span style={{ fontSize: '11px', color: '#53bdeb', fontWeight: 'bold', lineHeight: 1 }}>
                                                        ✓✓
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            ) : (
                /* Main Content - Flex Layout with Active Spotlight Expansion & Background Blur */
                <div style={{
                    padding: '16px 32px',
                    display: 'flex',
                    gap: '20px',
                    height: 'calc(100vh - 210px)',
                    minHeight: '480px',
                    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>

                {/* Column 1: Calendar (dates) */}
                <div
                    onClick={() => activeTab !== 'dates' && setActiveTab('dates')}
                    style={{
                        flex: activeTab === 'dates' ? 5.5 : 0.85,
                        borderRadius: '16px',
                        border: activeTab === 'dates' ? '2px solid #ec4899' : '1px solid rgba(255,255,255,0.06)',
                        background: activeTab === 'dates'
                            ? 'linear-gradient(180deg, rgba(236,72,153,0.18) 0%, rgba(15,15,25,0.98) 100%)'
                            : 'rgba(255,255,255,0.015)',
                        padding: '18px',
                        boxShadow: activeTab === 'dates' ? '0 0 45px rgba(236,72,153,0.4)' : 'none',
                        overflow: 'hidden',
                        filter: activeTab === 'dates' ? 'none' : 'blur(6px) opacity(0.25) brightness(0.6)',
                        transform: activeTab === 'dates' ? 'scale(1.01)' : 'scale(0.96)',
                        cursor: activeTab === 'dates' ? 'default' : 'pointer',
                        transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative'
                    }}
                >
                    {activeTab === 'dates' ? (
                        <div style={{
                            position: 'absolute', top: '14px', right: '16px',
                            background: 'rgba(236,72,153,0.25)', border: '1px solid #ec4899',
                            color: '#f472b6', fontSize: '10px', fontWeight: 'bold',
                            padding: '3px 8px', borderRadius: '99px', letterSpacing: '0.5px'
                        }}>
                            ✨ ACTIVE FOCUS
                        </div>
                    ) : (
                        <div style={{
                            position: 'absolute', inset: 0, zIndex: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(0,0,0,0.2)', opacity: 0,
                            transition: 'opacity 0.2s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                        >
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#f472b6', background: 'rgba(15,15,25,0.9)', padding: '6px 14px', borderRadius: '99px', border: '1px solid #ec4899' }}>
                                Click to Focus Calendar
                            </span>
                        </div>
                    )}

                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Calendar size={20} color={activeTab === 'dates' ? '#f472b6' : '#9ca3af'} />
                        Calendar
                    </h2>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <span style={{ fontSize: '14px', color: '#9ca3af' }}>{monthName} {currentMonth.getFullYear()}</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={(e) => { e.stopPropagation(); setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)); }}
                                style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>
                                <ChevronLeft size={16} color="#9ca3af" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)); }}
                                style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>
                                <ChevronRight size={16} color="#9ca3af" />
                            </button>
                        </div>
                    </div>

                    {/* Days Header */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px' }}>
                        {['Sun', 'M', 'T', 'W', 'T', 'F', 'Sa'].map((day, i) => (
                            <div key={i} style={{ textAlign: 'center', fontSize: '11px', color: '#6b7280', padding: '4px' }}>{day}</div>
                        ))}
                    </div>

                    {/* Calendar Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                        {calendarDays.map((day, i) => {
                            if (day === null) return <div key={`empty-${i}`} style={{ aspectRatio: '1', minHeight: '32px' }}></div>;
                            const isToday = isCurrentMonth && day === today.getDate();
                            const hasEvent = eventDays.includes(day);
                            const dayEvents = eventsByDay[day] || [];

                            return (
                                <div
                                    key={day}
                                    style={{ position: 'relative' }}
                                    onMouseEnter={() => hasEvent && setHoveredDay(day)}
                                    onMouseLeave={() => setHoveredDay(null)}
                                >
                                    <div
                                        style={{
                                            aspectRatio: '1', minHeight: '32px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                                            background: isToday ? '#ec4899' : hasEvent ? 'rgba(236,72,153,0.3)' : 'transparent',
                                            color: isToday ? 'white' : hasEvent ? '#f9a8d4' : '#9ca3af',
                                            border: hasEvent && !isToday ? '1px solid rgba(236,72,153,0.5)' : 'none',
                                            boxShadow: isToday ? '0 0 15px rgba(236,72,153,0.5)' : 'none',
                                            transition: 'transform 0.15s ease'
                                        }}
                                    >
                                        {day}
                                    </div>

                                    {/* Tooltip */}
                                    {hoveredDay === day && dayEvents.length > 0 && (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '100%',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            marginBottom: '8px',
                                            padding: '8px 12px',
                                            background: 'rgba(15, 15, 25, 0.98)',
                                            border: '1px solid rgba(129, 140, 248, 0.4)',
                                            borderRadius: '12px',
                                            boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
                                            zIndex: 1000,
                                            minWidth: '160px',
                                            maxWidth: '280px',
                                            backdropFilter: 'blur(8px)'
                                        }}>
                                            <div style={{
                                                fontSize: '11px',
                                                color: '#818cf8',
                                                fontWeight: 800,
                                                marginBottom: '8px',
                                                borderBottom: '1px solid rgba(129, 140, 248, 0.2)',
                                                paddingBottom: '4px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}>
                                                <Brain size={12} />
                                                MEMORY DETAILS
                                            </div>
                                            {dayEvents.map((event, idx) => {
                                                const cleaned = cleanEventTitle(event.event);
                                                const rawPart = cleaned.split(/\s+on\s+/i)[0];
                                                const dateRegex = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;
                                                const isJustDate = dateRegex.test(rawPart) && rawPart.length < 15;
                                                const displayName = isJustDate
                                                    ? (event.type.charAt(0).toUpperCase() + event.type.slice(1))
                                                    : rawPart;

                                                return (
                                                    <div key={idx} style={{
                                                        fontSize: '13px',
                                                        color: 'white',
                                                        padding: '4px 0',
                                                        display: 'flex',
                                                        alignItems: 'flex-start',
                                                        gap: '8px'
                                                    }}>
                                                        <span style={{ color: '#818cf8', marginTop: '2px' }}>•</span>
                                                        <span style={{ fontWeight: 500 }}>{displayName}</span>
                                                    </div>
                                                );
                                            })}
                                            <div style={{
                                                position: 'absolute',
                                                bottom: '-6px',
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                width: 0, height: 0,
                                                borderLeft: '6px solid transparent',
                                                borderRight: '6px solid transparent',
                                                borderTop: '6px solid rgba(129, 140, 248, 0.4)'
                                            }}></div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Upcoming Events */}
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>Upcoming Registered Dates</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
                            {dates.map((date) => (
                                <div key={date.id} style={{ fontSize: '12px', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <p style={{ color: 'white', fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cleanEventTitle(date.event)}</p>
                                    <p style={{ color: '#ec4899', fontSize: '11px', margin: '4px 0 0 0', fontWeight: 600 }}>{date.date}</p>
                                </div>
                            ))}
                            {dates.length === 0 && <p style={{ fontSize: '11px', color: '#6b7280' }}>No upcoming events</p>}
                        </div>
                    </div>
                </div>

                {/* Column 2: Recent Conversations (conversations) */}
                <div
                    onClick={() => activeTab !== 'conversations' && setActiveTab('conversations')}
                    style={{
                        flex: activeTab === 'conversations' ? 5.5 : 0.85,
                        borderRadius: '16px',
                        border: activeTab === 'conversations' ? '2px solid #ec4899' : '1px solid rgba(255,255,255,0.06)',
                        background: activeTab === 'conversations'
                            ? 'linear-gradient(180deg, rgba(236,72,153,0.18) 0%, rgba(15,15,25,0.98) 100%)'
                            : 'rgba(255,255,255,0.015)',
                        padding: '18px',
                        boxShadow: activeTab === 'conversations' ? '0 0 45px rgba(236,72,153,0.4)' : 'none',
                        overflow: 'hidden',
                        filter: activeTab === 'conversations' ? 'none' : 'blur(6px) opacity(0.25) brightness(0.6)',
                        transform: activeTab === 'conversations' ? 'scale(1.01)' : 'scale(0.96)',
                        cursor: activeTab === 'conversations' ? 'default' : 'pointer',
                        transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative'
                    }}
                >
                    {activeTab === 'conversations' ? (
                        <div style={{
                            position: 'absolute', top: '14px', right: '16px',
                            background: 'rgba(236,72,153,0.25)', border: '1px solid #ec4899',
                            color: '#f472b6', fontSize: '10px', fontWeight: 'bold',
                            padding: '3px 8px', borderRadius: '99px', letterSpacing: '0.5px'
                        }}>
                            ✨ ACTIVE FOCUS
                        </div>
                    ) : (
                        <div style={{
                            position: 'absolute', inset: 0, zIndex: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(0,0,0,0.2)', opacity: 0,
                            transition: 'opacity 0.2s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                        >
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#f472b6', background: 'rgba(15,15,25,0.9)', padding: '6px 14px', borderRadius: '99px', border: '1px solid #ec4899' }}>
                                Click to Focus Conversations
                            </span>
                        </div>
                    )}

                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MessageSquare size={20} color={activeTab === 'conversations' ? '#f472b6' : '#9ca3af'} />
                        Past Conversations
                    </h2>

                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
                        {conversations.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '32px 0' }}>
                                <MessageSquare size={32} color="#4b5563" style={{ margin: '0 auto 8px' }} />
                                <p style={{ fontSize: '13px', color: '#6b7280' }}>No conversations yet</p>
                            </div>
                        ) : (
                            conversations.map((convo) => (
                                <div
                                    key={convo.id}
                                    onClick={(e) => { e.stopPropagation(); setSelectedConvo(convo); }}
                                    style={{
                                        padding: '14px', borderRadius: '12px',
                                        background: activeTab === 'conversations' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        display: 'flex', gap: '14px', alignItems: 'flex-start', cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {(() => {
                                        const participantName = convo.participants[0];
                                        const participant = people.find(p => p.name.trim().toLowerCase() === participantName.trim().toLowerCase());
                                        return (
                                            <div style={{
                                                width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                                                background: participant?.faceImage ? 'transparent' : 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: 'white', fontWeight: 'bold', fontSize: '15px',
                                                overflow: 'hidden',
                                                border: '2px solid rgba(236, 72, 153, 0.4)'
                                            }}>
                                                {participant?.faceImage ? (
                                                    <img
                                                        src={participant.faceImage}
                                                        alt=""
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).parentElement!.style.background = 'linear-gradient(135deg, #ec4899, #8b5cf6)';
                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                            (e.target as HTMLImageElement).parentElement!.innerHTML = participantName?.[0] || 'C';
                                                        }}
                                                    />
                                                ) : (
                                                    participantName?.[0] || 'C'
                                                )}
                                            </div>
                                        );
                                    })()}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <p style={{ color: 'white', fontWeight: 600, fontSize: '14px', margin: 0 }}>
                                                {convo.participants.join(' & ')}
                                            </p>
                                            <span style={{ fontSize: '11px', color: '#818cf8', fontWeight: 500 }}>{formatTimeAgo(convo.timestamp)}</span>
                                        </div>
                                        <p style={{ color: '#cbd5e1', fontSize: '12px', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                                            {convo.summary}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Column 3: People (people) */}
                <div
                    onClick={() => activeTab !== 'people' && setActiveTab('people')}
                    style={{
                        flex: activeTab === 'people' ? 5.5 : 0.85,
                        borderRadius: '16px',
                        border: activeTab === 'people' ? '2px solid #ec4899' : '1px solid rgba(255,255,255,0.06)',
                        background: activeTab === 'people'
                            ? 'linear-gradient(180deg, rgba(236,72,153,0.18) 0%, rgba(15,15,25,0.98) 100%)'
                            : 'rgba(255,255,255,0.015)',
                        padding: '18px',
                        boxShadow: activeTab === 'people' ? '0 0 45px rgba(236,72,153,0.4)' : 'none',
                        overflow: 'hidden',
                        filter: activeTab === 'people' ? 'none' : 'blur(6px) opacity(0.25) brightness(0.6)',
                        transform: activeTab === 'people' ? 'scale(1.01)' : 'scale(0.96)',
                        cursor: activeTab === 'people' ? 'default' : 'pointer',
                        transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative'
                    }}
                >
                    {activeTab === 'people' ? (
                        <div style={{
                            position: 'absolute', top: '14px', right: '16px',
                            background: 'rgba(236,72,153,0.25)', border: '1px solid #ec4899',
                            color: '#f472b6', fontSize: '10px', fontWeight: 'bold',
                            padding: '3px 8px', borderRadius: '99px', letterSpacing: '0.5px'
                        }}>
                            ✨ ACTIVE FOCUS
                        </div>
                    ) : (
                        <div style={{
                            position: 'absolute', inset: 0, zIndex: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(0,0,0,0.2)', opacity: 0,
                            transition: 'opacity 0.2s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                        >
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#f472b6', background: 'rgba(15,15,25,0.9)', padding: '6px 14px', borderRadius: '99px', border: '1px solid #ec4899' }}>
                                Click to Focus People
                            </span>
                        </div>
                    )}

                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users size={20} color={activeTab === 'people' ? '#f472b6' : '#9ca3af'} />
                        People
                    </h2>

                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        display: 'grid',
                        gridTemplateColumns: activeTab === 'people' ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)',
                        gap: '16px',
                        alignContent: 'start',
                        padding: '4px 0'
                    }}>
                        {people.length === 0 ? (
                            <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '32px 0' }}>
                                <Users size={32} color="#4b5563" style={{ margin: '0 auto 8px' }} />
                                <p style={{ fontSize: '13px', color: '#6b7280' }}>No people recorded</p>
                            </div>
                        ) : (
                            (() => {
                                const uniquePeople = people.reduce((acc, current) => {
                                    const curName = current.name.trim().toLowerCase();
                                    const x = acc.find(item => item.name.trim().toLowerCase() === curName);
                                    if (!x) return acc.concat([current]);
                                    const xHasImg = !!x.faceImage;
                                    const curHasImg = !!current.faceImage;
                                    if (!xHasImg && curHasImg) {
                                        return acc.map(item => item.name.trim().toLowerCase() === curName ? current : item);
                                    }
                                    return acc;
                                }, [] as typeof people);

                                return uniquePeople.map((person) => (
                                    <PersonCard key={person.id} person={person} />
                                ));
                            })()
                        )}
                    </div>
                </div>

                {/* Column 4: Notes & Activity Stream (notes) */}
                <div
                    onClick={() => activeTab !== 'notes' && setActiveTab('notes')}
                    style={{
                        flex: activeTab === 'notes' ? 5.5 : 0.85,
                        borderRadius: '16px',
                        border: activeTab === 'notes' ? '2px solid #ec4899' : '1px solid rgba(255,255,255,0.06)',
                        background: activeTab === 'notes'
                            ? 'linear-gradient(180deg, rgba(236,72,153,0.18) 0%, rgba(15,15,25,0.98) 100%)'
                            : 'rgba(255,255,255,0.015)',
                        padding: '18px',
                        boxShadow: activeTab === 'notes' ? '0 0 45px rgba(236,72,153,0.4)' : 'none',
                        overflow: 'hidden',
                        filter: activeTab === 'notes' ? 'none' : 'blur(6px) opacity(0.25) brightness(0.6)',
                        transform: activeTab === 'notes' ? 'scale(1.01)' : 'scale(0.96)',
                        cursor: activeTab === 'notes' ? 'default' : 'pointer',
                        transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative'
                    }}
                >
                    {activeTab === 'notes' ? (
                        <div style={{
                            position: 'absolute', top: '14px', right: '16px',
                            background: 'rgba(236,72,153,0.25)', border: '1px solid #ec4899',
                            color: '#f472b6', fontSize: '10px', fontWeight: 'bold',
                            padding: '3px 8px', borderRadius: '99px', letterSpacing: '0.5px'
                        }}>
                            ✨ ACTIVE FOCUS
                        </div>
                    ) : (
                        <div style={{
                            position: 'absolute', inset: 0, zIndex: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(0,0,0,0.2)', opacity: 0,
                            transition: 'opacity 0.2s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                        >
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#f472b6', background: 'rgba(15,15,25,0.9)', padding: '6px 14px', borderRadius: '99px', border: '1px solid #ec4899' }}>
                                Click to Focus Activity Stream
                            </span>
                        </div>
                    )}

                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={20} color={activeTab === 'notes' ? '#f472b6' : '#9ca3af'} />
                        Notes & Activity Stream
                    </h2>

                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
                        {[...conversations.map(c => ({ type: 'conversation' as const, data: c, time: new Date(c.timestamp) })),
                        ...dates.map(d => ({ type: 'date' as const, data: d, time: new Date(d.createdAt) })),
                        ...people.map(p => ({ type: 'person' as const, data: p, time: new Date(p.lastSeen) }))]
                            .sort((a, b) => b.time.getTime() - a.time.getTime())
                            .map((activity, idx) => (
                                <div key={`${activity.type}-${idx}`} style={{
                                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                                    padding: '10px 12px', borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.06)'
                                }}>
                                    <div style={{
                                        width: '10px', height: '10px', borderRadius: '50%', marginTop: '4px', flexShrink: 0,
                                        background: activity.type === 'conversation' ? '#3b82f6' : activity.type === 'date' ? '#ec4899' : '#10b981',
                                        boxShadow: `0 0 8px ${activity.type === 'conversation' ? '#3b82f6' : activity.type === 'date' ? '#ec4899' : '#10b981'}`
                                    }}></div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: '13px', color: 'white', margin: 0, lineHeight: '1.4' }}>
                                            {activity.type === 'conversation'
                                                ? `Conversation with ${(activity.data as ConversationRecord).participants?.join(', ') || 'Visitor'}: ${(activity.data as ConversationRecord).summary || ''}`
                                                : activity.type === 'date'
                                                    ? `Event: ${(activity.data as ImportantDate).event} (${(activity.data as ImportantDate).date})`
                                                    : `Person recorded: ${(activity.data as PersonRecord).name} (${(activity.data as PersonRecord).relation})`
                                            }
                                        </p>
                                        <p style={{ fontSize: '10px', color: '#818cf8', margin: '4px 0 0 0', fontWeight: 500 }}>{formatTimeAgo(activity.time)}</p>
                                    </div>
                                </div>
                            ))
                        }
                        {conversations.length === 0 && dates.length === 0 && people.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '32px 0' }}>
                                <Clock size={32} color="#4b5563" style={{ margin: '0 auto 8px' }} />
                                <p style={{ fontSize: '13px', color: '#6b7280' }}>No activity yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            )}
        </div>
    );
}
