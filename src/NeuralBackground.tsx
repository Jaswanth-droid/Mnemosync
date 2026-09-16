// @ts-nocheck
import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

const PASTELS = ['#f9c8dd', '#bcdcf7', '#c4ecd9', '#ffe0c2', '#ddd0f7', '#fdf3c0'];

interface BlobProps {
    position: [number, number, number];
    color: string;
    scale: number;
    kind: number;
    speed: number;
}

function PastelBlob({ position, color, scale, kind, speed }: BlobProps) {
    const ref = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (!ref.current) return;
        ref.current.rotation.x = state.clock.elapsedTime * 0.12 * speed;
        ref.current.rotation.y = state.clock.elapsedTime * 0.16 * speed;
    });

    const geometry = useMemo(() => {
        switch (kind % 4) {
            case 0:
                return <icosahedronGeometry args={[1, 0]} />;
            case 1:
                return <torusGeometry args={[1, 0.38, 24, 48]} />;
            case 2:
                return <sphereGeometry args={[1, 48, 48]} />;
            default:
                return <torusKnotGeometry args={[0.8, 0.26, 120, 24]} />;
        }
    }, [kind]);

    return (
        <Float speed={speed * 1.4} rotationIntensity={0.5} floatIntensity={1.6}>
            <mesh ref={ref} position={position} scale={scale} castShadow={false}>
                {geometry}
                <meshStandardMaterial
                    color={color}
                    roughness={0.28}
                    metalness={0.08}
                    emissive={color}
                    emissiveIntensity={0.12}
                    transparent
                    opacity={0.85}
                />
            </mesh>
        </Float>
    );
}

function Scene() {
    const group = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (!group.current) return;
        const { x, y } = state.pointer;
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, x * 0.18, 0.04);
        group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -y * 0.12, 0.04);
    });

    const blobs = useMemo<BlobProps[]>(() => {
        const items: BlobProps[] = [];
        for (let i = 0; i < 14; i++) {
            const angle = (i / 14) * Math.PI * 2;
            const radius = 6 + (i % 3) * 2.4;
            items.push({
                position: [
                    Math.cos(angle) * radius,
                    Math.sin(angle * 1.7) * 3.4,
                    -4 - (i % 4) * 2.2,
                ],
                color: PASTELS[i % PASTELS.length],
                scale: 0.7 + ((i * 37) % 10) / 9,
                kind: i,
                speed: 0.6 + ((i * 13) % 8) / 10,
            });
        }
        return items;
    }, []);

    return (
        <group ref={group}>
            <ambientLight intensity={1.15} color="#fff4fa" />
            <directionalLight position={[6, 8, 6]} intensity={1.1} color="#ffe3f1" />
            <directionalLight position={[-6, -4, 4]} intensity={0.55} color="#d7e9ff" />
            {blobs.map((b, i) => (
                <PastelBlob key={i} {...b} />
            ))}
            <Sparkles count={140} scale={[26, 14, 12]} size={3} speed={0.35} opacity={0.55} color="#c9a8f0" />
        </group>
    );
}

export default function NeuralBackground() {
    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '133.33vw',
                height: '133.33vh',
                zIndex: 0,
                pointerEvents: 'none',
            }}
        >
            <Canvas
                dpr={[1, 2.5]}
                camera={{ position: [0, 0, 12], fov: 50 }}
                gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
                style={{ pointerEvents: 'none' }}
            >
                <fog attach="fog" args={['#fbf7fe', 14, 34]} />
                <Scene />
            </Canvas>
        </div>
    );
}
