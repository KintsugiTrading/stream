'use client';

import { useControls } from 'leva';
import { useRef } from 'react';
import { Group } from 'three';
import Stream from './Stream';

export default function Trailer() {
    const trailerRef = useRef<Group>(null);

    const { slope } = useControls('Trailer Settings', {
        slope: { value: 2, min: 0, max: 15, step: 0.1, label: 'Slope (deg)' },
    });

    // Convert degrees to radians for rotation
    const slopeRad = (slope * Math.PI) / 180;

    return (
        <group ref={trailerRef} rotation={[slopeRad, 0, 0]}>
            {/* The main container (Pan) */}
            <mesh receiveShadow castShadow position={[0, -0.25, 0]}>
                <boxGeometry args={[4, 0.5, 8]} />
                <meshStandardMaterial color="#444" roughness={0.8} metalness={0.2} />
            </mesh>

            {/* Side Walls */}
            <mesh receiveShadow castShadow position={[2.1, 0.5, 0]}>
                <boxGeometry args={[0.2, 2, 8]} />
                <meshStandardMaterial color="#333" roughness={0.8} metalness={0.2} />
            </mesh>
            <mesh receiveShadow castShadow position={[-2.1, 0.5, 0]}>
                <boxGeometry args={[0.2, 2, 8]} />
                <meshStandardMaterial color="#333" roughness={0.8} metalness={0.2} />
            </mesh>
            <mesh receiveShadow castShadow position={[0, 0.5, -4.1]}>
                <boxGeometry args={[4.4, 2, 0.2]} />
                <meshStandardMaterial color="#333" roughness={0.8} metalness={0.2} />
            </mesh>
            {/* Bottom End (Open or gated? usually open for drain, but let's close it for now or make it a gate) */}
            <mesh receiveShadow castShadow position={[0, 0, 4.1]}>
                <boxGeometry args={[4.4, 1, 0.2]} />
                <meshStandardMaterial color="#333" roughness={0.8} metalness={0.2} />
            </mesh>

            {/* The Stream Simulation */}
            <Stream slope={slope} />
        </group>
    );
}
