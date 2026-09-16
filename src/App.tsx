import { useState, useEffect, useRef, useCallback } from 'react';
import { connectHub, emitFaceDetected, emitConversationEnded, onCognitiveAlert, CognitiveAlert } from './socketClient';
import { 
    Brain, 
    User, 
    Calendar, 
    ShieldCheck, 
    Activity, 
    Key, 
    Sparkles, 
    Eye, 
    Camera, 
    AlertCircle, 
    History, 
    TrendingUp, 
    Heart, 
    Shield, 
    FileText, 
    Grid, 
    CheckCircle2, 
    Sun,
    Clock,
    X,
    Trash2,
    Info,
    MessageSquare,
    Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from './Modal';
import TiltCard from './TiltCard';
import Webcam from 'react-webcam';
import { getGeminiModel, analyzeScene } from './gemini';
import IntroSequence from './IntroSequence';
import NeuralBackground from './NeuralBackground';
import ConversationRecorder from './ConversationRecorder';
import VoiceAssistant from './VoiceAssistant';
import MemoryDashboard from './MemoryDashboard';
import MedicationReminderUI from './MedicationReminderUI';
import { getProgressionHistory, getBehaviorIncidents, getAllDates, deleteDate } from './memoryDatabase';
import { ProgressionRecord } from './diseaseAnalytics';
import { BehaviorIncident } from './behaviorMentalHealth';
import { cleanEventTitle } from './nlpExtractor';
import MedicationAlarm from './MedicationAlarm';
import RecallCard, { type RecognizedPerson } from './RecallCard';
import TaskModal from './TaskModal';

export interface TaskItem {
    id: string;
    time: string;
    event: string;
    scheduled?: string;
    type: 'date' | 'action';
    description?: string;
    details?: string;
    speaker?: string;
    rawDate?: string;
    createdAt?: Date;
}

type ActiveViewType = 'vision' | 'medication';

function App() {
    const [status, setStatus] = useState('Standby');
    const [apiKey, setApiKey] = useState('AIzaSyBOSp25QjJRHC4MRGJOHzNx6ItTEIQ7zZY');
    const [isActivated, setIsActivated] = useState(false);
    const [primaryModel, setPrimaryModel] = useState<any>(null);
    const [backupModel, setBackupModel] = useState<any>(null);
    const [identifiedPerson, setIdentifiedPerson] = useState<null | { name: string; relation: string; summary: string }>(null);
    const [nudges, setNudges] = useState<string[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const isAnalyzingRef = useRef(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [cameraReady, setCameraReady] = useState(false);
    const [history, setHistory] = useState('');
    const historyRef = useRef(history);
    const [memoryLog, setMemoryLog] = useState<{ time: string; event: string }[]>([]);
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

    const loadTasks = async () => {
        try {
            const datesData = await getAllDates();
            const mapped: TaskItem[] = datesData
                .map(d => {
                    const parsedDate = new Date(d.createdAt || d.date);
                    const timeStr = !isNaN(parsedDate.getTime())
                        ? parsedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Today';

                    let fullEvent = d.event || '';
                    let title = cleanEventTitle(fullEvent, d.speaker);
                    let scheduledStr = '';

                    if (fullEvent.includes(' — ')) {
                        const parts = fullEvent.split(' — ');
                        title = cleanEventTitle(parts[0], d.speaker);
                        scheduledStr = parts[1]?.trim() || '';
                    } else if (fullEvent.includes(' – ')) {
                        const parts = fullEvent.split(' – ');
                        title = cleanEventTitle(parts[0], d.speaker);
                        scheduledStr = parts[1]?.trim() || '';
                    } else if (fullEvent.includes(' on ')) {
                        const parts = fullEvent.split(' on ');
                        title = cleanEventTitle(parts[0], d.speaker);
                        scheduledStr = parts[1]?.trim() || '';
                    }

                    if (!scheduledStr && d.date) {
                        const dt = new Date(d.date);
                        if (!isNaN(dt.getTime())) {
                            scheduledStr = dt.toLocaleDateString([], { month: 'long', day: 'numeric' });
                        }
                    }

                    return {
                        id: d.id,
                        time: timeStr,
                        event: title,
                        scheduled: scheduledStr,
                        type: d.type === 'appointment' ? ('date' as const) : ('action' as const),
                        description: d.description,
                        details: d.details,
                        speaker: d.speaker,
                        rawDate: d.date,
                        createdAt: d.createdAt
                    };
                });

            // Deduplicate tasks by event + scheduled
            const seen = new Set<string>();
            const unique = mapped.filter(t => {
                if (!t.event || t.event === 'Event' || t.event.length < 2 || /^(?:what|when|where|who|how|why|you\s+here|tomorrow\s+have|brings\s+you|is\s+my|actually|am\s+here)/i.test(t.event)) {
                    return false;
                }
                const key = `${t.event.toLowerCase()}|${t.scheduled || ''}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            setTasks(unique);
            setSelectedTask(prev => {
                if (!prev) return null;
                const match = unique.find(t => t.id === prev.id || t.event.toLowerCase() === prev.event.toLowerCase());
                return match || prev;
            });
        } catch (err) {
            console.error("Error loading tasks on mount:", err);
        }
    };
    const lastSummaryRef = useRef("");
    const [isAutoScanEnabled, setIsAutoScanEnabled] = useState(false);
    const [quotaHit, setQuotaHit] = useState(false);
    const [lastVisitorInfo, setLastVisitorInfo] = useState<{ name: string; relation: string } | null>(null);
    const [lastConversationSummary, setLastConversationSummary] = useState<string>('');
    const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash-lite');
    const [lastCapture, setLastCapture] = useState<string | null>(null);
    const [cameraKey, setCameraKey] = useState(0);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [isDashboardOpen, setIsDashboardOpen] = useState(false);

    // Navigation & New Modules State
    const [activeView, setActiveView] = useState<ActiveViewType>('vision');
    const [showMedicationModal, setShowMedicationModal] = useState(false);

    // Voice/face recognition -> "Who is this?" recall card + familiar-voice greeting
    const [recognizedPerson, setRecognizedPerson] = useState<RecognizedPerson | null>(null);
    const [greetingPerson, setGreetingPerson] = useState<{ name: string; relation: string } | null>(null);
    const [progressionRecords, setProgressionRecords] = useState<ProgressionRecord[]>([]);
    const [behaviorLogs, setBehaviorLogs] = useState<BehaviorIncident[]>([]);

    // Cognitive alert from CBAE module
    const [cognitiveAlert, setCognitiveAlert] = useState<CognitiveAlert | null>(null);
    const [caregiverVoiceAlert, setCaregiverVoiceAlert] = useState<{ message: string; sender: string } | null>(null);

    // Cinematic Intro States
    const [introComplete, setIntroComplete] = useState(false);

    useEffect(() => {
        historyRef.current = history;
    }, [history]);

    // Connect to Mnemosync Hub on mount and subscribe to cognitive alerts & caregiver voice assists
    useEffect(() => {
        const socket = connectHub();
        const unsub = onCognitiveAlert((alert) => {
            console.log('[App] cognitive_alert received:', alert);
            setCognitiveAlert(alert);
            if (alert.severity === 'low') {
                setTimeout(() => setCognitiveAlert(null), 30000);
            }
        });

        const handleVoiceAssist = (data: { message: string; sender?: string }) => {
            console.log('[App] Caregiver voice assistance received:', data);
            setCaregiverVoiceAlert({ message: data.message, sender: data.sender || 'Caregiver Ananya' });
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const u = new SpeechSynthesisUtterance(data.message);
                u.rate = 0.92;
                u.pitch = 1.05;
                window.speechSynthesis.speak(u);
            }
            setTimeout(() => setCaregiverVoiceAlert(null), 16000);
        };

        socket.on('caregiver_voice_assist', handleVoiceAssist);

        return () => {
            unsub();
            socket.off('caregiver_voice_assist', handleVoiceAssist);
        };
    }, []);

    // Emit face_detected to hub whenever a person is identified
    useEffect(() => {
        if (identifiedPerson) {
            emitFaceDetected({
                name: identifiedPerson.name,
                relation: identifiedPerson.relation,
                summary: identifiedPerson.summary,
            });
        }
    }, [identifiedPerson]);

    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Save API key to localStorage
    useEffect(() => {
        if (apiKey.length > 20) {
            localStorage.setItem('mnemosync_api_key', apiKey);
        }
    }, [apiKey]);

    // Load progression, behavior records & tasks on mount
    useEffect(() => {
        loadModuleData();
        loadTasks();
    }, []);

    const loadModuleData = async () => {
        try {
            const [prog, beh] = await Promise.all([
                getProgressionHistory(),
                getBehaviorIncidents()
            ]);
            setProgressionRecords(prog);
            setBehaviorLogs(beh);
        } catch (e) {
            console.error('Error loading module data:', e);
        }
    };
    // Initialize models
    useEffect(() => {
        if (apiKey.length > 20 && isActivated) {
            try {
                const p = getGeminiModel(apiKey, 'gemini-3-flash-preview');
                const b = getGeminiModel(apiKey, 'gemini-2.5-flash-lite');
                setPrimaryModel(p);
                setBackupModel(b);
                setStatus('Watching');
            } catch (e) {
                console.error('Failed to initialize models:', e);
                setStatus('API Error');
            }
        }
    }, [apiKey, isActivated]);

    // Capture screenshot from webcam
    const captureScreenshot = useCallback((): string | null => {
        if (!webcamRef.current) return null;
        return webcamRef.current.getScreenshot();
    }, []);

    // List camera devices
    useEffect(() => {
        const getDevices = async () => {
            try {
                const devs = await navigator.mediaDevices.enumerateDevices();
                const videoDevs = devs.filter(d => d.kind === 'videoinput');
                setDevices(videoDevs);
                if (videoDevs.length > 0 && !selectedDeviceId) {
                    const integrated = videoDevs.find(d =>
                        d.label.toLowerCase().includes('integrated') ||
                        d.label.toLowerCase().includes('built-in')
                    );
                    setSelectedDeviceId(integrated ? integrated.deviceId : videoDevs[0].deviceId);
                }
            } catch (err) {
                console.error("Error listing devices:", err);
            }
        };
        getDevices();
    }, [selectedDeviceId]);

    const runAnalysis = useCallback(async () => {
        if (!primaryModel || isAnalyzingRef.current || !cameraReady) return;

        const imageSrc = captureScreenshot();
        if (!imageSrc) return;
        setLastCapture(imageSrc);

        const base64 = imageSrc.split(',')[1];

        try {
            isAnalyzingRef.current = true;
            setIsAnalyzing(true);
            setQuotaHit(false);
            setStatus('Analyzing...');
            const result = await analyzeScene(primaryModel, backupModel, base64, historyRef.current);

            if (result && result.isQuotaExceeded) {
                setQuotaHit(true);
                setMemoryLog(prev => [{ time: new Date().toLocaleTimeString(), event: "Quota Exceeded - Please wait a minute" }, ...prev].slice(0, 5));
                return;
            }

            if (result && result.personIdentified) {
                setIdentifiedPerson({
                    name: result.name || 'Unknown',
                    relation: result.relation || 'New Contact',
                    summary: result.summary || 'No previous conversation found.',
                });

                const timestamp = new Date().toLocaleTimeString();
                setHistory(prev => `${prev}\nSeen at ${timestamp}: Identified ${result.name} (${result.relation}). Summary: ${result.summary}`);
                setMemoryLog(prev => [{ time: timestamp, event: `Identified ${result.name}` }, ...prev].slice(0, 5));
                lastSummaryRef.current = "";
            } else if (result && result.summary) {
                if (result.summary !== lastSummaryRef.current) {
                    const timestamp = new Date().toLocaleTimeString();
                    setMemoryLog(prev => [{ time: timestamp, event: result.summary }, ...prev].slice(0, 5));
                    lastSummaryRef.current = result.summary;
                }
                setIdentifiedPerson(null);
            } else {
                setIdentifiedPerson(null);
            }

            if (result && result.nudges && result.nudges.length > 0) {
                setNudges(result.nudges);
            }

            setStatus('Watching');
        } catch (e) {
            console.error('Analysis error:', e);
            setStatus('Vision Error');
        } finally {
            isAnalyzingRef.current = false;
            setIsAnalyzing(false);
        }
    }, [primaryModel, backupModel, cameraReady, captureScreenshot]);

    // Automatic analysis
    useEffect(() => {
        if (!primaryModel || !cameraReady || !isAutoScanEnabled) return;
        const interval = setInterval(() => {
            runAnalysis();
        }, 60000);
        const initialTimeout = setTimeout(() => runAnalysis(), 1000);

        return () => {
            clearInterval(interval);
            clearTimeout(initialTimeout);
        };
    }, [primaryModel, backupModel, runAnalysis, cameraReady, isAutoScanEnabled]);

    const handleManualAnalysis = () => {
        if (primaryModel && !isAnalyzing && cameraReady) {
            runAnalysis();
        }
    };

    const handleResetCamera = () => {
        setCameraKey(prev => prev + 1);
        setCameraReady(false);
        setCameraError(null);
    };

    return (
        <>
            <NeuralBackground />

            {/* Cinematic Intro */}
            <AnimatePresence>
                {!introComplete && (
                    <IntroSequence
                        onComplete={() => {
                            setIntroComplete(true);
                            setTimeout(() => setIsActivated(true), 2000);
                        }}
                        mascotSrc="/mascot.jpg"
                    />
                )}
            </AnimatePresence>

            {/* Inbuilt Activation Loading */}
            <AnimatePresence>
                {introComplete && !isActivated && (
                    <div className="modal-overlay">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 1.1, opacity: 0 }}
                            className="modal-card"
                        >
                            <div className="modal-content">
                                <div className="flex items-center gap-4 mb-6">
                                    <div style={{ background: 'var(--gradient-1)', padding: '0.75rem', borderRadius: '1rem' }}>
                                        <Brain size={32} color="white" />
                                    </div>
                                    <div>
                                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Mnemosync</h2>
                                        <p className="text-dim">Alzheimer's Companion</p>
                                    </div>
                                </div>
                                <div className="activation-box">
                                    <Activity className="mx-auto mb-2 status-active" style={{ color: '#8f7bd8' }} />
                                    <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>AI Core: Authorized</p>
                                    <p className="text-xs text-dim mt-1">Activating Neural Bridge...</p>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Main Application Container */}
            <div 
                className="w-full h-full flex flex-col p-3 overflow-hidden relative z-10"
                style={{ display: introComplete && isActivated ? 'flex' : 'none' }}
            >
                {/* Hidden canvas */}
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* Floating Caregiver Voice Assistance Banner */}
                {caregiverVoiceAlert && (
                    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-emerald-950 via-teal-900 to-emerald-950 border-2 border-emerald-400 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-bounce max-w-2xl backdrop-blur-xl">
                        <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-2xl flex-shrink-0 shadow-lg shadow-emerald-500/50">
                            🔊
                        </div>
                        <div className="flex-1">
                            <div className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-2">
                                <span>Voice Guidance from {caregiverVoiceAlert.sender}</span>
                                <span className="bg-emerald-500/30 px-2 py-0.5 rounded text-[10px] text-emerald-200">Wearable Speaker Active</span>
                            </div>
                            <div className="text-base font-bold text-white mt-1">"{caregiverVoiceAlert.message}"</div>
                        </div>
                        <button onClick={() => setCaregiverVoiceAlert(null)} className="text-gray-400 hover:text-white text-lg px-2" title="Dismiss">✕</button>
                    </div>
                )}

                {/* Top Pastel Navigation Bar */}
                <header className="app-header w-full mb-3 px-4 py-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div style={{ background: 'var(--gradient-1)', padding: '0.5rem', borderRadius: '0.75rem', boxShadow: '0 8px 20px -8px rgba(178, 138, 240, 0.7)' }}>
                            <Brain size={20} color="white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-extrabold text-sm tracking-wide" style={{ color: 'var(--text)' }}>MNEMOSYNC</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(196, 236, 217, 0.7)', color: '#3f8f74', border: '1px solid rgba(111, 199, 174, 0.45)', fontWeight: 700 }}>
                                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#6fc7ae' }} /> Live Clinical HUD
                                </span>
                            </div>
                            <span className="text-[11px] text-dim">Cognitive Prosthetic & Caregiver Telemetry</span>
                        </div>
                    </div>

                    {/* View Switcher Tabs */}
                    <nav className="tab-bar">
                        <button
                            onClick={() => setActiveView('vision')}
                            className={`tab-btn ${activeView === 'vision' ? 'active' : ''}`}
                        >
                            <Eye size={14} /> Live Vision HUD
                        </button>

                        <button
                            onClick={() => { setActiveView('medication'); setShowMedicationModal(true); }}
                            className={`tab-btn ${activeView === 'medication' ? 'active' : ''}`}
                        >
                            <Key size={14} /> Medication Reminders
                        </button>
                    </nav>

                    {/* Quick Action Badges */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsDashboardOpen(true)}
                            className="quick-btn"
                        >
                            <History size={14} style={{ color: '#9d7be0' }} /> Memory Dashboard
                        </button>
                    </div>
                </header>

                {/* View 1: LIVE VISION & ASSISTIVE GRID */}
                {activeView === 'vision' && (
                    <div className="assistive-grid flex-1 overflow-hidden" style={{ height: 'calc(100% - 60px)', padding: 0 }}>
                        {/* Left Column: Task Planner & Memory Log */}
                        <aside className="task-aside">
                            <RecallCard
                                person={recognizedPerson}
                                patientName="User"
                                onDismiss={() => setRecognizedPerson(null)}
                            />
                            <TiltCard className="card card-enhanced flex-1" style={{ overflow: 'auto' }}>
                                <div className="flex items-center gap-3 mb-4">
                                    <div style={{ background: 'linear-gradient(135deg, #34d399, #10b981)', padding: '0.5rem', borderRadius: '0.75rem' }}>
                                        <Calendar size={20} color="white" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold">Task Planner</h3>
                                        <p className="text-xs text-dim">Upcoming tasks & reminders</p>
                                    </div>
                                </div>

                                <div className="scroll-content custom-scrollbar">
                                    {tasks.length > 0 ? (
                                        tasks.map((task) => (
                                            <motion.div
                                                key={task.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                onClick={() => setSelectedTask(task)}
                                                className="nudge-item group transition-all"
                                                style={{ cursor: 'pointer', position: 'relative' }}
                                                title="Click to view full event description & extra notes"
                                            >
                                                <div className="nudge-dot" style={{ background: task.type === 'action' ? '#ef4444' : '#34d399' }} />
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between gap-1">
                                                        <p className="font-medium text-sm text-balance">◆ {task.event}</p>
                                                        {task.description && (
                                                            <span style={{
                                                                fontSize: '10px',
                                                                background: 'rgba(52, 211, 153, 0.15)',
                                                                color: '#34d399',
                                                                border: '1px solid rgba(52, 211, 153, 0.3)',
                                                                padding: '1px 6px',
                                                                borderRadius: '999px',
                                                                whiteSpace: 'nowrap'
                                                            }}>
                                                                + Info
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-dim">
                                                        {task.scheduled ? `Scheduled: ${task.scheduled}` : `Added at ${task.time}`}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        try {
                                                            await deleteDate(task.id);
                                                        } catch (err) {}
                                                        setTasks(prev => prev.filter(t => t.id !== task.id));
                                                        if (selectedTask?.id === task.id) setSelectedTask(null);
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all"
                                                    title="Mark Complete / Dismiss"
                                                >
                                                    <ShieldCheck size={14} className="text-dim hover:text-white" />
                                                </button>
                                            </motion.div>
                                        ))
                                    ) : (
                                        <>
                                            <div className="nudge-item">
                                                <div className="nudge-dot" />
                                                <div>
                                                    <p className="font-medium text-sm">Afternoon Medication (Donepezil)</p>
                                                    <p className="text-xs text-dim">Due with water</p>
                                                </div>
                                            </div>
                                            <div className="nudge-item" style={{ opacity: 0.7 }}>
                                                <div className="nudge-dot" />
                                                <div>
                                                    <p className="font-medium text-sm">Family Photo Memory Review</p>
                                                    <p className="text-xs text-dim">Reminiscence therapy scheduled</p>
                                                </div>
                                            </div>
                                            <div className="nudge-item" style={{ opacity: 0.5 }}>
                                                <div className="nudge-dot inactive" />
                                                <div>
                                                    <p className="font-medium text-sm">Morning Garden Walk</p>
                                                    <p className="text-xs text-dim">Completed at 8:30 AM</p>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </TiltCard>

                            <TiltCard className="card card-enhanced flex-1">
                                <div className="flex items-center gap-3 mb-4">
                                    <div style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', padding: '0.5rem', borderRadius: '0.75rem' }}>
                                        <History size={20} color="white" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold">AI Memory Stream</h3>
                                        <p className="text-xs text-dim">Continuous recognition logs</p>
                                    </div>
                                </div>
                                <div className="scroll-content custom-scrollbar space-y-2">
                                    {memoryLog.length > 0 ? (
                                        memoryLog.map((log, idx) => (
                                            <div key={idx} className="text-xs p-2 rounded bg-glass border border-border">
                                                <span className="text-primary font-bold">{log.time}:</span> {log.event}
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-dim italic">Waiting for first camera scan...</p>
                                    )}
                                </div>
                            </TiltCard>
                        </aside>

                        {/* Center Column: Vision Panel */}
                        <main className="vision-panel">
                            <div className="status-indicator">
                                <div
                                    className="pulse"
                                    style={status.includes('Error') ? { background: '#ef4444' } : cameraReady ? {} : { background: '#f59e0b' }}
                                />
                                <span>{cameraReady ? status : 'Camera Loading...'}</span>
                                {primaryModel && cameraReady && (
                                    <button
                                        onClick={handleManualAnalysis}
                                        style={{
                                            marginLeft: '0.5rem',
                                            padding: '0.25rem 0.75rem',
                                            background: 'rgba(255, 255, 255, 0.8)',
                                            border: '1px solid rgba(167, 139, 250, 0.5)',
                                            borderRadius: '0.5rem',
                                            cursor: 'pointer',
                                            color: '#6d5ba8',
                                            fontSize: '0.75rem',
                                            fontWeight: 700
                                        }}
                                    >
                                        Scan Now
                                    </button>
                                )}
                            </div>

                            {/* Camera View */}
                            <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000' }}>
                                <Webcam
                                    key={cameraKey}
                                    ref={webcamRef}
                                    audio={false}
                                    screenshotFormat="image/jpeg"
                                    videoConstraints={{
                                        deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                                        facingMode: "user",
                                        width: 1280,
                                        height: 720
                                    }}
                                    onUserMedia={() => {
                                        setCameraReady(true);
                                        setCameraError(null);
                                    }}
                                    onUserMediaError={(err) => {
                                        console.error("Camera Error:", err);
                                        setCameraError(typeof err === 'string' ? err : err.message || "Failed to access webcam");
                                        setCameraReady(false);
                                    }}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                    }}
                                />
                            </div>

                            {/* Camera HUD Overlays */}
                            {cameraReady && (
                                <>
                                    <div className="scanning-line" />
                                    <div className="corner-bracket top-left" />
                                    <div className="corner-bracket top-right" />
                                    <div className="corner-bracket bottom-left" />
                                    <div className="corner-bracket bottom-right" />
                                    
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: '1.5rem',
                                            right: '1.5rem',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'flex-end',
                                            gap: '0.5rem',
                                            zIndex: 10
                                        }}
                                    >
                                        <motion.p
                                            animate={{ opacity: [0.6, 1, 0.6] }}
                                            transition={{ duration: 2, repeat: Infinity }}
                                            style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.95rem', fontWeight: 500 }}
                                        >
                                            AI Vision Active
                                        </motion.p>
                                    </div>
                                </>
                            )}

                            {/* Identity Overlay */}
                            <AnimatePresence>
                                {identifiedPerson && (
                                    <motion.div
                                        initial={{ y: 30, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        exit={{ y: 30, opacity: 0 }}
                                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                        className="identity-card identity-glow"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="avatar">
                                                <User size={28} color="white" />
                                            </div>
                                            <div className="flex-1">
                                                <h2 className="font-bold" style={{ fontSize: '1.5rem' }}>{identifiedPerson.name}</h2>
                                                <p className="text-dim">{identifiedPerson.relation}</p>
                                            </div>
                                        </div>
                                        <p className="text-sm mt-2" style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
                                            "{identifiedPerson.summary}"
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </main>

                        {/* Right Column: Memory Aside */}
                        <aside className="memory-aside">
                            <div className="scroll-content custom-scrollbar space-y-4 pr-2">
                                <TiltCard className="card card-enhanced core-status gradient-border">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div style={{ background: 'var(--gradient-1)', padding: '0.5rem', borderRadius: '0.75rem' }}>
                                            <Brain size={20} color="white" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold">Mnemosync Core</h3>
                                            <p className="text-xs text-dim">Active: Gemini 3 Flash</p>
                                        </div>
                                    </div>
                                    <p className="text-sm text-dim" style={{ marginBottom: '1rem', lineHeight: 1.6 }}>
                                        Real-time vision monitoring is active. Analyzing environment to help with face recognition and daily routines.
                                    </p>

                                    <div className="flex items-center justify-between p-3 rounded-xl bg-glass border border-border">
                                        <div className="flex items-center gap-2">
                                            <Activity size={16} className={isAutoScanEnabled ? "text-accent" : "text-dim"} />
                                            <span className="text-sm font-medium">Auto-Scan {isAutoScanEnabled ? 'ON' : 'OFF'}</span>
                                        </div>
                                        <label className="switch">
                                            <input
                                                type="checkbox"
                                                checked={isAutoScanEnabled}
                                                onChange={(e) => setIsAutoScanEnabled(e.target.checked)}
                                                aria-label="Toggle auto-scan"
                                            />
                                            <span className="slider" />
                                        </label>
                                    </div>
                                </TiltCard>

                                {/* Memory Dashboard Button */}
                                <button
                                    onClick={() => setIsDashboardOpen(true)}
                                    className="card card-enhanced gradient-border cursor-pointer w-full text-left p-3.5"
                                    style={{ background: 'linear-gradient(135deg, rgba(221, 208, 247, 0.55), rgba(249, 200, 221, 0.45))', border: '1px solid rgba(167, 139, 250, 0.35)' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', padding: '0.5rem', borderRadius: '0.75rem', boxShadow: '0 0 15px rgba(139, 92, 246, 0.4)' }}>
                                            <History size={20} color="white" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-sm">Memory Dashboard</h3>
                                            <p className="text-xs text-dim">View saved people, dates & convos</p>
                                        </div>
                                    </div>
                                </button>

                                {/* Conversation Recorder */}
                                {primaryModel && (
                                    <ConversationRecorder
                                        primaryModel={primaryModel}
                                        backupModel={backupModel}
                                        identifiedPerson={identifiedPerson}
                                        onDateDetected={(eventStr) => {
                                            const now = new Date();
                                            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                            const type = eventStr.includes('📅') ? 'date' : 'action';

                                            let title = cleanEventTitle(eventStr, identifiedPerson?.name);
                                            let scheduledStr = '';
                                            if (eventStr.includes(' — ')) {
                                                const parts = eventStr.split(' — ');
                                                title = cleanEventTitle(parts[0], identifiedPerson?.name);
                                                scheduledStr = parts[1]?.trim() || '';
                                            } else if (eventStr.includes(' – ')) {
                                                const parts = eventStr.split(' – ');
                                                title = cleanEventTitle(parts[0], identifiedPerson?.name);
                                                scheduledStr = parts[1]?.trim() || '';
                                            } else if (eventStr.includes(' on ')) {
                                                const parts = eventStr.split(' on ');
                                                title = cleanEventTitle(parts[0], identifiedPerson?.name);
                                                scheduledStr = parts[1]?.trim() || '';
                                            }

                                            if (!title || title === 'Event' || title.length < 2 || /^(?:what|when|where|who|how|why|you\s+here|tomorrow\s+have|actually|is\s+my|am\s+here)/i.test(title)) {
                                                return;
                                            }

                                            setMemoryLog(prev => [{ time: timeStr, event: `${title}${scheduledStr ? ' (' + scheduledStr + ')' : ''}` }, ...prev].slice(0, 10));
                                            loadTasks();
                                        }}
                                        onConversationUpdate={(summary, visitorInfo) => {
                                            setHistory(prev => `${prev}\n[Conversation] ${summary}`);
                                            setLastConversationSummary(summary);
                                            if (visitorInfo) {
                                                setLastVisitorInfo(visitorInfo);
                                            }
                                            loadTasks();
                                            // Relay full transcript to CBAE via hub
                                            emitConversationEnded({
                                                transcript: summary,
                                                participants: visitorInfo
                                                    ? ['User', visitorInfo.name]
                                                    : ['User'],
                                            });
                                        }}
                                        onPersonRecognized={(info) => {
                                            setRecognizedPerson({ ...info, ts: Date.now() });
                                            if (info.name && info.name !== 'User') {
                                                setGreetingPerson({ name: info.name, relation: info.relation });
                                            }
                                        }}
                                        onRepeatedQuestion={(question, times) => {
                                            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                            setMemoryLog(prev => [{ time: timeStr, event: `Repeated question (×${times}): "${question}"` }, ...prev].slice(0, 10));
                                        }}
                                        onOccasion={(occ) => {
                                            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                            setMemoryLog(prev => [{ time: timeStr, event: `📌 Occasion: ${occ.title} — ${occ.when}` }, ...prev].slice(0, 10));
                                        }}
                                        patientName="User"
                                    />
                                )}

                                {/* AI Voice Assistant */}
                                <VoiceAssistant
                                    lastSummary={lastConversationSummary}
                                    identifiedPerson={identifiedPerson}
                                    visitorInfo={lastVisitorInfo}
                                    greetingPerson={greetingPerson}
                                    onGreetingSpoken={() => setGreetingPerson(null)}
                                    patientName="User"
                                />

                                {/* Last AI Capture */}
                                <TiltCard className="card">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', padding: '0.5rem', borderRadius: '0.75rem' }}>
                                            <Activity size={20} color="white" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-sm">Last AI Capture</h3>
                                            <p className="text-xs text-dim">Vision snapshot</p>
                                        </div>
                                    </div>

                                    <div style={{
                                        position: 'relative',
                                        width: '100%',
                                        paddingTop: '56.25%',
                                        borderRadius: '0.5rem',
                                        overflow: 'hidden',
                                        border: '1px solid rgba(167, 139, 250, 0.3)',
                                        background: 'rgba(255,255,255,0.5)'
                                    }}>
                                        {lastCapture ? (
                                            <img
                                                src={lastCapture}
                                                alt="Last AI Capture"
                                                style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover'
                                                }}
                                            />
                                        ) : (
                                            <p style={{
                                                position: 'absolute',
                                                top: '50%',
                                                left: '50%',
                                                transform: 'translate(-50%, -50%)',
                                                fontSize: '10px',
                                                color: '#8d86a0',
                                                textAlign: 'center'
                                            }}>Awaiting first scan...</p>
                                        )}
                                    </div>
                                </TiltCard>
                            </div>
                        </aside>
                    </div>
                )}

                {/* View 5: MEDICATION REMINDER */}
                {showMedicationModal && (
                    <Modal onClose={() => setShowMedicationModal(false)} title="Medication Reminders">
                        <MedicationReminderUI />
                    </Modal>
                )}
            </div>

            {/* Exact-time medication alarm popup (phone-timer style) */}
            <MedicationAlarm />

            {/* Memory Vault Modal */}
            <MemoryDashboard
                isOpen={isDashboardOpen}
                onClose={() => setIsDashboardOpen(false)}
            />

            {/* ── Cognitive Alert Banner (from CBAE module) ────────────── */}
            <AnimatePresence>
                {cognitiveAlert && (
                    <motion.div
                        initial={{ y: -80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -80, opacity: 0 }}
                        style={{
                            position: 'fixed',
                            top: '1rem',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 9999,
                            minWidth: '360px',
                            maxWidth: '560px',
                            padding: '1rem 1.25rem',
                            borderRadius: '1rem',
                            background: 'rgba(255, 255, 255, 0.88)',
                            border: `1px solid ${
                                cognitiveAlert.severity === 'high' ? 'rgba(239,68,68,0.45)' : 'rgba(245,158,11,0.45)'
                            }`,
                            backdropFilter: 'blur(16px)',
                            boxShadow: '0 18px 40px -18px rgba(148, 120, 220, 0.5)',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.75rem',
                        }}
                    >
                        <AlertCircle
                            size={22}
                            style={{ color: cognitiveAlert.severity === 'high' ? '#ef4444' : '#f59e0b', flexShrink: 0, marginTop: 2 }}
                        />
                        <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 700, fontSize: '0.9rem', color: cognitiveAlert.severity === 'high' ? '#b91c1c' : '#b45309', marginBottom: '0.2rem' }}>
                                🧠 Cognitive Alert — {cognitiveAlert.severity.toUpperCase()}
                            </p>
                            <p style={{ fontSize: '0.8rem', color: 'rgba(71,63,82,0.85)' }}>
                                {cognitiveAlert.reason}
                            </p>
                            <p style={{ fontSize: '0.7rem', color: 'rgba(71,63,82,0.55)', marginTop: '0.25rem' }}>
                                Detected at {new Date(cognitiveAlert.timestamp).toLocaleTimeString()}
                            </p>
                        </div>
                        <button
                            onClick={() => setCognitiveAlert(null)}
                            style={{ background: 'none', border: 'none', color: 'rgba(71,63,82,0.5)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
                        >✕</button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Task Planner Event Detail Modal (Extra Info & Context) ── */}
            {selectedTask && (
                <TaskModal
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                    onUpdate={loadTasks}
                />
            )}
        </>
    );
}

export default App;
