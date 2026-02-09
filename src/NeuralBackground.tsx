import { useEffect, useRef } from 'react';

interface Node {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    color: string;
    pulse: number;
}

export default function NeuralBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const nodesRef = useRef<Node[]>([]);
    const animationRef = useRef<number>(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Account for the 75% scaling - use actual viewport size
        const resize = () => {
            // Get actual viewport dimensions (not scaled)
            const width = window.innerWidth / 0.75;
            const height = window.innerHeight / 0.75;
            canvas.width = width;
            canvas.height = height;

            // Reinitialize nodes on resize
            initNodes(width, height);
        };

        const colors = ['#818cf8', '#a855f7', '#34d399', '#60a5fa', '#f472b6'];

        const initNodes = (width: number, height: number) => {
            nodesRef.current = Array.from({ length: 100 }, () => ({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 1,
                vy: (Math.random() - 0.5) * 1,
                radius: 2 + Math.random() * 3,
                color: colors[Math.floor(Math.random() * colors.length)],
                pulse: Math.random() * Math.PI * 2
            }));
        };

        resize();
        window.addEventListener('resize', resize);

        // Animation loop
        const animate = () => {
            const width = canvas.width;
            const height = canvas.height;

            // Clear with semi-transparent black for trails
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(0, 0, width, height);

            const nodes = nodesRef.current;

            nodes.forEach((node, i) => {
                // Update position
                node.x += node.vx;
                node.y += node.vy;
                node.pulse += 0.015;

                // Wrap around edges
                if (node.x < 0) node.x = width;
                if (node.x > width) node.x = 0;
                if (node.y < 0) node.y = height;
                if (node.y > height) node.y = 0;

                // Draw connections
                nodes.slice(i + 1).forEach((node2) => {
                    const dx = node.x - node2.x;
                    const dy = node.y - node2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 100) {
                        ctx.beginPath();
                        ctx.moveTo(node.x, node.y);
                        ctx.lineTo(node2.x, node2.y);
                        ctx.strokeStyle = node.color;
                        ctx.globalAlpha = (1 - dist / 100) * 0.15;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                });

                // Pulsing effect
                const pulse = 0.5 + Math.sin(node.pulse * 3) * 0.3;

                // Draw node with glow
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
                ctx.fillStyle = node.color;
                ctx.globalAlpha = 0.7 * pulse;
                ctx.shadowBlur = 15;
                ctx.shadowColor = node.color;
                ctx.fill();
            });

            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', resize);
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '133.33vw',  /* Compensate for 75% scale */
                height: '133.33vh',
                zIndex: 0,
                pointerEvents: 'none',
                opacity: 1.0
            }}
        />
    );
}
