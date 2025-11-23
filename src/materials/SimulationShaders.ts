export const WaterFragmentShader = `

uniform vec2 gridDim;
uniform float delta;
uniform float viscosity;
uniform vec2 mousePos;
uniform float mouseSize;
uniform float mouseStrength;
uniform float flowRate;
uniform float slope;
uniform sampler2D tObstacles;

void main() {
    vec2 uv = gl_FragCoord.xy / gridDim;
    vec2 texel = 1.0 / gridDim;

    // Water State: x = height, y = velocity
    vec4 waterData = texture2D(tWater, uv);
    float waterH = waterData.x;
    float velocity = waterData.y;

    // Terrain State: x = height
    float terrainH = texture2D(tTerrain, uv).x;
    
    // Obstacles: r = resistance (0 to 1)
    float resistance = texture2D(tObstacles, uv).r;

    // Total Height (Surface)
    float surface = waterH + terrainH;

    // Neighbor Surfaces
    float sL = texture2D(tWater, uv - vec2(texel.x, 0.0)).x + texture2D(tTerrain, uv - vec2(texel.x, 0.0)).x;
    float sR = texture2D(tWater, uv + vec2(texel.x, 0.0)).x + texture2D(tTerrain, uv + vec2(texel.x, 0.0)).x;
    float sD = texture2D(tWater, uv - vec2(0.0, texel.y)).x + texture2D(tTerrain, uv - vec2(0.0, texel.y)).x;
    float sU = texture2D(tWater, uv + vec2(0.0, texel.y)).x + texture2D(tTerrain, uv + vec2(0.0, texel.y)).x;

    // Flow based on surface gradient
    float average = (sL + sR + sD + sU) * 0.25;
    
    // Acceleration
    velocity += (average - surface) * 9.8 * delta; 
    velocity += slope * delta * 5.0; 
    
    // Damping + Resistance
    velocity *= (viscosity * (1.0 - resistance));

    // Update Water Height
    waterH += velocity * delta;
    
    // Clamp water height
    if (waterH < 0.0) waterH = 0.0;

    // Mouse Interaction
    float dist = distance(uv, mousePos);
    if (dist < mouseSize) {
        waterH += mouseStrength * delta;
    }

    // Source (Spray Bar)
    // Emit water across the top (high Y) with some width
    if (uv.y > 0.96) {
        waterH += flowRate * delta;
    }
    
    // Drain at the bottom
    if (uv.y < 0.02) {
        waterH *= 0.9;
    }
    
    // Drain at the sides to prevent vertical water walls
    if (uv.x < 0.02 || uv.x > 0.98) {
        waterH *= 0.5;
    }

    gl_FragColor = vec4(waterH, velocity, 0.0, 1.0);
}
`;

export const TerrainFragmentShader = `

uniform vec2 gridDim;
uniform float delta;
uniform float erosionRate;
uniform float depositionRate;
uniform vec2 mousePos;
uniform float mouseSize;
uniform float mouseStrength;
uniform float toolType; // 0: None, 1: Dig (Remove), 2: Sand (Add)
uniform float time; // For randomization

// Random function for sand variation
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
    vec2 uv = gl_FragCoord.xy / gridDim;
    vec2 texel = 1.0 / gridDim;
    
    // Terrain State: x = height, y = sediment, z = sand particles (discrete), w = color variation seed
    vec4 terrainData = texture2D(tTerrain, uv);
    float terrainH = terrainData.x;
    float sediment = terrainData.y;
    float sandParticles = terrainData.z; // Discrete sand particle count
    float colorSeed = terrainData.w; // For color variation
    
    // Water State
    vec4 waterData = texture2D(tWater, uv);
    float waterH = waterData.x;
    float velocity = abs(waterData.y);
    
    // CELLULAR AUTOMATON SAND PHYSICS
    // Only apply if we have sand particles and minimal water
    if (sandParticles > 0.1 && waterH < 0.5) {
        vec2 pixelCoord = gl_FragCoord.xy;
        
        // Check cell below
        vec4 belowData = texture2D(tTerrain, uv - vec2(0.0, texel.y));
        float belowSand = belowData.z;
        float belowHeight = belowData.x;
        
        // Random direction for diagonal falling
        float randDir = random(pixelCoord + vec2(time * 0.1, 0.0));
        int dir = randDir < 0.5 ? -1 : 1;
        
        // Check diagonal cells
        vec4 diagData = texture2D(tTerrain, uv + vec2(float(dir) * texel.x, -texel.y));
        float diagSand = diagData.z;
        float diagHeight = diagData.x;
        
        vec4 altDiagData = texture2D(tTerrain, uv + vec2(float(-dir) * texel.x, -texel.y));
        float altDiagSand = altDiagData.z;
        float altDiagHeight = altDiagData.x;
        
        // Stability threshold - sand only moves if height difference is significant
        float stabilityThreshold = 0.15;
        
        // Rule 1: Fall straight down if space below is empty and height difference is significant
        if (belowSand < 0.5 && terrainH - belowHeight > stabilityThreshold) {
            // Sand will fall (handled by the cell below reading this cell)
            // For now, reduce this cell's sand
            sandParticles = max(0.0, sandParticles - 2.0 * delta * 30.0);
            terrainH = max(0.0, terrainH - 0.02 * delta * 30.0);
        }
        // Rule 2: Slide diagonally if can't fall straight and slope is steep enough
        else if (diagSand < sandParticles - 1.0 && terrainH - diagHeight > stabilityThreshold) {
            sandParticles = max(0.0, sandParticles - 1.0 * delta * 20.0);
            terrainH = max(0.0, terrainH - 0.01 * delta * 20.0);
        }
        else if (altDiagSand < sandParticles - 1.0 && altDiagHeight - terrainH > stabilityThreshold) {
            sandParticles = max(0.0, sandParticles - 1.0 * delta * 20.0);
            terrainH = max(0.0, terrainH - 0.01 * delta * 20.0);
        }
        
        // RECEIVE SAND FROM ABOVE
        vec4 aboveData = texture2D(tTerrain, uv + vec2(0.0, texel.y));
        float aboveSand = aboveData.z;
        float aboveHeight = aboveData.x;
        
        // If above has sand and height difference is significant, receive it
        if (aboveSand > 0.5 && aboveHeight - terrainH > stabilityThreshold) {
            sandParticles += 2.0 * delta * 30.0;
            terrainH += 0.02 * delta * 30.0;
        }
        
        // RECEIVE FROM DIAGONALS - only if slope is steep enough
        vec4 diagAbove1 = texture2D(tTerrain, uv + vec2(texel.x, texel.y));
        if (diagAbove1.z > sandParticles + 1.0 && diagAbove1.x - terrainH > stabilityThreshold) {
            sandParticles += 1.0 * delta * 20.0;
            terrainH += 0.01 * delta * 20.0;
        }
        
        vec4 diagAbove2 = texture2D(tTerrain, uv + vec2(-texel.x, texel.y));
        if (diagAbove2.z > sandParticles + 1.0 && diagAbove2.x - terrainH > stabilityThreshold) {
            sandParticles += 1.0 * delta * 20.0;
            terrainH += 0.01 * delta * 20.0;
        }
    }

    // Mouse Interaction (Dig / Add Sand)
    float dist = distance(uv, mousePos);
    if (dist < mouseSize) {
        float eps = 0.1;
        
        // Tool 1 = Dig (Remove)
        if (abs(toolType - 1.0) < eps) {
            terrainH -= mouseStrength * delta * 10.0;
            sandParticles = max(0.0, sandParticles - mouseStrength * delta * 5.0);
        }
        
        // Tool 2 = Sand (Add) - Create particles that will fall!
        if (abs(toolType - 2.0) < eps) {
            terrainH += mouseStrength * delta * 50.0;
            sandParticles += mouseStrength * delta * 25.0;
            
            // Generate unique color seed for this sand
            if (colorSeed < 0.01) {
                colorSeed = random(uv + vec2(time, 0.0));
            }
        }
    }
    
    // Sync terrain height with sand particles
    if (sandParticles > 0.1) {
        terrainH = max(terrainH, sandParticles * 0.02);
    }
    
    // Clamp values
    if (terrainH < 0.0) terrainH = 0.0;
    if (terrainH > 5.0) terrainH = 5.0;
    sandParticles = clamp(sandParticles, 0.0, 100.0);

    // Erosion / Deposition Logic (only when water is present)
    if (waterH > 0.05) {
        float capacity = velocity * 2.0;

        if (capacity > sediment) {
            // Erode (Pick up sediment) - also converts sand particles to sediment
            float erodeAmount = (capacity - sediment) * erosionRate * delta;
            erodeAmount = min(erodeAmount, terrainH);
            
            terrainH -= erodeAmount;
            sediment += erodeAmount;
            
            // Remove some sand particles (they become sediment)
            sandParticles = max(0.0, sandParticles - erodeAmount * 5.0);
        } else {
            // Deposit (Drop sediment) - becomes sand particles
            float depositAmount = (sediment - capacity) * depositionRate * delta;
            
            terrainH += depositAmount;
            sediment -= depositAmount;
            sandParticles += depositAmount * 3.0;
            
            // Generate color seed for deposited sand
            if (colorSeed < 0.01) {
                colorSeed = random(uv + vec2(time * 0.5, 0.0));
            }
        }
    }

    gl_FragColor = vec4(terrainH, sediment, sandParticles, colorSeed);
}
`;
