import React, { useMemo } from 'react';
import * as THREE from 'three';

export function Tree({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
            {/* Trunk */}
            <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.05, 0.07, 0.4, 8]} />
                <meshStandardMaterial color="#5c4033" roughness={0.9} />
            </mesh>
            {/* Foliage */}
            <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
                <coneGeometry args={[0.25, 0.6, 8]} />
                <meshStandardMaterial color="#228b22" roughness={0.8} />
            </mesh>
        </group>
    );
}

export function Bush({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
            <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
                <sphereGeometry args={[0.2, 8, 8]} />
                <meshStandardMaterial color="#32cd32" roughness={0.8} />
            </mesh>
        </group>
    );
}

export function Grass({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
            <mesh position={[0, 0.1, 0]} rotation={[0, Math.PI / 4, 0]}>
                <planeGeometry args={[0.2, 0.2]} />
                <meshStandardMaterial color="#7cfc00" side={THREE.DoubleSide} transparent alphaTest={0.5} />
            </mesh>
            <mesh position={[0, 0.1, 0]} rotation={[0, -Math.PI / 4, 0]}>
                <planeGeometry args={[0.2, 0.2]} />
                <meshStandardMaterial color="#7cfc00" side={THREE.DoubleSide} transparent alphaTest={0.5} />
            </mesh>
        </group>
    );
}
