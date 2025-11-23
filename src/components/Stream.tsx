'use client';

import { useFrame, useThree, extend } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
import { WaterFragmentShader, TerrainFragmentShader } from '@/materials/SimulationShaders';
import { useControls } from 'leva';

// Extend so we can use it if needed
extend({ GPUComputationRenderer });

const WIDTH = 128;

interface StreamProps {
    slope: number;
}

export default function Stream({ slope }: StreamProps) {
    const { gl } = useThree();
    const gpuCompute = useRef<GPUComputationRenderer | null>(null);
    const waterVariable = useRef<any>(null);
    const terrainVariable = useRef<any>(null);

    const waterMaterialRef = useRef<THREE.ShaderMaterial>(null);
    const terrainMaterialRef = useRef<THREE.ShaderMaterial>(null);

    // Obstacles
    const obstacleTexture = useRef<THREE.DataTexture>(null);
    const [plants, setPlants] = useState<{ x: number, y: number }[]>([]);

    // Mouse State
    const mousePos = useRef(new THREE.Vector2(0, 0));
    const isMouseDown = useRef(false);

    // Controls
    const { tool, viscosity, flowRate, erosionRate, depositionRate, mouseSize, mouseStrength } = useControls('Simulation', {
        tool: { options: ['shovel', 'plant'] },
        viscosity: { value: 0.98, min: 0.9, max: 0.999 },
        flowRate: { value: 2.0, min: 0, max: 10 },
        erosionRate: { value: 0.5, min: 0, max: 2 },
        depositionRate: { value: 0.5, min: 0, max: 2 },
        mouseSize: { value: 0.05, min: 0.01, max: 0.2 },
        mouseStrength: { value: 5.0, min: 1.0, max: 10.0 },
    });

    const [simReady, setSimReady] = useState(false);

    // Initialize Simulation
    useEffect(() => {
        if (!gl) return;

        const gpu = new GPUComputationRenderer(WIDTH, WIDTH, gl);

        // 1. Water State
        const dtWater = gpu.createTexture();

        // 2. Terrain State
        const dtTerrain = gpu.createTexture();
        const terrainData = dtTerrain.image.data;
        if (terrainData) {
            for (let i = 0; i < terrainData.length; i += 4) {
                // Initial sand bed height (add some noise or slope if needed)
                terrainData[i] = 1.0;
                terrainData[i + 1] = 0; // Sediment
            }
        }

        // 3. Obstacles State (Static Texture)
        const dtObstacles = new THREE.DataTexture(
            new Float32Array(WIDTH * WIDTH * 4),
            WIDTH,
            WIDTH,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        dtObstacles.needsUpdate = true;
        obstacleTexture.current = dtObstacles;

        // Add Variables
        const wVar = gpu.addVariable('tWater', WaterFragmentShader, dtWater);
        const tVar = gpu.addVariable('tTerrain', TerrainFragmentShader, dtTerrain);

        // Dependencies
        gpu.setVariableDependencies(wVar, [wVar, tVar]);
        gpu.setVariableDependencies(tVar, [tVar, wVar]);

        // Check for errors
        const error = gpu.init();
        if (error !== null) {
            console.error(error);
            return;
        }

        waterVariable.current = wVar;
        terrainVariable.current = tVar;
        gpuCompute.current = gpu;
        setSimReady(true);
    }, [gl]);

    // Simulation Loop
    useFrame((state, delta) => {
        if (!simReady || !gpuCompute.current || !waterVariable.current || !terrainVariable.current) return;

        const gpu = gpuCompute.current;
        const wVar = waterVariable.current;
        const tVar = terrainVariable.current;

        // Update Water Uniforms
        wVar.material.uniforms.delta = { value: delta };
        wVar.material.uniforms.gridDim = { value: new THREE.Vector2(WIDTH, WIDTH) };
        wVar.material.uniforms.viscosity = { value: viscosity };
        wVar.material.uniforms.flowRate = { value: flowRate };
        wVar.material.uniforms.slope = { value: slope }; // Pass slope
        wVar.material.uniforms.tObstacles = { value: obstacleTexture.current };

        // Mouse Interaction
        if (isMouseDown.current && tool === 'shovel') {
            wVar.material.uniforms.mousePos = { value: mousePos.current };
            wVar.material.uniforms.mouseStrength = { value: mouseStrength };
        } else {
            wVar.material.uniforms.mouseStrength = { value: 0 };
        }
        wVar.material.uniforms.mouseSize = { value: mouseSize };


        // Update Terrain Uniforms
        tVar.material.uniforms.delta = { value: delta };
        tVar.material.uniforms.gridDim = { value: new THREE.Vector2(WIDTH, WIDTH) };
        tVar.material.uniforms.erosionRate = { value: erosionRate };
        tVar.material.uniforms.depositionRate = { value: depositionRate };

        // Compute
        gpu.compute();

        // Update Visual Materials
        if (waterMaterialRef.current) {
            waterMaterialRef.current.uniforms.tWater.value = gpu.getCurrentRenderTarget(wVar).texture;
            waterMaterialRef.current.uniforms.tTerrain.value = gpu.getCurrentRenderTarget(tVar).texture;
        }
        if (terrainMaterialRef.current) {
            terrainMaterialRef.current.uniforms.tTerrain.value = gpu.getCurrentRenderTarget(tVar).texture;
        }
    });

    const handlePointerMove = (e: any) => {
        if (e.uv) {
            mousePos.current.set(e.uv.x, e.uv.y);
        }
    };

    const handlePointerDown = (e: any) => {
        if (!e.uv) return;

        if (tool === 'plant') {
            // Place Plant
            const x = Math.floor(e.uv.x * WIDTH);
            const y = Math.floor(e.uv.y * WIDTH);

            if (obstacleTexture.current) {
                const data = obstacleTexture.current.image.data;
                if (data) {
                    // Set resistance in Red channel
                    // Make it a 3x3 block for visibility
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const currentX = x + dx;
                            const currentY = y + dy;
                            if (currentX >= 0 && currentX < WIDTH && currentY >= 0 && currentY < WIDTH) {
                                const idx = (currentY * WIDTH + currentX) * 4;
                                data[idx] = 1.0; // Set red channel to 1.0 for obstacle
                            }
                        }
                    }
                    obstacleTexture.current.needsUpdate = true;

                    // Update visual list
                    setPlants(prev => [...prev, { x: e.uv.x, y: e.uv.y }]);
                }
            }
        } else { // 'shovel' tool
            isMouseDown.current = true;
            mousePos.current.set(e.uv.x, e.uv.y);
        }
    };

    const handlePointerUp = () => {
        isMouseDown.current = false;
    };

    // Water Visual Material
    const waterMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: {
                tWater: { value: null },
                tTerrain: { value: null },
                color: { value: new THREE.Color('#00aaff') },
            },
            vertexShader: `
        uniform sampler2D tWater;
        uniform sampler2D tTerrain;
        varying float vHeight;
        void main() {
            vec2 uv = uv;
            float waterH = texture2D(tWater, uv).x;
            float terrainH = texture2D(tTerrain, uv).x;
            
            vHeight = waterH;
            
            vec3 pos = position;
            pos.y += (terrainH + waterH) * 0.5; // Sit on top of terrain
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
            fragmentShader: `
        uniform vec3 color;
        varying float vHeight;
        void main() {
            if (vHeight < 0.01) discard; // Don't render empty water
            float opacity = clamp(vHeight * 2.0, 0.3, 0.9);
            gl_FragColor = vec4(color, opacity);
        }
      `,
            transparent: true,
            side: THREE.DoubleSide,
        });
    }, []);

    // Terrain Visual Material
    const terrainMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: {
                tTerrain: { value: null },
                sandColor: { value: new THREE.Color('#d2b48c') },
            },
            vertexShader: `
        uniform sampler2D tTerrain;
        varying float vHeight;
        void main() {
            vec2 uv = uv;
            float terrainH = texture2D(tTerrain, uv).x;
            vHeight = terrainH;
            
            vec3 pos = position;
            pos.y += terrainH * 0.5;
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
            fragmentShader: `
        uniform vec3 sandColor;
        varying float vHeight;
        void main() {
            // Simple lighting fake
            vec3 col = sandColor * (0.8 + vHeight * 0.2);
            gl_FragColor = vec4(col, 1.0);
        }
      `,
        });
    }, []);

    return (
        <group
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.2, 0]}
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
        >
            {/* Terrain Mesh */}
            <mesh receiveShadow>
                <planeGeometry args={[3.8, 7.8, WIDTH - 1, WIDTH - 1]} />
                <primitive object={terrainMaterial} ref={terrainMaterialRef} attach="material" />
            </mesh>

            {/* Water Mesh */}
            <mesh>
                <planeGeometry args={[3.8, 7.8, WIDTH - 1, WIDTH - 1]} />
                <primitive object={waterMaterial} ref={waterMaterialRef} attach="material" />
            </mesh>

            {/* Plants */}
            {plants.map((p, i) => (
                <mesh key={i} position={[(p.x - 0.5) * 3.8, (p.y - 0.5) * 7.8, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.05, 0.05, 0.5, 8]} />
                    <meshStandardMaterial color="#228b22" />
                </mesh>
            ))}
        </group>
    );
}
