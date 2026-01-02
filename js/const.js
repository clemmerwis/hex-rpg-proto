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
  KEYBOARD_SCROLL_SPEED: 8,

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

// Sprite set registry - each set is self-contained with folder info and animation configs
// Every character must have an explicit spriteSet property referencing a key here
export const SPRITE_SETS = {
	baseKnight: {
		folder: 'KnightBasic',
		prefix: 'Knight',
		// Folder overrides for animations stored in different directories
		folderOverrides: {
			impact: 'KnightAdvCombat',
			idle2: 'KnightExMovement',
		},
		animations: {
			idle:   { animationName: 'Idle', cols: 5, rows: 4, frameCount: 17, speed: 120 },
			walk:   { animationName: 'Walk', cols: 4, rows: 3, frameCount: 11 },
			run:    { animationName: 'Run', cols: 3, rows: 3, frameCount: 8 },
			jump:   { animationName: 'Jump', cols: 4, rows: 3, frameCount: 11 },
			attack: { animationName: 'Attack', cols: 4, rows: 4, frameCount: 15, oneShot: true },
			die:    { animationName: 'Die', cols: 6, rows: 5, frameCount: 27, speed: 60 },
			impact: { animationName: 'Impact', cols: 3, rows: 3, frameCount: 9, oneShot: true },
			idle2:  { animationName: 'Idle2', cols: 5, rows: 5, frameCount: 25, oneShot: true, speed: 142 },
		}
	},
	swordShieldKnight: {
		folder: 'KnightSwordShield',
		prefix: 'KnightSwordShield',
		folderOverrides: {},
		animations: {
			idle:   { animationName: 'Idle', cols: 5, rows: 4, frameCount: 17, speed: 120 },
			walk:   { animationName: 'Walk', cols: 4, rows: 4, frameCount: 13 },
			run:    { animationName: 'Run', cols: 3, rows: 3, frameCount: 8 },
			jump:   { animationName: 'Jump', cols: 3, rows: 3, frameCount: 9 },
			attack: { animationName: 'Attack', cols: 4, rows: 4, frameCount: 15, oneShot: true },
			die:    { animationName: 'Die2', cols: 4, rows: 4, frameCount: 16, speed: 60 },
			impact: { animationName: 'Impact', cols: 3, rows: 3, frameCount: 9, oneShot: true },
			idle2:  { animationName: 'Idle2', cols: 5, rows: 5, frameCount: 25, oneShot: true, speed: 142 },
		}
	}
};

// Character stat system
// 10 stats across 5 categories, Physical/Cerebral columns
// Each character: min 3 per stat (30 base) + 30 distributable = 60 total
export const STATS = {
	categories: {
		power:      { physical: 'str', cerebral: 'int' },
		prowess:    { physical: 'dex', cerebral: 'per' },
		resistance: { physical: 'con', cerebral: 'will' },
		appearance: { physical: 'beauty', cerebral: 'cha' },
		spirit:     { physical: 'instinct', cerebral: 'wis' }
	},
	all: ['str', 'int', 'dex', 'per', 'con', 'will', 'beauty', 'cha', 'instinct', 'wis'],
	MIN: 3,
	MAX: 10,
	TOTAL_POINTS: 60
};

// Stat bonus/multiplier tables for derived calculations
export const STAT_BONUSES = {
	HP_BASE: 15,

	// Constitution bonus (additive) - used for HP
	CON_BONUS: {
		3: -4,   // handicapped
		4: -2,   // severely below average
		5: 0,    // moderately below average
		6: 1,    // below average
		7: 2,    // average
		8: 4,    // above average
		9: 6,    // Exceptional
		10: 8,   // Prodigious
	},

	// Multiplier scale - used by Str (HP), Will (hpBuffer), and future stats
	MULTIPLIER: {
		3: 1,      // handicapped
		4: 1.25,   // severely below average
		5: 1.5,    // moderately below average
		6: 1.75,   // below average
		7: 2,      // average
		8: 2.25,   // above average
		9: 2.5,    // Exceptional
		10: 3,     // Prodigious
	},
};

/**
 * Calculate max HP from character stats
 * Formula: ceil((HP_BASE + ConBonus) * StrMultiplier)
 */
export function calculateMaxHP(stats) {
	const conBonus = STAT_BONUSES.CON_BONUS[stats.con] ?? 0;
	const strMult = STAT_BONUSES.MULTIPLIER[stats.str] ?? 1;
	return Math.ceil((STAT_BONUSES.HP_BASE + conBonus) * strMult);
}

/**
 * Calculate HP buffer (temp HP per-attacker)
 * Formula: ceil(Instinct * WillMultiplier)
 */
export function calculateHPBuffer(stats) {
	const willMult = STAT_BONUSES.MULTIPLIER[stats.will] ?? 1;
	return Math.ceil(stats.instinct * willMult);
}

/**
 * Validate that a stats object has correct point distribution
 */
export function validateStats(stats) {
	const total = STATS.all.reduce((sum, s) => sum + (stats[s] || 0), 0);
	const validRange = STATS.all.every(s => stats[s] >= STATS.MIN && stats[s] <= STATS.MAX);
	return { valid: total === STATS.TOTAL_POINTS && validRange, total };
}

// Equipment definitions
export const WEAPONS = {
	unarmed:    { name: 'Unarmed',     base: 2,  type: 'blunt',    force: 1 },
	shortSpear: { name: 'Short Spear', base: 3,  type: 'piercing', force: 1 },
	shortSword: { name: 'Short Sword', base: 4,  type: 'slash',    force: 2 },
	shortBlunt: { name: 'Short Blunt', base: 6,  type: 'blunt',    force: 3 },
	longSword:  { name: 'Long Sword',  base: 8,  type: 'slash',    force: 4 },
	longSpear:  { name: 'Long Spear',  base: 6,  type: 'piercing', force: 4 },
	longBlunt:  { name: 'Long Blunt',  base: 10, type: 'blunt',    force: 6 },
};

export const SHIELDS = {
	basicShield: { name: 'Shield' },
};

/**
 * Calculate damage from stats and weapon
 * Formula: base + ceil(force * StrMultiplier)
 */
export function calculateDamage(stats, weaponKey) {
	const weapon = WEAPONS[weaponKey];
	const strMult = STAT_BONUSES.MULTIPLIER[stats.str] ?? 1;
	return weapon.base + Math.ceil(weapon.force * strMult);
}

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
