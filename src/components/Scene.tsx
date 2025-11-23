'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, PerspectiveCamera } from '@react-three/drei';
import { Suspense } from 'react';
import Trailer from './Trailer';

export default function Scene() {
  return (
    <div className="w-full h-screen bg-gray-900">
      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[5, 5, 5]} fov={50} />
        <OrbitControls 
          maxPolarAngle={Math.PI / 2 - 0.1} // Prevent going below ground
          minDistance={2}
          maxDistance={15}
        />
        
        <ambientLight intensity={0.5} />
        <directionalLight 
          position={[10, 10, 5]} 
          intensity={1.5} 
          castShadow 
          shadow-mapSize={[2048, 2048]}
        />
        <Environment preset="city" />

        <Suspense fallback={null}>
          <Trailer />
          <gridHelper args={[20, 20]} position={[0, -0.01, 0]} />
        </Suspense>
      </Canvas>
    </div>
  );
}
