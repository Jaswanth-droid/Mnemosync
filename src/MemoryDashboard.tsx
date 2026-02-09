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

interface MemoryDashboardProps {
    isOpen: boolean;
    onClose: () => void;
}

type TabType = 'dates' | 'conversations' | 'people' | 'notes';

export default function MemoryDashboard({ isOpen, onClose }: MemoryDashboardProps) {
    const [dates, setDates] = useState<ImportantDate[]>([]);
    const [conversations, setConversations] = useState<ConversationRecord[]>([]);
    const [people, setPeople] = useState<PersonRecord[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>('dates');
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
                    fullTranscript: []
                },
                {
                    id: generateId(),
                    timestamp: new Date(Date.now() - 1000 * 60 * 30),
                    participants: ['Priya Patel'],
                    summary: 'UX Review - Finalized layout designs.',
                    fullTranscript: []
                },
                {
                    id: generateId(),
                    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
                    participants: ['Ananya Iyer'],
                    summary: 'Project Delta - Finalized requirements.',
                    fullTranscript: []
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

            {/* Main Content - 4 Column Grid */}
            <div style={{ padding: '16px 32px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', height: 'calc(100vh - 200px)' }}>

                {/* Column 1: Calendar */}
                <div style={{
                    borderRadius: '16px', border: '2px solid rgba(236,72,153,0.5)',
                    background: 'linear-gradient(180deg, rgba(236,72,153,0.1) 0%, transparent 100%)',
                    padding: '16px', boxShadow: '0 0 30px rgba(236,72,153,0.2)', overflow: 'hidden'
                }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', margin: '0 0 8px 0' }}>Calendar</h2>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <span style={{ fontSize: '14px', color: '#9ca3af' }}>{monthName} {currentMonth.getFullYear()}</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                                style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>
                                <ChevronLeft size={16} color="#9ca3af" />
                            </button>
                            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
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
                                                const rawPart = event.event.replace(/^[📅✅]\s*/, '').split(/\s+on\s+/i)[0];
                                                // If the result is just a date (contains month names), use the type as a fallback
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
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>Upcoming</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '100px', overflowY: 'auto' }}>
                            {dates.slice(0, 3).map((date) => (
                                <div key={date.id} style={{ fontSize: '11px', padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <p style={{ color: 'white', fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{date.event}</p>
                                    <p style={{ color: '#6b7280', margin: '4px 0 0 0' }}>{date.date}</p>
                                </div>
                            ))}
                            {dates.length === 0 && <p style={{ fontSize: '11px', color: '#6b7280' }}>No upcoming events</p>}
                        </div>
                    </div>
                </div>

                {/* Column 2: Recent Conversations */}
                <div style={{
                    borderRadius: '16px', border: '2px solid rgba(236,72,153,0.5)',
                    background: 'linear-gradient(180deg, rgba(236,72,153,0.1) 0%, transparent 100%)',
                    padding: '16px', boxShadow: '0 0 30px rgba(236,72,153,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column'
                }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', margin: '0 0 16px 0' }}>Recent Conversations</h2>
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {conversations.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '32px 0' }}>
                                <MessageSquare size={32} color="#4b5563" style={{ margin: '0 auto 8px' }} />
                                <p style={{ fontSize: '13px', color: '#6b7280' }}>No conversations yet</p>
                            </div>
                        ) : (
                            conversations.slice(0, 5).map((convo) => (
                                <div key={convo.id} style={{
                                    padding: '12px', borderRadius: '12px',
                                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: 'pointer'
                                }}>
                                    {(() => {
                                        const participantName = convo.participants[0];
                                        const participant = people.find(p => p.name.trim().toLowerCase() === participantName.trim().toLowerCase());
                                        return (
                                            <div style={{
                                                width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                                                background: participant?.faceImage ? 'transparent' : 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: 'white', fontWeight: 'bold', fontSize: '14px',
                                                overflow: 'hidden',
                                                border: '1px solid rgba(236, 72, 153, 0.3)'
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
                                        <p style={{ color: 'white', fontWeight: 500, fontSize: '13px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {convo.participants.join(' & ')}
                                        </p>
                                        <p style={{ color: '#9ca3af', fontSize: '11px', margin: '4px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {convo.summary}
                                        </p>
                                    </div>
                                    <span style={{ fontSize: '10px', color: '#6b7280', flexShrink: 0 }}>{formatTimeAgo(convo.timestamp)}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Column 3: People */}
                <div style={{
                    borderRadius: '16px', border: '2px solid rgba(236,72,153,0.5)',
                    background: 'linear-gradient(180deg, rgba(236,72,153,0.1) 0%, transparent 100%)',
                    padding: '16px', boxShadow: '0 0 30px rgba(236,72,153,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column'
                }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', margin: '0 0 16px 0' }}>People</h2>
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '20px',
                        alignContent: 'space-evenly',
                        padding: '10px 0'
                    }}>
                        {people.length === 0 ? (
                            <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '32px 0' }}>
                                <Users size={32} color="#4b5563" style={{ margin: '0 auto 8px' }} />
                                <p style={{ fontSize: '13px', color: '#6b7280' }}>No people recorded</p>
                            </div>
                        ) : (
                            (() => {
                                // Deduplicate people by name for the UI (case-insensitive trim)
                                const uniquePeople = people.reduce((acc, current) => {
                                    const curName = current.name.trim().toLowerCase();
                                    const x = acc.find(item => item.name.trim().toLowerCase() === curName);
                                    if (!x) return acc.concat([current]);
                                    // Priority: 1. Has image, 2. Newer (lastSeen)
                                    const xHasImg = !!x.faceImage;
                                    const curHasImg = !!current.faceImage;
                                    if (!xHasImg && curHasImg) {
                                        return acc.map(item => item.name.trim().toLowerCase() === curName ? current : item);
                                    }
                                    return acc;
                                }, [] as typeof people);

                                return uniquePeople.slice(0, 6).map((person) => (
                                    <PersonCard key={person.id} person={person} />
                                ));
                            })()
                        )}
                    </div>
                </div>

                {/* Column 4: Activity Stream */}
                <div style={{
                    borderRadius: '16px', border: '2px solid rgba(236,72,153,0.5)',
                    background: 'linear-gradient(180deg, rgba(236,72,153,0.1) 0%, transparent 100%)',
                    padding: '16px', boxShadow: '0 0 30px rgba(236,72,153,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column'
                }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', margin: '0 0 16px 0' }}>Activity Stream</h2>
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[...conversations.map(c => ({ type: 'conversation' as const, data: c, time: new Date(c.timestamp) })),
                        ...dates.map(d => ({ type: 'date' as const, data: d, time: new Date(d.createdAt) })),
                        ...people.map(p => ({ type: 'person' as const, data: p, time: new Date(p.lastSeen) }))]
                            .sort((a, b) => b.time.getTime() - a.time.getTime())
                            .slice(0, 10)
                            .map((activity, idx) => (
                                <div key={`${activity.type}-${idx}`} style={{
                                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                                    padding: '8px', borderRadius: '8px'
                                }}>
                                    <div style={{
                                        width: '8px', height: '8px', borderRadius: '50%', marginTop: '6px', flexShrink: 0,
                                        background: activity.type === 'conversation' ? '#3b82f6' : activity.type === 'date' ? '#ec4899' : '#10b981'
                                    }}></div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: '12px', color: 'white', margin: 0, lineHeight: '1.4' }}>
                                            {activity.type === 'conversation'
                                                ? `Conversation: ${(activity.data as ConversationRecord).summary?.slice(0, 50) || 'No summary'}...`
                                                : activity.type === 'date'
                                                    ? `Event: ${(activity.data as ImportantDate).event}`
                                                    : `Person: ${(activity.data as PersonRecord).name}`
                                            }
                                        </p>
                                        <p style={{ fontSize: '10px', color: '#6b7280', margin: '4px 0 0 0' }}>{formatTimeAgo(activity.time)}</p>
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
        </div>
    );
}
