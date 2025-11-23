# Stream Trailer 3D Simulation - Implementation Plan

## Goal Description
Build a photorealistic, interactive 3D web application simulating a hydrology stream trailer. The app will allow students to experiment with stream dynamics, erosion, deposition, and vegetation effects using real-time fluid and terrain physics.

## User Review Required
> [!IMPORTANT]
> **Performance vs. Realism**: Achieving "indistinguishable from real life" water physics in a browser is a high bar. I will use **GPGPU (General-Purpose computing on Graphics Processing Units)** techniques via custom shaders to simulate shallow water equations and erosion. This offers the best balance of realism and performance but requires a decent GPU on the user's device.

## Proposed Changes

### Core Architecture
- **Framework**: Next.js 15 (App Router)
- **3D Engine**: Three.js + React Three Fiber (R3F)
- **Physics/Simulation**: Custom GPGPU Simulation (using FBOs) for Water and Terrain interaction.
- **UI**: Tailwind CSS + Leva (for debug/fine-tuning) + Custom Overlay.

### Phase 1: Foundation & Scene Setup
#### [NEW] [Scene.tsx](file:///Users/j3091d/Desktop/Kintsugi Trading/Kintsugi Arcade/StreamTrailer/src/components/Scene.tsx)
- Set up the R3F Canvas.
- Add Lighting (Environment, Directional Light).
- Add Camera with OrbitControls (limited angles to simulate standing at the trailer).
- Load/Create a basic "Trailer" model (the box/pan).

#### [NEW] [Trailer.tsx](file:///Users/j3091d/Desktop/Kintsugi Trading/Kintsugi Arcade/StreamTrailer/src/components/Trailer.tsx)
- The physical container of the stream.
- Adjustable slope logic (rotating the container).

### Phase 2: Terrain & Water Simulation (The Core)
This is the most complex part. We will use a "Heightfield" approach.

#### [NEW] [SimulationMaterial.ts](file:///Users/j3091d/Desktop/Kintsugi Trading/Kintsugi Arcade/StreamTrailer/src/materials/SimulationMaterial.ts)
- Custom shaders for GPGPU simulation.
- **Terrain Shader**: Stores sand height.
- **Water Shader**: Stores water height and velocity.
- **Erosion Shader**: Calculates sediment transport based on water velocity.

#### [NEW] [StreamBed.tsx](file:///Users/j3091d/Desktop/Kintsugi Trading/Kintsugi Arcade/StreamTrailer/src/components/StreamBed.tsx)
- A high-resolution plane mesh.
- Displaces vertices based on the Terrain Texture.
- Renders sand textures/normals.

#### [NEW] [WaterSurface.tsx](file:///Users/j3091d/Desktop/Kintsugi Trading/Kintsugi Arcade/StreamTrailer/src/components/WaterSurface.tsx)
- A high-resolution plane mesh (layered over StreamBed).
- Displaces vertices based on Water Height + Terrain Height.
- Renders realistic water (transmission, reflection, foam at high velocity).

### Phase 3: Interaction & Controls
#### [NEW] [Controls.tsx](file:///Users/j3091d/Desktop/Kintsugi Trading/Kintsugi Arcade/StreamTrailer/src/components/Controls.tsx)
- UI for:
    - **Slope**: Rotates the trailer.
    - **Flow Rate**: Controls the water source intensity.
    - **Tools**:
        - *Shovel*: Dig or add sand (modifies Terrain FBO).
        - *Plant*: Place vegetation (adds obstacles to the simulation).

#### [MODIFY] [page.tsx](file:///Users/j3091d/Desktop/Kintsugi Trading/Kintsugi Arcade/StreamTrailer/src/app/page.tsx)
- Integrate the Scene and UI overlay.

### Phase 4: Vegetation & Polish
#### [NEW] [Vegetation.tsx](file:///Users/j3091d/Desktop/Kintsugi Trading/Kintsugi Arcade/StreamTrailer/src/components/Vegetation.tsx)
- InstancedMesh for performance.
- Plants act as "resistance" fields in the water simulation (slowing down velocity in their cells).

## Verification Plan
### Automated Tests
- `npm run lint` to ensure code quality.
- `npm run build` to verify production build.

### Manual Verification
1.  **Visual Check**: Water flows downhill.
2.  **Physics Check**:
    - Increasing slope increases water velocity.
    - Water erodes sand at high velocities (creating channels).
    - Water deposits sand at low velocities (forming deltas).
    - Placing plants slows water and reduces erosion downstream.
3.  **Performance**: Ensure 60fps on standard hardware.
