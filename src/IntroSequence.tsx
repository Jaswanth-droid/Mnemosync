import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface IntroSequenceProps {
    onComplete: () => void;
    mascotSrc: string;
}

// Enhanced particle with more properties
interface Particle {
    id: number;
    x: number;
    y: number;
    size: number;
    color: string;
    velocity: { x: number; y: number };
    opacity: number;
    life: number;
}

export default function IntroSequence({ onComplete, mascotSrc }: IntroSequenceProps) {
    const [phase, setPhase] = useState<'video' | 'transition' | 'reveal'>('video');
    const [videoEnded, setVideoEnded] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | null>(null);
    const particlesRef = useRef<Particle[]>([]);

    // Initialize particles
    useEffect(() => {
        if (phase !== 'transition' && phase !== 'reveal') return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        // Compensate for 0.75 scale in coordinates
        canvas.width = window.innerWidth * 1.3333;
        canvas.height = window.innerHeight * 1.3333;

        // Create particles
        const colors = ['#818cf8', '#a855f7', '#34d399', '#60a5fa', '#f472b6'];
        particlesRef.current = Array.from({ length: 100 }, (_, i) => ({
            id: i,
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: 2 + Math.random() * 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            velocity: {
                x: (Math.random() - 0.5) * 2,
                y: (Math.random() - 0.5) * 2
            },
            opacity: 0.3 + Math.random() * 0.7,
            life: Math.random()
        }));

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const animate = () => {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            particlesRef.current.forEach((p) => {
                // Update position
                p.x += p.velocity.x;
                p.y += p.velocity.y;
                p.life += 0.01;

                // Wrap around edges
                if (p.x < 0) p.x = canvas.width;
                if (p.x > canvas.width) p.x = 0;
                if (p.y < 0) p.y = canvas.height;
                if (p.y > canvas.height) p.y = 0;

                // Pulsing opacity
                const pulse = 0.5 + Math.sin(p.life * 3) * 0.3;

                // Draw particle with glow
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.opacity * pulse;
                ctx.shadowBlur = 15;
                ctx.shadowColor = p.color;
                ctx.fill();

                // Draw connection lines to nearby particles
                particlesRef.current.forEach((p2) => {
                    const dx = p.x - p2.x;
                    const dy = p.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 100 && dist > 0) {
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = p.color;
                        ctx.globalAlpha = (1 - dist / 100) * 0.15;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                });
            });

            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [phase]);

    // Handle video end
    const handleVideoEnd = () => {
        setVideoEnded(true);
        setPhase('transition');
        setTimeout(() => setPhase('reveal'), 1500);
        setTimeout(() => onComplete(), 5000);
    };

    // Auto-timeout for video
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (phase === 'video') handleVideoEnd();
        }, 30000);
        return () => clearTimeout(timeout);
    }, [phase]);

    return (
        <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            style={{
                position: 'fixed',
                inset: 0,
                background: '#000',
                zIndex: 1000,
                overflow: 'hidden'
            }}
        >
            {/* Video Phase */}
            <AnimatePresence>
                {phase === 'video' && (
                    <motion.video
                        key="intro-video"
                        initial={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.1 }}
                        transition={{ duration: 1.5, ease: 'easeInOut' }}
                        autoPlay
                        muted
                        playsInline
                        onEnded={handleVideoEnd}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                        }}
                    >
                        <source src="/intro.mp4" type="video/mp4" />
                    </motion.video>
                )}
            </AnimatePresence>

            {/* Particle Canvas - Transition & Reveal */}
            {(phase === 'transition' || phase === 'reveal') && (
                <canvas
                    ref={canvasRef}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%'
                    }}
                />
            )}

            {/* Transition - Glowing Orb */}
            <AnimatePresence>
                {phase === 'transition' && (
                    <motion.div
                        key="orb"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 0.8] }}
                        exit={{ scale: 3, opacity: 0 }}
                        transition={{ duration: 1.5, ease: 'easeOut' }}
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            width: 200,
                            height: 200,
                            marginLeft: -100,
                            marginTop: -100,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(129, 140, 248, 0.6) 0%, rgba(168, 85, 247, 0.3) 40%, transparent 70%)',
                            boxShadow: '0 0 100px 50px rgba(129, 140, 248, 0.3)',
                            filter: 'blur(10px)'
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Reveal Phase - Goddess */}
            <AnimatePresence>
                {phase === 'reveal' && (
                    <motion.div
                        key="goddess-reveal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        {/* Animated Rings */}
                        {[1, 2, 3, 4].map((ring) => (
                            <motion.div
                                key={ring}
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{
                                    scale: [1, 1.2, 1],
                                    opacity: [0.1, 0.3, 0.1],
                                    rotate: ring % 2 === 0 ? 360 : -360
                                }}
                                transition={{
                                    scale: { duration: 3 + ring * 0.5, repeat: Infinity },
                                    opacity: { duration: 3 + ring * 0.5, repeat: Infinity },
                                    rotate: { duration: 10 + ring * 5, repeat: Infinity, ease: 'linear' }
                                }}
                                style={{
                                    position: 'absolute',
                                    width: 200 + ring * 60,
                                    height: 200 + ring * 60,
                                    borderRadius: '50%',
                                    border: `1px solid rgba(129, 140, 248, ${0.4 - ring * 0.08})`,
                                    boxShadow: `0 0 ${30 + ring * 10}px rgba(129, 140, 248, 0.1)`
                                }}
                            />
                        ))}

                        {/* Goddess Image */}
                        <motion.div
                            initial={{ scale: 0, y: 50 }}
                            animate={{ scale: 1, y: 0 }}
                            transition={{ delay: 0.3, type: 'spring', stiffness: 100, damping: 15 }}
                            style={{ position: 'relative', zIndex: 10 }}
                        >
                            <motion.div
                                animate={{
                                    boxShadow: [
                                        '0 0 60px rgba(129, 140, 248, 0.4)',
                                        '0 0 100px rgba(168, 85, 247, 0.6)',
                                        '0 0 60px rgba(129, 140, 248, 0.4)'
                                    ]
                                }}
                                transition={{ duration: 3, repeat: Infinity }}
                                style={{
                                    width: 180,
                                    height: 180,
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                    border: '3px solid rgba(129, 140, 248, 0.5)'
                                }}
                            >
                                <img
                                    src={mascotSrc}
                                    alt="Mnemosync"
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        objectPosition: 'top'
                                    }}
                                />
                            </motion.div>
                        </motion.div>

                        {/* Text */}
                        <motion.h1
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.8 }}
                            style={{
                                fontSize: '2.5rem',
                                fontWeight: 700,
                                background: 'linear-gradient(135deg, #818cf8, #a855f7, #34d399)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                color: 'transparent',
                                marginTop: '2rem',
                                letterSpacing: '0.1em'
                            }}
                        >
                            MNEMOSYNC
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.2 }}
                            style={{
                                color: '#9ca3af',
                                fontSize: '1rem',
                                letterSpacing: '0.3em',
                                marginTop: '0.5rem',
                                textTransform: 'uppercase'
                            }}
                        >
                            Your Eternal Companion
                        </motion.p>

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.6 }}
                            style={{
                                color: '#6b7280',
                                fontStyle: 'italic',
                                marginTop: '1.5rem',
                                maxWidth: '400px',
                                textAlign: 'center',
                                lineHeight: 1.8
                            }}
                        >
                            "I am the keeper of memories. Let me be your eyes..."
                        </motion.p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Skip Button - Always visible */}
            <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                whileHover={{ opacity: 1, scale: 1.05 }}
                onClick={onComplete}
                style={{
                    position: 'absolute',
                    bottom: '2rem',
                    right: '2rem',
                    background: 'rgba(0,0,0,0.6)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '2rem',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    letterSpacing: '0.1em',
                    backdropFilter: 'blur(10px)',
                    zIndex: 100,
                    transition: 'all 0.3s ease'
                }}
            >
                SKIP →
            </motion.button>

            {/* Vignette Overlay */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)'
                }}
            />
        </motion.div>
    );
}
