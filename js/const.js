export const GAME_CONSTANTS = {
  // Movement
  MOVEMENT_SPEED: 300, // ms per hex
  MOVEMENT_TIMEOUT: 5000, // Failsafe timeout for movement completion (ms)

  // Animation
  ANIMATION_SPEED: 17, // ms between animation frames

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
  PATHFINDING_MAX_DISTANCE: 30,
  PATHFINDING_MAX_ITERATIONS: 100,
  PATHFINDING_MAX_OPEN_SET: 200,

  // UI
  NAMEPLATE_WIDTH: 150,
  NAMEPLATE_HEIGHT: 65,
  HEALTH_BAR_HEIGHT: 22,

  // Sprite
  SPRITE_FRAME_SIZE: 256,
};

// Animation configurations
// - 'speed' overrides ANIMATION_SPEED (optional)
// - 'folder' specifies sprite folder (defaults to 'KnightBasic')
export const ANIMATION_CONFIGS = {
  idle: { cols: 5, rows: 4, frameCount: 17, speed: 120 },
  walk: { cols: 4, rows: 3, frameCount: 11 },
  run: { cols: 3, rows: 3, frameCount: 8 },
  jump: { cols: 4, rows: 3, frameCount: 11 },
  attack: { cols: 4, rows: 4, frameCount: 15, oneShot: true },
  die: { cols: 6, rows: 5, frameCount: 27, speed: 60 },
  impact: { cols: 3, rows: 3, frameCount: 9, folder: "KnightAdvCombat", oneShot: true },
  idle2: { cols: 5, rows: 5, frameCount: 25, folder: "KnightExMovement", oneShot: true, speed: 142 },
};

// Faction configurations
export const FACTIONS = {
  pc: {
    name: "PC",
    tintColor: "#4CAF50",
    nameplateColor: "#00ff00",
  },
  pc_ally: {
    name: "Companion",
    tintColor: "#4169E1",
    nameplateColor: "#6495ED",
  },
  bandit: {
    name: "Bandit",
    tintColor: "#B22222",
    nameplateColor: "#cc3333",
  },
  guard: {
    name: "Guard",
    tintColor: "#FF9800",
    nameplateColor: "#ffaa44",
  },
};
