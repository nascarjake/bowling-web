export const MODEL_ASSETS = {
    alleyLow: 'bowling_alley_low.glb',
    alleyMedium: 'bowling_game_alley.glb',
    alleyHigh: 'bowling_alley_hi.glb',
    pin: 'pin.glb',
    ball: 'bowling_ball.glb',
    ballPack: 'bowling_balls.glb'
};

export const CONVERTED_ALLEY_TEXTURES = {
    None: null,
    Ball_001: 'Map/Ball_001.png',
    Ball_002: 'Map/Ball_002.jpg',
    Ball_003: 'Map/Ball_003.jpeg',
    Ball_004: 'Map/Ball_004.jpg',
    Ball_005: 'Map/Ball_005.jpeg',
    Dark_Wood: 'Map/Dark_wood_044.jpeg',
    Light_Wood: 'Map/Light_wood_065.png',
    Monitor: 'Map/Score-Bowling-Step-7.jpg',
    Target: 'Map/Target_Bowling_001.jpg',
    wood_gloss_wide_001: 'Map/Light_wood_065.png'
};

export const ALLEY_MATERIAL_PROFILES = {
    Dark: { color: 0x020202, roughness: 0.24, metalness: 0.75, envMapIntensity: 1.1 },
    Dark_Metal: { color: 0x050505, roughness: 0.22, metalness: 0.85, envMapIntensity: 1.25 },
    Black: { color: 0x030303, roughness: 0.34, metalness: 0.08, envMapIntensity: 0.85 },
    Black_Gloss: { color: 0x010101, roughness: 0.11, metalness: 0.03, envMapIntensity: 1.6 },
    Metal: { color: 0x777777, roughness: 0.22, metalness: 0.82, envMapIntensity: 1.35 },
    Wood: { color: 0xffffff, roughness: 0.18, metalness: 0.02, envMapIntensity: 0.38 },
    Dark_Wood: { color: 0xffffff, roughness: 0.32, metalness: 0.01, envMapIntensity: 0.22 },
    Ball: { color: 0xffffff, roughness: 0.16, metalness: 0.08, envMapIntensity: 1.15 },
    Monitor: { color: 0xffffff, roughness: 0.35, metalness: 0.02, envMapIntensity: 0.4, emissiveIntensity: 0.45 },
    Light_points: { color: 0xffa23a, roughness: 0.35, metalness: 0.02, envMapIntensity: 0.2, emissiveIntensity: 0.35 },
    Blue_F: { color: 0x00ffcc, roughness: 0.35, metalness: 0.02, envMapIntensity: 0.2, emissiveIntensity: 0.35 },
    Target: { color: 0xffffff, roughness: 0.42, metalness: 0.02, envMapIntensity: 0.25 }
};
