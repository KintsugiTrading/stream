'use client';

import { useFrame, useThree, extend } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
import { WaterFragmentShader, TerrainFragmentShader } from '@/materials/SimulationShaders';
import { useControls } from 'leva';
import { Tree, Bush, Grass } from './VegetationModels';

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
    const [plants, setPlants] = useState<{ x: number, y: number, type: 'tree' | 'bush' | 'grass' }[]>([]);

    // Mouse State
    const mousePos = useRef(new THREE.Vector2(0, 0));
    const isMouseDown = useRef(false);

    // Controls
    const { tool, isRunning, viscosity, flowRate, erosionRate, depositionRate, mouseSize, mouseStrength } = useControls('Simulation', {
        tool: { options: ['water', 'dig', 'sand', 'plant'] },
        isRunning: { value: false, label: 'Start Water' },
        viscosity: { value: 0.98, min: 0.9, max: 0.999 },
        flowRate: { value: 2.0, min: 0, max: 10 },
        erosionRate: { value: 0.5, min: 0, max: 2 },
        depositionRate: { value: 0.5, min: 0, max: 2 },
        mouseSize: { value: 0.05, min: 0.01, max: 0.2 },
        mouseStrength: { value: 100.0, min: 1.0, max: 500.0 },
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
        wVar.material.uniforms.flowRate = { value: isRunning ? flowRate : 0.0 };
        wVar.material.uniforms.slope = { value: slope }; // Pass slope
        wVar.material.uniforms.tObstacles = { value: obstacleTexture.current };

        // Mouse Interaction for Water
        if (isMouseDown.current && tool === 'water') {
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

        // Mouse Interaction for Terrain (Dig/Sand)
        let toolType = 0;
        if (isMouseDown.current) {
            if (tool === 'dig') toolType = 1;
            if (tool === 'sand') toolType = 2;

            // Debug logging
            if (toolType > 0) {
                console.log('Tool:', tool, 'ToolType:', toolType, 'MousePos:', mousePos.current, 'IsMouseDown:', isMouseDown.current);
            }
        }

        tVar.material.uniforms.mousePos = { value: mousePos.current };
        tVar.material.uniforms.mouseSize = { value: mouseSize };
        tVar.material.uniforms.mouseStrength = { value: mouseStrength };
        tVar.material.uniforms.toolType = { value: toolType };

        // Compute
        gpu.compute();

        // Update Visual Materials
        if (waterMaterialRef.current) {
            waterMaterialRef.current.uniforms.tWater.value = gpu.getCurrentRenderTarget(wVar).texture;
            waterMaterialRef.current.uniforms.tTerrain.value = gpu.getCurrentRenderTarget(tVar).texture;
        }
        if (terrainMaterialRef.current) {
            terrainMaterialRef.current.uniforms.tTerrain.value = gpu.getCurrentRenderTarget(tVar).texture;
            terrainMaterialRef.current.uniforms.tWater.value = gpu.getCurrentRenderTarget(wVar).texture;
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
                    // Set resistance
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

                    // Random Plant Type
                    const types: ('tree' | 'bush' | 'grass')[] = ['tree', 'bush', 'grass'];
                    const type = types[Math.floor(Math.random() * types.length)];

                    // Update visual list
                    setPlants(prev => [...prev, { x: e.uv.x, y: e.uv.y, type }]);
                }
            }
        } else {
            // 'water', 'dig', 'sand' tools all use continuous mouse interaction
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
                foamColor: { value: new THREE.Color('#ffffff') },
                sunDirection: { value: new THREE.Vector3(1, 1, 0.5).normalize() },
            },
            vertexShader: `
        uniform sampler2D tWater;
        uniform sampler2D tTerrain;
        varying float vHeight;
        varying float vTerrainHeight;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;

        void main() {
            vUv = uv;
            vec4 waterData = texture2D(tWater, uv);
            float waterH = waterData.x;
            float terrainH = texture2D(tTerrain, uv).x;
            
            vHeight = waterH;
            vTerrainHeight = terrainH;
            
            vec3 pos = position;
            // Calculate normal based on neighbors for lighting
            float offset = 1.0 / 128.0;
            float hR = texture2D(tWater, uv + vec2(offset, 0)).x + texture2D(tTerrain, uv + vec2(offset, 0)).x;
            float hL = texture2D(tWater, uv - vec2(offset, 0)).x + texture2D(tTerrain, uv - vec2(offset, 0)).x;
            float hD = texture2D(tWater, uv - vec2(0, offset)).x + texture2D(tTerrain, uv - vec2(0, offset)).x;
            float hU = texture2D(tWater, uv + vec2(0, offset)).x + texture2D(tTerrain, uv + vec2(0, offset)).x;
            
            vNormal = normalize(vec3(hL - hR, 2.0 * offset, hD - hU));

            pos.y += (terrainH + waterH) * 0.5; 
            
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            vViewPosition = -mvPosition.xyz;
            gl_Position = projectionMatrix * mvPosition;
        }
      `,
            fragmentShader: `
        uniform vec3 color;
        uniform vec3 foamColor;
        uniform vec3 sunDirection;
        varying float vHeight;
        varying float vTerrainHeight;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;

        void main() {
            if (vHeight < 0.01) discard; 
            
            // Basic lighting
            vec3 normal = normalize(vNormal);
            vec3 viewDir = normalize(vViewPosition);
            vec3 halfVector = normalize(sunDirection + viewDir);
            
            float NdotL = max(dot(normal, sunDirection), 0.0);
            float specular = pow(max(dot(normal, halfVector), 0.0), 100.0);
            
            // Foam based on shallowness and turbulence (approximated by normal noise)
            float foam = 0.0;
            if (vHeight < 0.05) foam = 1.0 - (vHeight / 0.05);
            
            vec3 finalColor = mix(color, foamColor, foam * 0.5);
            finalColor += vec3(specular) * 0.5;
            
            float opacity = clamp(vHeight * 5.0, 0.4, 0.9);
            gl_FragColor = vec4(finalColor, opacity);
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
                tWater: { value: null }, // Need water to check for wetness
                sandColor: { value: new THREE.Color('#d2b48c') },
                wetSandColor: { value: new THREE.Color('#8b4513') },
            },
            vertexShader: `
        uniform sampler2D tTerrain;
        varying float vHeight;
        varying vec2 vUv;
        varying vec3 vNormal;

        void main() {
            vUv = uv;
            float terrainH = texture2D(tTerrain, uv).x;
            vHeight = terrainH;
            
            vec3 pos = position;
            
            // Calculate normal
            float offset = 1.0 / 128.0;
            float hR = texture2D(tTerrain, uv + vec2(offset, 0)).x;
            float hL = texture2D(tTerrain, uv - vec2(offset, 0)).x;
            float hD = texture2D(tTerrain, uv - vec2(0, offset)).x;
            float hU = texture2D(tTerrain, uv + vec2(0, offset)).x;
            vNormal = normalize(vec3(hL - hR, 2.0 * offset, hD - hU));

            pos.y += terrainH * 1.5;
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
            fragmentShader: `
        uniform vec3 sandColor;
        uniform vec3 wetSandColor;
        uniform sampler2D tWater;
        varying float vHeight;
        varying vec2 vUv;
        varying vec3 vNormal;

        void main() {
            // Check for water above
            float waterH = texture2D(tWater, vUv).x;
            
            // Lighting
            vec3 sunDir = normalize(vec3(1.0, 1.0, 0.5));
            float diff = max(dot(vNormal, sunDir), 0.0);
            
            vec3 col = sandColor;
            
            // Wet sand logic
            if (waterH > 0.01) {
                col = wetSandColor;
            } else {
                // Wet rim
                // Simple check: if water is very close (not implemented in frag shader easily without blur)
                // Instead, we can just darken based on depth or noise
            }
            
            col *= (0.5 + diff * 0.5); // Apply lighting
            
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
            {plants.map((p, i) => {
                const pos: [number, number, number] = [(p.x - 0.5) * 3.8, (p.y - 0.5) * 7.8, 0.5];
                if (p.type === 'tree') return <Tree key={i} position={pos} />;
                if (p.type === 'bush') return <Bush key={i} position={pos} />;
                return <Grass key={i} position={pos} />;
            })}
        </group>
    );
}
