import { useState, useEffect, useRef, useCallback } from 'react';
import { Brain, User, Calendar, ShieldCheck, Activity, Key, Sparkles, Eye, Camera, AlertCircle, History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Webcam from 'react-webcam';
import { getGeminiModel, analyzeScene } from './gemini';
import IntroSequence from './IntroSequence';
import VideoBackground from './VideoBackground';
import NeuralBackground from './NeuralBackground';
import ConversationRecorder from './ConversationRecorder';
import VoiceAssistant from './VoiceAssistant';
import MemoryDashboard from './MemoryDashboard';

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
    const [tasks, setTasks] = useState<{ id: string; time: string; event: string; type: 'date' | 'action' }[]>([]);
    const lastSummaryRef = useRef(""); // To prevent duplicate logs
    const [isAutoScanEnabled, setIsAutoScanEnabled] = useState(false); // Default to manual to save quota
    const [quotaHit, setQuotaHit] = useState(false);
    const [lastVisitorInfo, setLastVisitorInfo] = useState<{ name: string; relation: string } | null>(null);
    const [lastConversationSummary, setLastConversationSummary] = useState<string>(''); // Store last conversation for recall
    const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash-lite'); // Corrected for 2026 free tier
    const [lastCapture, setLastCapture] = useState<string | null>(null); // For debugging blank screen
    const [cameraKey, setCameraKey] = useState(0); // For forcing remount
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [isDashboardOpen, setIsDashboardOpen] = useState(false);

    // Cinematic Intro States
    const [introComplete, setIntroComplete] = useState(false);
    const [introPhase, setIntroPhase] = useState(0); // 0: dark, 1: particles, 2: glitch text, 3: goddess reveal, 4: form reveal

    // Keep historyRef in sync for the AI
    useEffect(() => {
        historyRef.current = history;
    }, [history]);

    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Save API key to localStorage when it changes
    useEffect(() => {
        if (apiKey.length > 20) {
            localStorage.setItem('mnemosync_api_key', apiKey);
        }
    }, [apiKey]);

    // Initialize models when API key is provided and activated
    useEffect(() => {
        if (apiKey.length > 20 && isActivated) {
            try {
                // Initialize both primary (Gemini 3) and backup (Gemini 2.5)
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

    // List camera devices on mount
    useEffect(() => {
        const getDevices = async () => {
            try {
                const devs = await navigator.mediaDevices.enumerateDevices();
                const videoDevs = devs.filter(d => d.kind === 'videoinput');
                setDevices(videoDevs);
                if (videoDevs.length > 0 && !selectedDeviceId) {
                    // Prioritize Integrated Webcam as default
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
        setLastCapture(imageSrc); // Save for visual debug

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
                lastSummaryRef.current = ""; // Reset summary suppression after identification
            } else if (result && result.summary) {
                // Suppress duplicate "No person" logs
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
    }, [primaryModel, backupModel, cameraReady, captureScreenshot]); // Only stable dependencies

    // Automatic analysis enabled only when toggled
    useEffect(() => {
        if (!primaryModel || !cameraReady || !isAutoScanEnabled) return;

        console.log('Auto-scan active...');
        const interval = setInterval(() => {
            runAnalysis();
        }, 60000); // 1 minute interval to be safe

        // Initial scan shortly after enabling
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

    const handleTestCapture = () => {
        const image = captureScreenshot();
        if (image) {
            setLastCapture(image);
            console.log("Test capture successful");
        } else {
            console.error("Test capture failed - no image");
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

            <AnimatePresence>
                {!introComplete && (
                    <IntroSequence
                        onComplete={() => {
                            setIntroComplete(true);
                            // Small delay to simulate activation for the judge
                            setTimeout(() => setIsActivated(true), 2000);
                        }}
                        mascotSrc="/mascot.jpg"
                    />
                )}
            </AnimatePresence>

            {/* Inbuilt Activation "Loading" Card */}
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
                                <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-center">
                                    <Activity className="mx-auto mb-2 status-active text-indigo-400" />
                                    <p className="text-sm font-bold text-indigo-100">AI Core: Authorized</p>
                                    <p className="text-xs text-indigo-300/60 mt-1">Activating Neural Bridge...</p>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <div className="assistive-grid" style={{ display: isDashboardOpen ? 'none' : introComplete && isActivated ? 'grid' : 'none' }}>
                {/* Hidden canvas for screenshots */}
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* Activation UI removed for Hackathon - Inbuilt Key Active */}

                {/* Left Column: Task Manager & Memory Log */}
                <aside className="task-aside">
                    <div className="card card-enhanced flex-1" style={{ overflow: 'auto' }}>
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
                                        className="nudge-item group"
                                    >
                                        <div className="nudge-dot" style={{ background: task.type === 'action' ? '#ef4444' : '#34d399' }} />
                                        <div className="flex-1">
                                            <p className="font-medium text-sm text-balance">{task.event.split(' on ')[0]}</p>
                                            <p className="text-xs text-dim">
                                                {task.event.includes(' on ') ? `Scheduled: ${task.event.split(' on ')[1]}` : `Added at ${task.time}`}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setTasks(prev => prev.filter(t => t.id !== task.id))}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all"
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
                                            <p className="font-medium text-sm">Afternoon Medication</p>
                                            <p className="text-xs text-dim">Due in 15 minutes</p>
                                        </div>
                                    </div>
                                    <div className="nudge-item" style={{ opacity: 0.5 }}>
                                        <div className="nudge-dot inactive" />
                                        <div>
                                            <p className="font-medium text-sm">Morning Walk</p>
                                            <p className="text-xs text-dim">Completed at 8:30 AM</p>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="card card-enhanced flex-1">
                        <div className="flex items-center gap-3 mb-4">
                            <div style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', padding: '0.5rem', borderRadius: '0.75rem' }}>
                                <History size={20} color="white" />
                            </div>
                            <div>
                                <h3 className="font-bold">AI Memory Log</h3>
                                <p className="text-xs text-dim">Context continuity</p>
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
                                <p className="text-xs text-dim italic">Waiting for first scan...</p>
                            )}
                        </div>
                    </div>
                </aside>

                {/* Center Column: Main Vision Panel */}
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
                                    background: 'rgba(129, 140, 248, 0.3)',
                                    border: '1px solid rgba(129, 140, 248, 0.5)',
                                    borderRadius: '0.5rem',
                                    cursor: 'pointer',
                                    color: 'white',
                                    fontSize: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <Eye size={14} />
                                Scan Now
                            </button>
                        )}
                    </div>

                    {/* Camera Error State */}
                    {cameraError && (
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(0,0,0,0.9)',
                            zIndex: 5,
                            padding: '2rem',
                            textAlign: 'center'
                        }}>
                            <AlertCircle size={64} color="#ef4444" style={{ marginBottom: '1rem' }} />
                            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Camera Access Required</h3>
                            <p className="text-dim" style={{ maxWidth: '300px', marginBottom: '1rem' }}>
                                {cameraError}
                            </p>
                            <button
                                onClick={() => window.location.reload()}
                                className="btn-primary"
                                style={{ maxWidth: '200px' }}
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {/* Camera Loading State */}
                    {!cameraReady && !cameraError && (
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(0,0,0,0.8)',
                            zIndex: 5
                        }}>
                            <Camera size={48} color="#818cf8" style={{ marginBottom: '1rem' }} />
                            <p>Initializing Camera...</p>
                            <p className="text-dim text-sm" style={{ marginTop: '0.5rem' }}>Please allow camera access when prompted</p>
                        </div>
                    )}

                    {/* React Webcam Component */}
                    <Webcam
                        key={cameraKey}
                        audio={false}
                        ref={webcamRef}
                        mirrored={false}
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
                        onUserMediaError={(err) => setCameraError(typeof err === 'string' ? err : 'Camera access denied')}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            zIndex: 1
                        }}
                    />

                    {/* AI Processing Overlay - Shows when camera is active */}
                    {cameraReady && (
                        <>
                            {/* Scanning Line */}
                            <div className="scanning-line" />

                            {/* Corner Brackets */}
                            <div className="corner-bracket top-left" />
                            <div className="corner-bracket top-right" />
                            <div className="corner-bracket bottom-left" />
                            <div className="corner-bracket bottom-right" />

                            {/* Floating Particles */}
                            <div className="particle" />
                            <div className="particle" />
                            <div className="particle" />
                            <div className="particle" />
                            <div className="particle" />

                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05))',
                                zIndex: 2,
                                pointerEvents: 'none'
                            }}>
                                <motion.div
                                    animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
                                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                                    style={{
                                        width: 90,
                                        height: 90,
                                        borderRadius: '50%',
                                        border: '2px solid rgba(129, 140, 248, 0.4)',
                                        background: 'radial-gradient(circle, rgba(129, 140, 248, 0.1) 0%, transparent 70%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: '1rem',
                                        boxShadow: '0 0 40px rgba(129, 140, 248, 0.2)'
                                    }}
                                >
                                    <Eye size={36} color="#818cf8" />
                                </motion.div>
                                <motion.p
                                    animate={{ opacity: [0.6, 1, 0.6] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.95rem', fontWeight: 500, letterSpacing: '0.05em' }}
                                >
                                    AI Vision Active
                                </motion.p>
                                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                                    {isAnalyzing ? 'Analyzing...' : 'Click "Scan Now" to analyze'}
                                </p>
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
                                className={`identity-card ${identifiedPerson ? 'identity-glow' : ''}`}
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
                                <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.7)', fontStyle: 'italic' }}>
                                    "{identifiedPerson.summary}"
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>

                {/* Memory Aside */}
                <aside className="memory-aside">
                    <div className="scroll-content custom-scrollbar space-y-4 pr-2">
                        <div className="card card-enhanced core-status gradient-border">
                            <div className="flex items-center gap-3 mb-4">
                                <div style={{ background: 'var(--gradient-1)', padding: '0.5rem', borderRadius: '0.75rem' }}>
                                    <Brain size={20} color="white" />
                                </div>
                                <div>
                                    <h3 className="font-bold">Mnemosync Core</h3>
                                    <p className="text-xs text-dim">Active: {selectedModel.includes('3') ? 'Gemini 3' : 'Gemini 2.5'}</p>
                                </div>
                            </div>
                            <p className="text-sm text-dim" style={{ marginBottom: '1rem', lineHeight: 1.6 }}>
                                Real-time vision monitoring is active. I'm analyzing your environment to help with face recognition and daily routines.
                            </p>

                            <div className="flex items-center justify-between p-3 rounded-xl bg-glass border border-border">
                                <div className="flex items-center gap-2">
                                    <Activity size={16} className={isAutoScanEnabled ? "text-accent" : "text-dim"} />
                                    <span className="text-sm font-medium">Auto-Scan {isAutoScanEnabled ? 'ON' : 'OFF'}</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={isAutoScanEnabled}
                                        onChange={(e) => setIsAutoScanEnabled(e.target.checked)}
                                    />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                                </label>
                            </div>
                        </div>

                        {/* Memory Dashboard Button */}
                        <button
                            onClick={() => setIsDashboardOpen(true)}
                            className="card card-enhanced gradient-border hover:scale-[1.02] transition-transform cursor-pointer w-full text-white"
                        >
                            <div className="flex items-center gap-3">
                                <div style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', padding: '0.5rem', borderRadius: '0.75rem' }}>
                                    <History size={20} color="white" />
                                </div>
                                <div className="flex-1 text-left">
                                    <h3 className="font-bold text-sm">Memory Dashboard</h3>
                                    <p className="text-xs text-dim">View stored memories</p>
                                </div>
                            </div>
                        </button>

                        {/* Conversation Recorder */}
                        {primaryModel && (
                            <ConversationRecorder
                                primaryModel={primaryModel}
                                backupModel={backupModel}
                                identifiedPerson={identifiedPerson}
                                onDateDetected={(event) => {
                                    const now = new Date();
                                    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    const type = event.includes('📅') ? 'date' : 'action';
                                    const cleanEvent = event.replace(/^[📅✅]\s*/, '');

                                    setTasks(prev => {
                                        if (prev.some(t => t.event === cleanEvent)) return prev;
                                        return [...prev, {
                                            id: Math.random().toString(36).substr(2, 9),
                                            time: timeStr,
                                            event: cleanEvent,
                                            type
                                        }];
                                    });

                                    setMemoryLog(prev => [{ time: timeStr, event }, ...prev].slice(0, 10));
                                }}
                                onConversationUpdate={(summary, visitorInfo) => {
                                    setHistory(prev => `${prev}\n[Conversation] ${summary}`);
                                    setLastConversationSummary(summary);
                                    if (visitorInfo) {
                                        setLastVisitorInfo(visitorInfo);
                                    }
                                }}
                                patientName="User"
                            />
                        )}

                        {/* AI Voice Assistant */}
                        <VoiceAssistant
                            lastSummary={lastConversationSummary}
                            identifiedPerson={identifiedPerson}
                            visitorInfo={lastVisitorInfo}
                            patientName="User"
                        />

                        <div className="card">
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
                                border: '1px solid rgba(255,255,255,0.08)',
                                background: '#000'
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
                                        color: '#9ca3af',
                                        textAlign: 'center'
                                    }}>Awaiting first scan...</p>
                                )}
                            </div>
                        </div>
                    </div>
                </aside>
            </div>

            {/* Memory Dashboard */}
            <MemoryDashboard
                isOpen={isDashboardOpen}
                onClose={() => setIsDashboardOpen(false)}
            />
        </>
    );
}

export default App;

