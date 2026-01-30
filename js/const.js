export const GAME_CONSTANTS = {
	// Movement
	MOVEMENT_SPEED: 300, // ms per hex
	MOVEMENT_TIMEOUT: 5000, // Failsafe timeout for movement completion (ms)

	// Combat timing
	COMBAT_PHASE_TRANSITION: 100, // ms delay between move and action phases
	COMBAT_ATTACK_WINDUP: 100, // ms delay before attack resolves (for animation)
	COMBAT_ATTACK_RECOVERY: 500, // ms delay after attack before next character
	COMBAT_MOVE_BLOCKED_DELAY: 50, // ms delay when move is blocked before next

	// Animation
	ANIMATION_SPEED: 17, // ms between animation frames

	// World and rendering
	HEX_SIZE: 70,
	ISO_RATIO: 0.5, // Vertical compression for isometric projection (0.5 = classic 2:1 iso)
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
	BUFFER_BAR_HEIGHT: 8,

	// Sprite
	SPRITE_FRAME_SIZE: 256,
};

// Default animation config for fallback when animation not found
const DEFAULT_ANIM_CONFIG = {
	cols: 4,
	rows: 2,
	frameCount: 6,
	speed: GAME_CONSTANTS.ANIMATION_SPEED,
	oneShot: false
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
			idle: { animationName: 'Idle', cols: 5, rows: 4, frameCount: 17, speed: 120 },
			walk: { animationName: 'Walk', cols: 4, rows: 3, frameCount: 11 },
			run: { animationName: 'Run', cols: 3, rows: 3, frameCount: 8 },
			jump: { animationName: 'Jump', cols: 4, rows: 3, frameCount: 11 },
			attack: { animationName: 'Attack', cols: 4, rows: 4, frameCount: 15, oneShot: true },
			die: { animationName: 'Die', cols: 6, rows: 5, frameCount: 27, speed: 60 },
			impact: { animationName: 'Impact', cols: 3, rows: 3, frameCount: 9, oneShot: true },
			idle2: { animationName: 'Idle2', cols: 5, rows: 5, frameCount: 25, oneShot: true, speed: 142 },
		}
	},
	swordShieldKnight: {
		folder: 'KnightSwordShield',
		prefix: 'KnightSwordShield',
		folderOverrides: {},
		animations: {
			idle: { animationName: 'Idle', cols: 5, rows: 4, frameCount: 17, speed: 120 },
			walk: { animationName: 'Walk', cols: 4, rows: 4, frameCount: 13 },
			run: { animationName: 'Run', cols: 3, rows: 3, frameCount: 8 },
			jump: { animationName: 'Jump', cols: 3, rows: 3, frameCount: 9 },
			attack: { animationName: 'Attack', cols: 4, rows: 4, frameCount: 15, oneShot: true },
			die: { animationName: 'Die2', cols: 4, rows: 4, frameCount: 16, speed: 60 },
			impact: { animationName: 'Impact', cols: 3, rows: 3, frameCount: 9, oneShot: true },
			idle2: { animationName: 'Idle2', cols: 5, rows: 5, frameCount: 25, oneShot: true, speed: 142 },
		}
	},
	swordKnight: {
		folder: 'KnightSword',
		prefix: 'KnightSword',
		folderOverrides: {},
		animations: {
			idle: { animationName: 'Idle', cols: 5, rows: 4, frameCount: 17, speed: 120 },
			walk: { animationName: 'Walk', cols: 4, rows: 3, frameCount: 11 },
			run: { animationName: 'Run', cols: 3, rows: 3, frameCount: 8 },
			jump: { animationName: 'Jump', cols: 3, rows: 3, frameCount: 9 },
			attack: { animationName: 'Attack', cols: 4, rows: 4, frameCount: 15, oneShot: true },
			die: { animationName: 'Die', cols: 6, rows: 5, frameCount: 27, speed: 60 },
			impact: { animationName: 'Impact', cols: 3, rows: 3, frameCount: 9, oneShot: true },
			idle2: { animationName: 'Idle2', cols: 5, rows: 5, frameCount: 25, oneShot: true, speed: 142 },
		}
	}
};

/**
 * Get animation config for a sprite set and animation name
 * Returns default config if not found (prevents undefined errors)
 * @param {string} spriteSet - Sprite set key (e.g., 'baseKnight')
 * @param {string} animName - Animation name (e.g., 'idle', 'walk')
 * @returns {Object} Animation config object
 */
export function getAnimationConfig(spriteSet, animName) {
	return SPRITE_SETS[spriteSet]?.animations[animName] || DEFAULT_ANIM_CONFIG;
}

// Character stat system
// 10 stats across 5 categories, Physical/Cerebral columns
// Each character: min 3 per stat (30 base) + 30 distributable = 60 total
export const STATS = {
	categories: {
		power: { physical: 'str', cerebral: 'int' },
		prowess: { physical: 'dex', cerebral: 'per' },
		resistance: { physical: 'con', cerebral: 'will' },
		appearance: { physical: 'beauty', cerebral: 'cha' },
		spirit: { physical: 'instinct', cerebral: 'wis' }
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
 * Calculate Cerebral Presence (awareness/attention capacity)
 * Formula: Per + Wis + Int
 */
export function calculateCerebralPresence(stats) {
	return stats.per + stats.wis + stats.int;
}

/**
 * Calculate maximum number of enemies a character can engage simultaneously
 * Formula: floor(Cerebral Presence / 6)
 */
export function calculateEngagedMax(stats) {
	return Math.floor(calculateCerebralPresence(stats) / 6);
}

/**
 * Validate that a stats object has correct point distribution
 */
export function validateStats(stats) {
	const total = STATS.all.reduce((sum, s) => sum + (stats[s] || 0), 0);
	const validRange = STATS.all.every(s => stats[s] >= STATS.MIN && stats[s] <= STATS.MAX);
	return { valid: total === STATS.TOTAL_POINTS && validRange, total };
}

// Passive bonus properties on equipment (direct numeric values)
// These are accessed directly in calculation functions
export const PASSIVE_BONUSES = {
	defenseR: 'Applied to Defense Rating via calculateDefenseRating()',
	attackR: 'Applied to Attack Rating via calculateAttackRating()',
	critMultiplier: 'Multiplies critical hit damage (stacks with base 2x crit)',
};

// Triggered effect definitions (stubbed for future implementation)
// These activate under specific conditions during combat
export const WEAPON_EFFECTS = {
	// Conditions - applied to target on hit
	rocked: { type: 'condition', effect: 'rocked', trigger: 'onHit', always: true },
	bleedingLight: { type: 'condition', effect: 'bleeding', trigger: 'onHit', intensity: 'light' },
	bleedingHeavy: { type: 'condition', effect: 'bleeding', trigger: 'onHit', intensity: 'heavy' },
	// Enhancements - modify attack properties
	vulnerableEnhancementLight: { type: 'enhancement', effect: 'vulnerable', intensity: 'light' },
	vulnerableEnhancementHeavy: { type: 'enhancement', effect: 'vulnerable', intensity: 'heavy' },
	armorDamageEnhancementLight: { type: 'enhancement', effect: 'armorDamage', intensity: 'light' },
	armorDamageEnhancementHeavy: { type: 'enhancement', effect: 'armorDamage', intensity: 'heavy' },
};

// Damage type properties - define special behaviors for each damage type
export const DAMAGE_TYPE_PROPERTIES = {
	concussive: {
		bypassBuffer: true,
		description: 'Impact damage that bypasses HP buffer, going directly to health'
	},
	blunt: {},
	slash: {},
	piercing: {}
};

// Equipment definitions
// grip: 'one' (short/unarmed - mainHand only), 'two' (long weapons), 'off' (shields - offHand only)
// passives: { defenseR, attackR, critMultiplier, evasionBonus, ... } - gathered via getEquipmentBonus()
// effects: triggered effects referencing WEAPON_EFFECTS keys
export const WEAPONS = {
	unarmed: { name: 'Unarmed', base: 2, type: 'concussive', force: 1, speed: 16, grip: 'two', passives: { evasionBonus: 5 }, effects: ['rockedOnHit'] },
	shortSpear: { name: 'Short Spear', base: 3, type: 'piercing', force: 1, speed: 19, grip: 'one', passives: {}, effects: ['vulnerableEnhancementLight'] },
	shortSword: { name: 'Short Sword', base: 4, type: 'slash', force: 2, speed: 18, grip: 'one', passives: {}, effects: ['bleedingLight'] },
	shortBlunt: { name: 'Short Blunt', base: 6, type: 'blunt', force: 3, speed: 20, grip: 'one', passives: {}, effects: ['armorDamageEnhancementLight'] },
	longSword: { name: 'Long Sword', base: 8, type: 'slash', force: 4, speed: 20, grip: 'two', passives: {}, effects: ['bleedingHeavy'] },
	longSpear: { name: 'Long Spear', base: 6, type: 'piercing', force: 4, speed: 20, grip: 'two', passives: {}, effects: ['vulnerableEnhancementHeavy'] },
	longBlunt: { name: 'Long Blunt', base: 10, type: 'blunt', force: 6, speed: 21, grip: 'two', passives: {}, effects: ['armorDamageEnhancementHeavy'] },
	smallShield: { name: 'Small Shield', base: 1, type: 'blunt', force: 2, speed: 17, grip: 'off', passives: { defenseR: 4 }, effects: [] },
	largeShield: { name: 'Large Shield', base: 1, type: 'blunt', force: 3, speed: 20, grip: 'off', passives: { defenseR: 8 }, effects: [] },
};

// Attack types - affect action speed and damage
export const ATTACK_TYPES = {
	light: { name: 'light Attack', speedMod: 12, damageMod: 0 },
	heavy: { name: 'heavy Attack', speedMod: 22, damageMod: 10 },
};

// Armor definitions
// mobility affects move speed (reduced by Str), flankingDefense affects DR when flanked
// passives: { ... } - gathered via getEquipmentBonus() along with weapon/shield passives
export const ARMOR_TYPES = {
	none: { name: 'Unarmored', defense: 0, mobility: 20, weight: 'none', noise: 'none', resistantAgainst: [], vulnerableAgainst: [], flankingDefense: 1.0, passives: {} },
	leather: { name: 'Leather', defense: 6, mobility: 20, weight: 'light', noise: 'none', resistantAgainst: ['piercing'], vulnerableAgainst: ['blunt'], flankingDefense: 1.5, passives: {} },
	scale: { name: 'Scale', defense: 8, mobility: 25, weight: 'medium', noise: 'medium', resistantAgainst: ['slash'], vulnerableAgainst: ['piercing'], flankingDefense: 0.0, passives: {} },
	brigandine: { name: 'Brigandine', defense: 10, mobility: 23, weight: 'medium', noise: 'low', resistantAgainst: ['piercing', 'slash'], vulnerableAgainst: ['blunt'], flankingDefense: 0.5, passives: {} },
	chain: { name: 'Chain (Heavy)', defense: 10, mobility: 28, weight: 'heavy', noise: 'medium', resistantAgainst: ['slash'], vulnerableAgainst: ['blunt', 'piercing'], flankingDefense: 0.25, passives: {} },
	plate: { name: 'Plate', defense: 12, mobility: 30, weight: 'heavy', noise: 'high', resistantAgainst: ['slash', 'blunt'], vulnerableAgainst: ['piercing'], flankingDefense: 0.75, passives: {} },
};

// Turn speed tiers - lower total speed = faster tier
// Move phase uses armor.mobility, Action phase uses weapon+shield speed + attackType - Dex
export const TURN_SPEED_TIERS = [
	{ tier: 1, min: 0, max: 20, name: '1/4' },
	{ tier: 2, min: 21, max: 40, name: '2/4' },
	{ tier: 3, min: 41, max: 55, name: '3/4' },
	{ tier: 4, min: 56, max: Infinity, name: '4/4' },
];

/**
 * Get speed tier for a given speed value
 */
export function getSpeedTier(speed) {
	for (const tier of TURN_SPEED_TIERS) {
		if (speed >= tier.min && speed <= tier.max) {
			return tier;
		}
	}
	return TURN_SPEED_TIERS[TURN_SPEED_TIERS.length - 1]; // Default to slowest
}

/**
 * Calculate action speed (for attacks)
 * Formula: weapon.speed + shield.speed (if not 2h) + attackType.speedMod - Dex
 */
export function calculateActionSpeed(character, attackType = 'light') {
	const weaponKey = character.equipment.mainHand;
	const weapon = WEAPONS[weaponKey];
	const offHandKey = character.equipment.offHand;
	const offHand = offHandKey ? WEAPONS[offHandKey] : null;

	let speed = weapon.speed;

	// Add shield speed if not two-handed
	if (weapon.grip !== 'two' && offHand) {
		speed += offHand.speed;
	}

	// Add attack type modifier, reduced by Dex
	const attackMod = ATTACK_TYPES[attackType]?.speedMod || 10;
	speed += attackMod - character.stats.dex;

	return Math.max(0, speed);
}

/**
 * Calculate move speed (for movement phase)
 * Formula: armor.mobility - Str
 */
export function calculateMoveSpeed(character) {
	const armorKey = character.equipment.armor || 'none';
	const armor = ARMOR_TYPES[armorKey];
	const mobility = armor ? armor.mobility : ARMOR_TYPES.none.mobility;
	return Math.max(0, mobility - character.stats.str);
}

/**
 * Calculate initiative (order within speed tier)
 * Formula: Will + Instinct (higher goes first)
 */
export function calculateInitiative(character) {
	return character.stats.will + character.stats.instinct;
}

/**
 * Calculate Critical Strike Attack Rating
 * Formula: (criticalStrike skill * 5) + (Int * 3) + (Str * 2)
 */
export function calculateCSA_R(character) {
	const skillLevel = character.skills.criticalStrike || 1;
	return (skillLevel * 5) + (character.stats.int * 3) + (character.stats.str * 2);
}

/**
 * Calculate Critical Strike Defense Rating
 * Formula: (criticalDefense skill * 5) + (Dex * 3) + (Per * 2) + Instinct
 */
export function calculateCSD_R(character) {
	const skillLevel = character.skills.criticalDefense || 1;
	return (skillLevel * 5) + (character.stats.dex * 3) + (character.stats.per * 2) + character.stats.instinct;
}

/**
 * Calculate Critical Strike Chance as integer percentage (0-100%)
 * Formula: (CSA_R - CSD_R) + 50, clamped to 0-100
 */
export function calculateCSC(attacker, defender) {
	const csaR = calculateCSA_R(attacker);
	const csdR = calculateCSD_R(defender);
	return Math.max(0, Math.min(100, (csaR - csdR) + 50));
}

// Skill definitions (all range 1-10)
// Weapon skills use the weapon key directly (e.g., skills.shortSword)
export const SKILLS = {
	defense: ['block', 'dodge'],
	weapons: ['unarmed', 'shortSword', 'longSword', 'shortSpear', 'longSpear', 'shortBlunt', 'longBlunt'],
	critical: ['criticalStrike', 'criticalDefense'],
};

// Default skills object (all level 1)
export function createDefaultSkills() {
	return {
		// Defense
		block: 1,
		dodge: 1,
		// Weapons
		unarmed: 1,
		shortSword: 1,
		longSword: 1,
		shortSpear: 1,
		longSpear: 1,
		shortBlunt: 1,
		longBlunt: 1,
		// Critical
		criticalStrike: 1,
		criticalDefense: 1,
	};
}

/**
 * Calculate Attack Rating
 * Formula: (skill * 5) + (Str * 3) + (Dex * 2) + weapon.attackR
 */
export function calculateAttackRating(character) {
	const weaponKey = character.equipment.mainHand;
	const weapon = WEAPONS[weaponKey];
	const skillLevel = character.skills[weaponKey] || 1;
	const attrBonus = weapon.attackR || 0;
	return (skillLevel * 5) + (character.stats.str * 3) + (character.stats.dex * 2) + attrBonus;
}

/**
 * Get total passive bonus from all equipped items
 * Checks mainHand, offHand, and armor for the specified bonus
 */
export function getEquipmentBonus(character, bonusName) {
	const weapon = WEAPONS[character.equipment.mainHand];
	const offHand = character.equipment.offHand ? WEAPONS[character.equipment.offHand] : null;
	const armor = ARMOR_TYPES[character.equipment.armor];

	return (weapon?.passives?.[bonusName] || 0)
		+ (offHand?.passives?.[bonusName] || 0)
		+ (armor?.passives?.[bonusName] || 0);
}

/**
 * Calculate Defense Rating
 * Formula: (skill * 5) + (Dex * 3) + (Instinct * 2) + defenseR (from passives) + 5 (base defense bonus)
 * Uses block skill if holding shield, dodge skill otherwise
 */
export function calculateDefenseRating(character) {
	const offHandKey = character.equipment.offHand;
	const offHand = offHandKey ? WEAPONS[offHandKey] : null;
	const hasShield = offHand && offHand.grip === 'off';
	const skillLevel = hasShield ? character.skills.block : character.skills.dodge;
	const defenseBonus = getEquipmentBonus(character, 'defenseR');
	return (skillLevel * 5) + (character.stats.dex * 3) + (character.stats.instinct * 2) + defenseBonus + 5;
}

/**
 * Calculate damage from stats and weapon
 * Formula: base + ceil(force * StrMultiplier)
 */
export function calculateDamage(stats, weaponKey, attackType = 'light') {
	const weapon = WEAPONS[weaponKey];
	const strMult = STAT_BONUSES.MULTIPLIER[stats.str] ?? 1;
	const attackMod = ATTACK_TYPES[attackType]?.damageMod || 0;
	return weapon.base + Math.ceil(weapon.force * strMult) + attackMod;
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

/**
 * NPC Templates - Character archetypes for spawning
 *
 * Architecture: Templates define the "what" (stats, equipment, faction) separate from "where" (area.json placement)
 * Current: Templates stored in const.js (local data)
 * Future: Templates fetched from backend API GET /api/npcs/:templateId
 *
 * Migration Path: Only AreaManager.instantiateNPCs() needs to change - swap const.js lookup for API fetch.
 * Everything else (Game.js, CharacterFactory, area.json format) stays the same.
 */
export const NPC_TEMPLATES = {
	// PC Faction Templates
	companion: {
		name: 'Companion',
		stats: {
			str: 4, int: 5,
			dex: 9, per: 6,
			con: 5, will: 7,
			beauty: 6, cha: 5,
			instinct: 9, wis: 4
		},
		equipment: {
			mainHand: 'shortBlunt',
			offHand: 'smallShield',
			armor: 'brigandine',
		},
		faction: 'pc',
		spriteSet: 'swordShieldKnight',
		mode: 'aggressive',
	},

	// Guard Templates
	guard_captain: {
		name: 'Guard Captain',
		stats: {
			str: 7, int: 5,
			dex: 6, per: 6,
			con: 7, will: 6,
			beauty: 5, cha: 5,
			instinct: 6, wis: 7
		},
		equipment: {
			mainHand: 'shortSpear',
			offHand: 'largeShield',
			armor: 'plate',
		},
		faction: 'guard',
		spriteSet: 'swordShieldKnight',
		mode: 'neutral',
	},

	guard_veteran: {
		name: 'Guard Veteran',
		stats: {
			str: 6, int: 6,
			dex: 6, per: 7,
			con: 6, will: 6,
			beauty: 5, cha: 5,
			instinct: 7, wis: 6
		},
		equipment: {
			mainHand: 'shortSpear',
			offHand: 'largeShield',
			armor: 'chain',
		},
		faction: 'guard',
		spriteSet: 'swordShieldKnight',
		mode: 'neutral',
	},

	// Bandit Templates
	bandit_brute: {
		name: 'Bandit Brute',
		stats: {
			str: 10, int: 3,
			dex: 5, per: 4,
			con: 8, will: 4,
			beauty: 3, cha: 5,
			instinct: 8, wis: 10
		},
		equipment: {
			mainHand: 'shortSword',
			offHand: null,
			armor: 'leather',
		},
		faction: 'bandit',
		spriteSet: 'swordKnight',
		mode: 'aggressive',
	},

	bandit_thief: {
		name: 'Bandit Thief',
		stats: {
			str: 4, int: 5,
			dex: 10, per: 8,
			con: 5, will: 4,
			beauty: 5, cha: 6,
			instinct: 7, wis: 6
		},
		equipment: {
			mainHand: 'shortSword',
			offHand: null,
			armor: 'leather',
		},
		faction: 'bandit',
		spriteSet: 'swordKnight',
		mode: 'aggressive',
	},
};

// Direction helpers for facing and flanking
// Only 6 directions used - matches hex grid neighbors (no pure N/S movement)
// Hex angles: 0°→dir6, 60°→dir7, 120°→dir1, 180°→dir2, 240°→dir3, 300°→dir5
const OPPOSITE_DIRECTION = {
	dir1: 'dir5', dir5: 'dir1',  // 120° ↔ 300°
	dir2: 'dir6', dir6: 'dir2',  // 180° ↔ 0°
	dir3: 'dir7', dir7: 'dir3'   // 240° ↔ 60°
};

/**
 * Get facing direction from pixel delta
 * Returns one of 6 hex directions (60° segments)
 * dir6=0°, dir7=60°, dir1=120°, dir2=180°, dir3=240°, dir5=300°
 */
export function getFacingFromDelta(dx, dy) {
	if (dx === 0 && dy === 0) return 'dir6'; // Default
	let angle = Math.atan2(dy, dx) * 180 / Math.PI;
	angle = (angle + 360) % 360;
	// 6 segments of 60° each, centered on hex directions
	if (angle >= 330 || angle < 30) return 'dir6';   // 0°
	else if (angle < 90) return 'dir7';              // 60°
	else if (angle < 150) return 'dir1';             // 120°
	else if (angle < 210) return 'dir2';             // 180°
	else if (angle < 270) return 'dir3';             // 240°
	else return 'dir5';                              // 300°
}

/**
 * Get the opposite of a facing direction
 */
export function getOppositeDirection(facing) {
	return OPPOSITE_DIRECTION[facing];
}

/**
 * Check if attacker is flanking defender (attacking from behind)
 */
export function isFlanking(attackerHex, defenderHex, defenderFacing, hexGrid) {
	const attackerPixel = hexGrid.hexToPixel(attackerHex.q, attackerHex.r);
	const defenderPixel = hexGrid.hexToPixel(defenderHex.q, defenderHex.r);
	const dx = attackerPixel.x - defenderPixel.x;
	const dy = attackerPixel.y - defenderPixel.y;
	const attackDirection = getFacingFromDelta(dx, dy);
	const behindDirection = getOppositeDirection(defenderFacing);
	return attackDirection === behindDirection;
}

/**
 * Rotate facing direction clockwise or counter-clockwise
 * Only 6 directions matching hex grid: dir6→dir7→dir1→dir2→dir3→dir5→...
 * @param {string} facing - Current facing direction
 * @param {boolean} clockwise - Direction to rotate
 * @param {number} steps - Number of 60-degree steps to rotate (default 1)
 */
export function rotateFacing(facing, clockwise, steps = 1) {
	const order = ['dir6', 'dir7', 'dir1', 'dir2', 'dir3', 'dir5'];
	const idx = order.indexOf(facing);
	if (idx === -1) return facing;
	const offset = clockwise ? steps : (6 - (steps % 6)) % 6;
	const newIdx = (idx + offset) % 6;
	return order[newIdx];
}
