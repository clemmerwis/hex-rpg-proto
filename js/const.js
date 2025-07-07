export const GAME_CONSTANTS = {
    // Movement
    MOVEMENT_SPEED: 300,      // ms per hex
    COMBAT_CHECK_INTERVAL: 50, // ms between movement checks in combat

    // Animation
    ANIMATION_SPEED: 150,     // ms between animation frames
    FRAME_TIME: 16,           // ~60fps

    // World and rendering
    HEX_SIZE: 70,
    WORLD_WIDTH: 3220,
    WORLD_HEIGHT: 2240,
    ZOOM_LEVEL: 0.5,

    // Camera and scrolling
    EDGE_SCROLL_THRESHOLD: 100,
    MAX_EDGE_SCROLL_SPEED: 12,
    KEYBOARD_SCROLL_SPEED: 15,

    // Pathfinding
    PATHFINDING_MAX_DISTANCE: 20,
    PATHFINDING_MAX_ITERATIONS: 100,
    PATHFINDING_MAX_OPEN_SET: 200,

    // UI
    NAMEPLATE_WIDTH: 150,
    NAMEPLATE_HEIGHT: 65,
    HEALTH_BAR_HEIGHT: 22,

    // Sprite
    SPRITE_FRAME_SIZE: 256
};

// Animation configurations
export const ANIMATION_CONFIGS = {
    idle: { cols: 5, rows: 4, frameCount: 17 },
    walk: { cols: 4, rows: 3, frameCount: 11 },
    run: { cols: 3, rows: 3, frameCount: 8 },
    jump: { cols: 4, rows: 3, frameCount: 11 },
    attack: { cols: 4, rows: 4, frameCount: 15 },
    die: { cols: 6, rows: 5, frameCount: 27 }
};

// Faction configurations
export const FACTIONS = {
    player: {
        name: 'Player',
        tintColor: '#4CAF50',
        nameplateColor: '#00ff00'
    },
    enemy: {
        name: 'Enemy',
        tintColor: '#F44336',
        nameplateColor: '#ff4444'
    },
    ally: {
        name: 'Ally',
        tintColor: '#2196F3',
        nameplateColor: '#4488ff'
    },
    neutral: {
        name: 'Neutral',
        tintColor: '#FF9800',
        nameplateColor: '#ffaa44'
    }
};