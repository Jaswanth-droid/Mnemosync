import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, MessageCircle } from 'lucide-react';

interface VoiceAssistantProps {
    lastSummary: string;
    identifiedPerson: { name: string; relation: string } | null;
    visitorInfo?: { name: string; relation: string } | null;
    patientName?: string;
}

export default function VoiceAssistant({
    lastSummary,
    identifiedPerson,
    visitorInfo,
    patientName = 'User'
}: VoiceAssistantProps) {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isEnabled, setIsEnabled] = useState(true);
    const [lastSpoken, setLastSpoken] = useState<string>('');
    const [voicesReady, setVoicesReady] = useState(false);
    const [audioIntensity, setAudioIntensity] = useState(0.5);
    const synthRef = useRef<SpeechSynthesis | null>(null);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const animationFrameRef = useRef<number | undefined>(undefined);

    // Initialize speech synthesis and wait for voices to load
    useEffect(() => {
        if ('speechSynthesis' in window) {
            synthRef.current = window.speechSynthesis;

            // Chrome loads voices asynchronously
            const loadVoices = () => {
                const voices = synthRef.current?.getVoices() || [];
                if (voices.length > 0) {
                    setVoicesReady(true);
                    console.log(`[Mnemosync] ${voices.length} voices loaded`);
                }
            };

            // Try immediately
            loadVoices();

            // Also listen for the voiceschanged event (required for Chrome)
            speechSynthesis.onvoiceschanged = loadVoices;
        }
    }, []);

    // Speak Mnemosyne introduction
    const speakIntroduction = useCallback(() => {
        if (!synthRef.current) return;

        // Cancel any ongoing speech first to prevent overlap
        synthRef.current.cancel();

        const introText = `I am Mnemosync, your personal AI Recall assistant. I'm here to help you remember your conversations and the people you meet.`;

        const utterance = new SpeechSynthesisUtterance(introText);
        utterance.rate = 0.9;
        utterance.pitch = 1.15;
        utterance.volume = 1.0;

        // Find female voice
        const voices = synthRef.current.getVoices();
        const femaleVoiceKeywords = ['Microsoft Zira', 'Google UK English Female', 'Samantha', 'Karen', 'Female', 'Zira'];
        for (const keyword of femaleVoiceKeywords) {
            const match = voices.find((v: SpeechSynthesisVoice) =>
                v.name.toLowerCase().includes(keyword.toLowerCase()) && v.lang.startsWith('en')
            );
            if (match) {
                utterance.voice = match;
                break;
            }
        }

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);

        synthRef.current.speak(utterance);
    }, []);

    // Auto-speak introduction when voices are ready (only once on startup)
    const hasIntroducedRef = useRef(false);
    useEffect(() => {
        if (voicesReady && isEnabled && !hasIntroducedRef.current) {
            hasIntroducedRef.current = true;
            // Delay slightly to ensure everything is loaded
            setTimeout(() => {
                speakIntroduction();
            }, 800);
        }
    }, [voicesReady, isEnabled, speakIntroduction]);

    // Speak text using Web Speech API
    const speakText = useCallback((text: string) => {
        if (!synthRef.current) return;

        // Cancel any ongoing speech
        synthRef.current.cancel();

        // Create Alzheimer's-focused greeting mentioning who they were talking to
        let greeting = '';

        if (visitorInfo && visitorInfo.name) {
            greeting = `Dear ${patientName}, you were just speaking with ${visitorInfo.name}`;
            if (visitorInfo.relation && visitorInfo.relation !== 'visitor') {
                greeting += `, your ${visitorInfo.relation}. `;
            } else {
                greeting += `. `;
            }
        }

        const utterance = new SpeechSynthesisUtterance(greeting + text);
        utterance.rate = 0.9;
        utterance.pitch = 1.15;
        utterance.volume = 1.0;

        const voices = synthRef.current.getVoices();

        const femaleVoiceKeywords = [
            'Microsoft Zira',
            'Google UK English Female',
            'Samantha',
            'Karen',
            'Moira',
            'Fiona',
            'Victoria',
            'Google US English',
            'Female',
            'Zira',
            'Hazel',
        ];

        let selectedVoice: SpeechSynthesisVoice | null = null;

        for (const keyword of femaleVoiceKeywords) {
            const match = voices.find(v =>
                v.name.toLowerCase().includes(keyword.toLowerCase()) &&
                v.lang.startsWith('en')
            );
            if (match) {
                selectedVoice = match;
                break;
            }
        }

        if (!selectedVoice) {
            selectedVoice = voices.find(v =>
                v.lang.startsWith('en') &&
                (v.name.toLowerCase().includes('female') ||
                    v.name.toLowerCase().includes('woman'))
            ) || voices.find(v => v.lang.startsWith('en')) || null;
        }

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        utteranceRef.current = utterance;
        synthRef.current.speak(utterance);
    }, [visitorInfo, patientName]);

    // Simulate audio intensity variations during speech
    useEffect(() => {
        if (isSpeaking) {
            let time = 0;
            const animate = () => {
                time += 0.05;
                // Simulate pitch variations with layered sine waves
                const base = Math.sin(time * 2) * 0.3;
                const mid = Math.sin(time * 3.5) * 0.2;
                const high = Math.sin(time * 5) * 0.15;
                const intensity = 0.5 + base + mid + high;
                setAudioIntensity(Math.max(0.2, Math.min(0.9, intensity)));
                animationFrameRef.current = requestAnimationFrame(animate);
            };
            animate();
        } else {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            setAudioIntensity(0.5);
        }
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isSpeaking]);

    // Stop speaking
    const stopSpeaking = useCallback(() => {
        if (synthRef.current) {
            synthRef.current.cancel();
            setIsSpeaking(false);
        }
    }, []);

    return (
        <div className="card card-enhanced relative overflow-hidden h-full flex flex-col">
            <AnimatePresence>
                {isSpeaking && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-10 bg-[#0A0B14]/95 backdrop-blur-xl flex flex-col items-center justify-center p-6"
                    >
                        {/* Immersive Pulse Rings */}
                        {[1, 2, 3].map((i) => (
                            <motion.div
                                key={i}
                                animate={{
                                    scale: [1, 2.5],
                                    opacity: [0.3, 0]
                                }}
                                transition={{
                                    duration: 4,
                                    repeat: Infinity,
                                    delay: i * 1.3,
                                    ease: "easeOut"
                                }}
                                className="absolute rounded-full border border-indigo-500/30"
                                style={{ width: 100, height: 100 }}
                            />
                        ))}

                        {/* Siri-Style Morphing Blob - Centered */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ width: 200, height: 200 }}>

                            {/* Outer Glow Rings */}
                            {[1, 2, 3].map((ring) => (
                                <motion.div
                                    key={ring}
                                    animate={{
                                        scale: [1, 1.6],
                                        opacity: [0.2, 0]
                                    }}
                                    transition={{
                                        duration: 1.8,
                                        repeat: Infinity,
                                        delay: ring * 0.4,
                                        ease: "easeOut"
                                    }}
                                    style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        width: 150,
                                        height: 150,
                                        marginLeft: -75,
                                        marginTop: -75,
                                        borderRadius: '50%',
                                        border: '2px solid rgba(168, 85, 247, 0.25)',
                                        boxShadow: '0 0 40px rgba(139, 92, 246, 0.2)'
                                    }}
                                />
                            ))}

                            {/* Main Morphing Blob - Layer 1 */}
                            <motion.div
                                animate={{
                                    borderRadius: [
                                        '60% 40% 30% 70% / 60% 30% 70% 40%',
                                        '30% 60% 70% 40% / 50% 60% 30% 60%',
                                        '70% 30% 40% 60% / 40% 70% 50% 50%',
                                        '60% 40% 30% 70% / 60% 30% 70% 40%'
                                    ],
                                    rotate: [0, 180, 360],
                                    scale: [1 * (0.9 + audioIntensity * 0.3), 1.2 * (0.9 + audioIntensity * 0.3), 1.1 * (0.9 + audioIntensity * 0.3), 1 * (0.9 + audioIntensity * 0.3)],
                                    x: [-8 * audioIntensity, 8 * audioIntensity, -5 * audioIntensity, -8 * audioIntensity],
                                    y: [-5 * audioIntensity, 5 * audioIntensity, -8 * audioIntensity, -5 * audioIntensity]
                                }}
                                transition={{
                                    duration: 4 / (0.5 + audioIntensity * 0.5),
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    width: 140,
                                    height: 140,
                                    marginLeft: -70,
                                    marginTop: -70,
                                    background: 'radial-gradient(circle at 40% 40%, rgba(168, 85, 247, 0.5) 0%, rgba(139, 92, 246, 0.4) 50%, rgba(99, 102, 241, 0.3) 100%)',
                                    boxShadow: '0 0 60px rgba(139, 92, 246, 0.5), 0 0 100px rgba(99, 102, 241, 0.2), inset 0 0 60px rgba(168, 85, 247, 0.15)',
                                    filter: 'blur(1px)'
                                }}
                            />

                            {/* Overlapping Blob - Layer 2 */}
                            <motion.div
                                animate={{
                                    borderRadius: [
                                        '40% 60% 60% 40% / 60% 30% 70% 40%',
                                        '60% 40% 30% 70% / 50% 70% 30% 60%',
                                        '50% 50% 60% 40% / 70% 40% 50% 60%',
                                        '40% 60% 60% 40% / 60% 30% 70% 40%'
                                    ],
                                    rotate: [0, -150, -360],
                                    scale: [1 * (0.85 + audioIntensity * 0.35), 1.15 * (0.85 + audioIntensity * 0.35), 1.25 * (0.85 + audioIntensity * 0.35), 1 * (0.85 + audioIntensity * 0.35)],
                                    x: [5 * audioIntensity, -10 * audioIntensity, 8 * audioIntensity, 5 * audioIntensity],
                                    y: [8 * audioIntensity, -6 * audioIntensity, 10 * audioIntensity, 8 * audioIntensity]
                                }}
                                transition={{
                                    duration: 3.5 / (0.5 + audioIntensity * 0.5),
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    width: 130,
                                    height: 130,
                                    marginLeft: -65,
                                    marginTop: -65,
                                    background: 'radial-gradient(circle at 60% 30%, rgba(139, 92, 246, 0.55) 0%, rgba(99, 102, 241, 0.4) 60%, rgba(79, 70, 229, 0.25) 100%)',
                                    boxShadow: '0 0 50px rgba(139, 92, 246, 0.4)',
                                    filter: 'blur(2px)'
                                }}
                            />

                            {/* Inner Core Blob */}
                            <motion.div
                                animate={{
                                    borderRadius: [
                                        '50% 50% 40% 60% / 55% 45% 55% 45%',
                                        '45% 55% 60% 40% / 50% 60% 40% 60%',
                                        '60% 40% 50% 50% / 45% 55% 45% 55%',
                                        '50% 50% 40% 60% / 55% 45% 55% 45%'
                                    ],
                                    scale: [1, 1.3, 1.15, 1],
                                    opacity: [0.6, 0.8, 0.7, 0.6],
                                    x: [-3, 6, -4, -3],
                                    y: [4, -5, 6, 4]
                                }}
                                transition={{
                                    duration: 2.5,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    width: 80,
                                    height: 80,
                                    marginLeft: -40,
                                    marginTop: -40,
                                    background: 'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.4) 0%, rgba(168, 85, 247, 0.25) 100%)',
                                    filter: 'blur(8px)'
                                }}
                            />

                            {/* Accent Highlights */}
                            <motion.div
                                animate={{
                                    borderRadius: [
                                        '70% 30% 50% 50% / 40% 60% 40% 60%',
                                        '30% 70% 50% 50% / 60% 40% 60% 40%',
                                        '50% 50% 70% 30% / 50% 50% 70% 30%',
                                        '70% 30% 50% 50% / 40% 60% 40% 60%'
                                    ],
                                    x: [-8, 10, -6, -8],
                                    y: [-6, 8, -10, -6],
                                    scale: [1, 1.2, 1.1, 1],
                                    opacity: [0.4, 0.7, 0.5, 0.4]
                                }}
                                transition={{
                                    duration: 3,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    width: 60,
                                    height: 60,
                                    marginLeft: -30,
                                    marginTop: -30,
                                    background: 'radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%)',
                                    filter: 'blur(6px)'
                                }}
                            />
                        </div>

                        {/* High-Density Sound Wave */}
                        <div className="flex items-center justify-center gap-1.5 h-12 mb-8 relative z-20">
                            {Array.from({ length: 15 }).map((_, i) => {
                                const dist = Math.abs(7 - i);
                                const h = 48 - (dist * 4);
                                return (
                                    <motion.div
                                        key={i}
                                        animate={{
                                            height: [h * 0.3, h, h * 0.5, h * 0.8, h * 0.3]
                                        }}
                                        transition={{
                                            duration: 1.2,
                                            repeat: Infinity,
                                            delay: i * 0.05
                                        }}
                                        className="w-1 rounded-full bg-gradient-to-t from-indigo-600 via-purple-500 to-indigo-400 shadow-[0_0_15px_rgba(139,92,246,0.5)]"
                                    />
                                );
                            })}
                        </div>

                        {/* Status Text */}
                        <div className="flex flex-col items-center gap-2 relative z-20">
                            <span className="text-[10px] tracking-[0.4em] uppercase font-bold text-indigo-400/60">AI Core Active</span>
                            <div className="flex items-center gap-2">
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 1, repeat: Infinity }}
                                    className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#10b981]"
                                />
                                <span className="text-sm font-bold text-white">Mnemosync Speaking</span>
                            </div>
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={stopSpeaking}
                            className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors group"
                        >
                            <VolumeX size={16} className="text-white/40 group-hover:text-white" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Standard Idle UI - Now with BOLDER Ambient Animations */}
            <div className={`flex flex-col h-full transition-opacity duration-500 relative ${isSpeaking ? 'opacity-0' : 'opacity-100'}`}>
                {/* Bold Ambient Background Glow */}
                <motion.div
                    animate={{
                        opacity: [0.1, 0.2, 0.1],
                        scale: [1, 1.15, 1],
                        background: [
                            'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
                            'radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.25) 0%, transparent 70%)',
                            'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.15) 0%, transparent 70%)'
                        ]
                    }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 rounded-xl pointer-events-none"
                />

                {/* Vertical Scanning Line Sweep */}
                <motion.div
                    animate={{
                        top: ['-10%', '110%'],
                        opacity: [0, 0.3, 0]
                    }}
                    transition={{
                        duration: 3,
                        repeat: Infinity,
                        repeatDelay: 2,
                        ease: "easeInOut"
                    }}
                    className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-400 to-transparent z-0 pointer-events-none"
                    style={{ boxShadow: '0 0 15px rgba(129, 140, 248, 0.5)' }}
                />

                {/* Floating "Data Particles" - Increased count and opacity */}
                {Array.from({ length: 6 }).map((_, i) => (
                    <motion.div
                        key={i}
                        initial={{ x: Math.random() * 300, y: Math.random() * 150, opacity: 0 }}
                        animate={{
                            x: [null, Math.random() * 300],
                            y: [null, Math.random() * 150],
                            opacity: [0, 0.4, 0],
                            scale: [0.5, 1, 0.5]
                        }}
                        transition={{
                            duration: 8 + Math.random() * 8,
                            repeat: Infinity,
                            ease: "linear"
                        }}
                        className="absolute w-1 h-1 bg-indigo-300 rounded-full blur-[0.5px] pointer-events-none z-0"
                    />
                ))}

                <div className="flex items-center justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-3">
                        <motion.div
                            animate={{
                                scale: [1, 1.1, 1],
                                boxShadow: [
                                    '0 0 10px rgba(139, 92, 246, 0.2)',
                                    '0 0 25px rgba(139, 92, 246, 0.5)',
                                    '0 0 10px rgba(139, 92, 246, 0.2)'
                                ]
                            }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                            className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20"
                        >
                            <Volume2 size={18} color="white" />
                        </motion.div>
                        <div>
                            <h3 className="font-bold text-sm tracking-tight text-white">Voice Assistant</h3>
                            <div className="flex items-center gap-2">
                                {/* Resting Wave Visualizer */}
                                <div className="flex items-end gap-0.5 h-2">
                                    {[1, 2, 3].map(i => (
                                        <motion.div
                                            key={i}
                                            animate={{ height: ['20%', '100%', '20%'] }}
                                            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                                            className="w-0.5 bg-indigo-400 rounded-full"
                                        />
                                    ))}
                                </div>
                                <p className="text-[10px] text-indigo-400 font-bold tracking-widest uppercase">
                                    {voicesReady ? 'ONLINE' : 'BOOTING...'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 relative z-10">
                        {voicesReady && (
                            <button
                                onClick={() => lastSummary && speakText(lastSummary)}
                                disabled={!lastSummary}
                                className="px-4 py-1.5 text-[11px] rounded-lg font-black transition-all hover:scale-105 active:scale-95 disabled:opacity-40 bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] border border-white/20 uppercase tracking-tighter"
                            >
                                🎙️ Recall
                            </button>
                        )}
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={isEnabled}
                                onChange={(e) => setIsEnabled(e.target.checked)}
                            />
                            <div className="w-9 h-5 bg-gray-700/50 rounded-full peer peer-checked:bg-indigo-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 shadow-inner border border-white/5"></div>
                        </label>
                    </div>
                </div>

                <div className="flex-1 relative z-10">
                    {lastSummary ? (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md relative overflow-hidden group"
                        >
                            {/* Subtle internal scan line for the summary box */}
                            <motion.div
                                animate={{ left: ['-100%', '200%'] }}
                                transition={{ duration: 2, repeat: Infinity, repeatDelay: 5 }}
                                className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 pointer-events-none"
                            />
                            <p className="text-[11px] text-dim italic line-clamp-3 leading-relaxed relative z-10">
                                "{lastSummary}"
                            </p>
                        </motion.div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center p-4 border border-dashed border-white/5 rounded-xl gap-2">
                            <motion.div
                                animate={{ opacity: [0.2, 0.5, 0.2] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                <MessageCircle size={20} className="text-white/10" />
                            </motion.div>
                            <p className="text-[10px] text-white/20 uppercase tracking-[0.3em] font-black">Awaiting Memory</p>
                        </div>
                    )}
                </div>

                {!('speechSynthesis' in window) && (
                    <div className="mt-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20 relative z-10">
                        <p className="text-[10px] text-red-400 font-bold text-center">VOICE ENGINE OFFLINE</p>
                    </div>
                )}
            </div>
        </div>
    );
}
