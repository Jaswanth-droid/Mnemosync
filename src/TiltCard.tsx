import { useRef, type CSSProperties, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';

interface TiltCardProps {
    children: ReactNode;
    className?: string;
    style?: CSSProperties;
    maxTilt?: number;
}

export default function TiltCard({ children, className = '', style, maxTilt = 5 }: TiltCardProps) {
    const ref = useRef<HTMLDivElement>(null);

    const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
        const el = ref.current;
        if (!el || e.pointerType !== 'mouse') return;
        const rect = el.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        el.style.transform = `perspective(1100px) rotateY(${px * maxTilt}deg) rotateX(${-py * maxTilt}deg) translateZ(10px)`;
    };

    const onLeave = () => {
        const el = ref.current;
        if (el) el.style.transform = '';
    };

    return (
        <div
            ref={ref}
            className={className}
            style={style}
            onPointerMove={onMove}
            onPointerLeave={onLeave}
        >
            {children}
        </div>
    );
}
