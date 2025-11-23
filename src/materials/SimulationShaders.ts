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

void main() {
    vec2 uv = gl_FragCoord.xy / gridDim;
    
    // Terrain State: x = height, y = sediment suspended
    vec4 terrainData = texture2D(tTerrain, uv);
    float terrainH = terrainData.x;
    float sediment = terrainData.y;

    // Water State
    vec4 waterData = texture2D(tWater, uv);
    float waterH = waterData.x;
    float velocity = abs(waterData.y); // Simple speed approximation

    // Mouse Interaction (Dig / Add Sand)
    float dist = distance(uv, mousePos);
    if (dist < mouseSize) {
        // Use abs() comparison for safer float equality checks
        float eps = 0.1;
        
        // Tool 1 = Dig (Remove)
        if (abs(toolType - 1.0) < eps) {
            terrainH -= mouseStrength * delta * 10.0;
        }
        
        // Tool 2 = Sand (Add)  
        if (abs(toolType - 2.0) < eps) {
            terrainH += mouseStrength * delta * 10.0;
        }
    }
    
    // Clamp terrain height to reasonable values
    if (terrainH < 0.0) terrainH = 0.0;
    if (terrainH > 5.0) terrainH = 5.0;

    // Erosion / Deposition Logic
    // Capacity is how much sediment the water can carry based on speed
    float capacity = velocity * 2.0; 

    if (capacity > sediment) {
        // Erode (Pick up sediment)
        float erodeAmount = (capacity - sediment) * erosionRate * delta;
        // Don't erode more than available terrain (simple check)
        erodeAmount = min(erodeAmount, terrainH);
        
        terrainH -= erodeAmount;
        sediment += erodeAmount;
    } else {
        // Deposit (Drop sediment)
        float depositAmount = (sediment - capacity) * depositionRate * delta;
        
        terrainH += depositAmount;
        sediment -= depositAmount;
    }

    gl_FragColor = vec4(terrainH, sediment, 0.0, 1.0);
}
`;
