export const GAME_CONSTANTS = {
	// Movement
	MOVEMENT_SPEED: 300, // ms per hex
	MOVEMENT_TIMEOUT: 5000, // Failsafe timeout for movement completion (ms)

	// Combat timing
	COMBAT_PHASE_TRANSITION: 100, // ms delay between move and action phases
	COMBAT_ATTACK_WINDUP: 100, // fallback — prefer calculateAttackTiming()
	COMBAT_ATTACK_RECOVERY: 500, // fallback — prefer calculateAttackTiming()
	COMBAT_MOVE_BLOCKED_DELAY: 50, // ms delay when move is blocked before next

	// Animation
	ANIMATION_SPEED: 17, // ms between animation frames

	// World and rendering
	HEX_SIZE: 70,
	ISO_RATIO: 0.5, // Vertical compression for isometric projection (0.5 = classic 2:1 iso)
	WORLD_WIDTH: 3220,
	WORLD_HEIGHT: 2240,
	VIEWPORT_WIDTH: 1280,
	VIEWPORT_HEIGHT: 720,
	ZOOM_LEVEL: 0.5,

	// Camera and scrolling (all speeds in pixels per second)
	EDGE_SCROLL_THRESHOLD: 100,
	MAX_EDGE_SCROLL_SPEED: 900,
	KEYBOARD_SCROLL_SPEED: 1500,      // top speed while a key is held
	KEYBOARD_SCROLL_KICK: 450,        // instant speed on keypress, so input registers on frame one
	SCROLL_ACCEL: 20000,              // px/sec^2 ramping up to the target speed (~67ms to full)
	SCROLL_DECEL: 45000,              // px/sec^2 coasting back to a stop (~33ms)

	// Pathfinding
	PATHFINDING_MAX_DISTANCE: 30,
	PATHFINDING_MAX_ITERATIONS: 100,
	PATHFINDING_MAX_OPEN_SET: 200,

	// UI
	NAMEPLATE_WIDTH: 150,
	NAMEPLATE_HEIGHT: 65,
	HEALTH_BAR_HEIGHT: 22,
	BUFFER_BAR_HEIGHT: 8,

	// Combat Log - VISIBLE must be < HISTORY to prevent index sync issues
	COMBAT_LOG_HISTORY: 500,  // Logger data retention
	COMBAT_LOG_VISIBLE: 150,  // UI DOM retention

	// Sprite
	SPRITE_FRAME_SIZE: 256,
};

/**
 * Create a canonical string key from hex coordinates for Set/Map lookups.
 * Replaces ad-hoc `${q},${r}` patterns throughout the codebase.
 */
export function hexKey(q, r) {
	return `${q},${r}`;
}

// Default animation config for fallback when animation not found
const DEFAULT_ANIM_CONFIG = {
	cols: 4,
	rows: 2,
	frameCount: 6,
	speed: GAME_CONSTANTS.ANIMATION_SPEED,
	oneShot: false
};

// Sprite set registry - each set is self-contained with folder info and animation configs
// Characters get their set from deriveSpriteSet() based on equipment; a template or
// placement can still name one explicitly to override that
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
 * Pick the sprite set that matches what a character is holding.
 *
 * Appearance follows gear, so changing a weapon in the character creator changes
 * how the character looks. Only three sets exist, so every armed character reads
 * as "sword" - spears and hammers included - until more art lands.
 *
 * An explicit spriteSet on a template or placement still wins, for the cases
 * where the art is deliberately not what the gear implies.
 *
 * @param {Object} equipment - { mainHand, offHand, armor }
 * @returns {string} Sprite set key
 */
export function deriveSpriteSet(equipment = {}) {
	const weapon = WEAPONS[equipment.mainHand];
	const offHand = equipment.offHand ? WEAPONS[equipment.offHand] : null;

	if (offHand?.grip === 'off') return 'swordShieldKnight';
	if (weapon && equipment.mainHand !== 'unarmed') return 'swordKnight';
	return 'baseKnight';
}

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

/**
 * Calculate attack animation timing from sprite frameCount and speed.
 * Returns { windupMs, recoveryMs } derived from actual animation data.
 *
 * windupMs = time for attack animation to reach "impact" frame (~40% through)
 * recoveryMs = time for remaining attack frames + impact animation to complete
 */
export function calculateAttackTiming(spriteSet) {
	const attackAnim = spriteSet.animations.attack;
	const impactAnim = spriteSet.animations.impact;
	const attackSpeed = attackAnim.speed || GAME_CONSTANTS.ANIMATION_SPEED;
	const impactSpeed = impactAnim.speed || GAME_CONSTANTS.ANIMATION_SPEED;

	// Windup: ~40% of attack animation (wind-up before strike connects)
	const windupFrames = Math.ceil(attackAnim.frameCount * 0.4);
	const windupMs = windupFrames * attackSpeed;

	// Recovery: remaining attack frames + full impact animation
	const remainingAttackFrames = attackAnim.frameCount - windupFrames;
	const recoveryMs = (remainingAttackFrames * attackSpeed) + (impactAnim.frameCount * impactSpeed);

	return { windupMs, recoveryMs };
}

// Character stat system
// 12 stats across 6 categories, each a Physical/Cerebral column pair
// Each character: min 3 per stat (36 base) + 33 distributable = 69 total
export const STATS = {
	categories: {
		power: { physical: 'str', cerebral: 'int' },
		prowess: { physical: 'dex', cerebral: 'per' },
		resistance: { physical: 'con', cerebral: 'will' },
		appearance: { physical: 'beauty', cerebral: 'cha' },
		spirit: { physical: 'instinct', cerebral: 'wis' },
		// Luck is cerebral: people rationalize what they can't understand
		destiny: { physical: 'source', cerebral: 'luck' }
	},
	all: [
		'str', 'int', 'dex', 'per', 'con', 'will', 'beauty', 'cha', 'instinct', 'wis',
		'source', 'luck'
	],
	MIN: 3,
	MAX: 10,
	TOTAL_POINTS: 69
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
 * Default stats object with every stat in STATS.all present.
 * Use as the base of any merge so a partial/older stats object can never
 * leave a stat undefined (which renders blank and turns arithmetic into NaN).
 * @param {number} value - Value for every stat (defaults to STATS.MIN)
 */
export function createDefaultStats(value = STATS.MIN) {
	return Object.fromEntries(STATS.all.map(stat => [stat, value]));
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
// All of these are summed across mainHand + offHand + armor by getEquipmentBonus()
export const PASSIVE_BONUSES = {
	defR: 'Applied to Defense Rating via calculateDefR() — NOT armor ADR',
	attkR: 'Applied to Attack Rating via calculateAttkR()',
	critMod: 'Flat +/- to Critical Strike Chance via calculateCSC()',
	evasionBonus: 'Subtracted from an attacker\'s to-hit chance in resolveHitRoll()',
	critMultiplier: 'REPLACES the default 1.5x crit damage multiplier (does not stack with it)',
};

// Conditions that can sit on character.conditions (a Set of these keys).
// Only KNOCKDOWN is wired up - the rest of WEAPON_EFFECTS below is still inert.
export const CONDITIONS = {
	KNOCKDOWN: 'knockdown',
};

// Triggered effect definitions (stubbed for future implementation)
// These activate under specific conditions during combat
export const WEAPON_EFFECTS = {
	// Conditions - applied to target
	// knockdown is live: see CombatSystem.applyKnockdown()
	knockdown: { type: 'condition', effect: 'knockdown', trigger: 'onCrit', always: true },
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
		bypassADROnCrit: true,
		description: 'Impact damage that bypasses HP buffer. On a crit it also lands inside the guard, ignoring Armor Damage Reduction entirely'
	},
	blunt: {},
	slash: {},
	piercing: {}
};

// Equipment definitions
// grip: 'one' (short/unarmed - mainHand only), 'two' (long weapons), 'off' (shields - offHand only)
// passives: { defR, attkR, critMultiplier, evasionBonus, ... } - gathered via getEquipmentBonus()
// effects: triggered effects referencing WEAPON_EFFECTS keys
export const WEAPONS = {
	unarmed: { name: 'Unarmed', base: 2, type: 'concussive', force: 1, speed: 16, grip: 'two', passives: { evasionBonus: 5, critMod: -15, critMultiplier: 2 }, effects: ['knockdown'] },
	shortSpear: { name: 'Short Spear', base: 3, type: 'piercing', force: 1, speed: 19, grip: 'one', passives: {}, effects: ['vulnerableEnhancementLight'] },
	shortSword: { name: 'Short Sword', base: 4, type: 'slash', force: 2, speed: 18, grip: 'one', passives: { critMod: 10 }, effects: ['bleedingLight'] },
	shortHammer: { name: 'Short Hammer', base: 6, type: 'blunt', force: 3, speed: 26, grip: 'one', passives: { critMod: -10 }, effects: ['armorDamageEnhancementLight'] },
	longSword: { name: 'Long Sword', base: 8, type: 'slash', force: 4, speed: 20, grip: 'two', passives: { critMod: 10 }, effects: ['bleedingHeavy'] },
	longSpear: { name: 'Long Spear', base: 6, type: 'piercing', force: 4, speed: 20, grip: 'two', passives: {}, effects: ['vulnerableEnhancementHeavy'] },
	longHammer: { name: 'Long Hammer', base: 10, type: 'blunt', force: 6, speed: 31, grip: 'two', passives: { critMod: -10 }, effects: ['armorDamageEnhancementHeavy'] },
	smallShield: { name: 'Small Shield', base: 1, type: 'blunt', force: 2, speed: 17, grip: 'off', passives: { defR: 4 }, effects: [] },
	largeShield: { name: 'Large Shield', base: 1, type: 'blunt', force: 3, speed: 20, grip: 'off', passives: { defR: 8 }, effects: [] },
};

// Attack types - affect action speed and damage
export const ATTACK_TYPES = {
	light: { name: 'light Attack', speedMod: 12, damageMod: 0 },
	heavy: { name: 'heavy Attack', speedMod: 22, damageMod: 6 },
};

// Armor definitions
// adr = Armor Damage Reduction: flat damage subtracted after resist/vuln.
//   Distinct from Defense Rating (DefR), which is the to-hit number, and from
//   resistantAgainst/vulnerableAgainst, which are multipliers rather than
//   subtraction. This field used to be called `defense`, which read like it fed
//   Defense Rating - it never did.
// mobility affects move speed (reduced by Str), flankingDefense scales ADR when flanked
// passives: { ... } - gathered via getEquipmentBonus() along with weapon/shield passives
export const ARMOR_TYPES = {
	none: { name: 'Unarmored', adr: 0, mobility: 20, weight: 'none', noise: 'none', resistantAgainst: [], vulnerableAgainst: ['slash', 'piercing', 'blunt'], flankingDefense: 1.0, passives: {} },
	leather: { name: 'Leather', adr: 6, mobility: 20, weight: 'light', noise: 'none', resistantAgainst: ['piercing'], vulnerableAgainst: ['blunt'], flankingDefense: 1.5, passives: {} },
	scale: { name: 'Scale', adr: 8, mobility: 25, weight: 'medium', noise: 'medium', resistantAgainst: ['slash'], vulnerableAgainst: ['piercing'], flankingDefense: 0.0, passives: {} },
	brigandine: { name: 'Brigandine', adr: 10, mobility: 23, weight: 'medium', noise: 'low', resistantAgainst: ['piercing', 'slash'], vulnerableAgainst: ['blunt'], flankingDefense: 0.5, passives: {} },
	chain: { name: 'Chain (Heavy)', adr: 10, mobility: 28, weight: 'heavy', noise: 'medium', resistantAgainst: ['slash'], vulnerableAgainst: [], flankingDefense: 0.25, passives: {} },
	plate: { name: 'Plate', adr: 12, mobility: 30, weight: 'heavy', noise: 'high', resistantAgainst: ['slash', 'blunt'], vulnerableAgainst: ['piercing'], flankingDefense: 0.75, passives: {} },
};

// Turn speed tiers - lower total speed = faster tier
// Move phase uses armor.mobility, Action phase uses weapon+shield speed + attackType - Dex
export const TURN_SPEED_TIERS = [
	{ tier: 1, min: 0, max: 25, name: '1/4' },
	{ tier: 2, min: 26, max: 40, name: '2/4' },
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
 * Calculate Critical Attack Rating
 * Formula: (criticalStrike skill * 5) + (Int * 3) + (Str * 2)
 */
export function calculateCritAttkR(character) {
	const skillLevel = character.skills.criticalStrike || 1;
	return (skillLevel * 5) + (character.stats.int * 3) + (character.stats.str * 2);
}

/**
 * Calculate Critical Defense Rating
 * Formula: (criticalDefense skill * 5) + (Dex * 3) + (Per * 2) + Instinct
 */
export function calculateCritDefR(character) {
	const skillLevel = character.skills.criticalDefense || 1;
	return (skillLevel * 5) + (character.stats.dex * 3) + (character.stats.per * 2) + character.stats.instinct;
}

/**
 * Calculate Critical Strike Chance as integer percentage (0-100%)
 * Formula: (CritAttkR - CritDefR) + CRIT_BASE + critMod (from passives), clamped to 0-100
 * critMod is a flat modifier from equipment passives (negative = penalty, positive = bonus)
 */
export function calculateCSC(attacker, defender) {
	const critAttkR = calculateCritAttkR(attacker);
	const critDefR = calculateCritDefR(defender);
	const critMod = getEquipmentBonus(attacker, 'critMod');
	return Math.max(0, Math.min(100, (critAttkR - critDefR) + COMBAT_MODIFIERS.CRIT_BASE + critMod));
}

/**
 * Crit damage multiplier for an attacker's current loadout.
 * A weapon's passives.critMultiplier REPLACES the CRIT_DAMAGE_MULT default; it
 * used to multiply on top of it, so a weapon asking for 2x silently got 3x.
 */
export function getCritMultiplier(attacker) {
	const override = getEquipmentBonus(attacker, 'critMultiplier');
	return override > 0 ? override : COMBAT_MODIFIERS.CRIT_DAMAGE_MULT;
}

// Skill definitions (all range 1-10)
// Weapon skills use the weapon key directly (e.g., skills.shortSword)
export const SKILLS = {
	defense: ['block', 'dodge'],
	weapons: ['unarmed', 'shortSword', 'longSword', 'shortSpear', 'longSpear', 'shortHammer', 'longHammer'],
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
		shortHammer: 1,
		longHammer: 1,
		// Critical
		criticalStrike: 1,
		criticalDefense: 1,
	};
}

/**
 * Calculate weapon skill synergy bonus
 * Weapons with the same damage type give synergy: floor(partnerSkill / 3)
 * e.g., Long Slash at 6 gives +2 to Short Slash
 */
export function getWeaponSynergy(character, weaponKey) {
	const weapon = WEAPONS[weaponKey];
	if (!weapon) return 0;

	let maxSynergy = 0;
	for (const otherKey of SKILLS.weapons) {
		if (otherKey === weaponKey) continue;
		const otherWeapon = WEAPONS[otherKey];
		if (otherWeapon && otherWeapon.type === weapon.type) {
			const otherSkill = character.skills[otherKey] || 1;
			maxSynergy = Math.max(maxSynergy, Math.floor(otherSkill / 3));
		}
	}
	return maxSynergy;
}

/**
 * Calculate Attack Rating (AttkR)
 * Formula: ((skill + synergy) * 5) + (Str * 3) + (Dex * 2) + attkR (from passives)
 */
export function calculateAttkR(character) {
	const weaponKey = character.equipment.mainHand;
	const weapon = WEAPONS[weaponKey];
	const skillLevel = character.skills[weaponKey] || 1;
	const synergy = getWeaponSynergy(character, weaponKey);
	// attkR used to be read off the weapon root, which meant a passives.attkR
	// would have been silently ignored and shields/armor could never contribute.
	const attrBonus = getEquipmentBonus(character, 'attkR');
	return ((skillLevel + synergy) * 5) + (character.stats.str * 3) + (character.stats.dex * 2) + attrBonus;
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
 * Calculate Defense Rating (DefR) — the to-hit defence number.
 * NOT to be confused with ADR, an armor's flat damage reduction.
 * Formula: (skill * 5) + (Dex * 3) + (Instinct * 2) + defR (from passives) + 5 (base defence bonus)
 * Uses block skill if holding shield, dodge skill otherwise
 *
 * mode overrides which defence is being made - for sheets that want to show both
 * sides of the shield trade-off. 'dodge' also drops the off-hand's passives,
 * since a character who isn't blocking with the shield isn't getting its bonus.
 *   'auto'  - block with a shield equipped, dodge otherwise (what combat uses)
 *   'block' - block skill, off-hand passives counted
 *   'dodge' - dodge skill, off-hand passives dropped
 */
export function calculateDefR(character, mode = 'auto') {
	const offHandKey = character.equipment.offHand;
	const offHand = offHandKey ? WEAPONS[offHandKey] : null;
	const hasShield = !!(offHand && offHand.grip === 'off');
	const isBlocking = mode === 'auto' ? hasShield : mode === 'block';
	const skillLevel = isBlocking ? character.skills.block : character.skills.dodge;
	const defenseBonus = getEquipmentBonus(character, 'defR')
		- (isBlocking ? 0 : (offHand?.passives?.defR || 0));
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
//
// Allegiance is a plain faction-equality check: same faction = allies (cannot
// target or engage each other, and they share grudges via getEffectiveEnemies).
// So 'pc' is the player's side - spawn an ally by giving it faction 'pc'.
//
// spawnable: false marks an entry that exists only to carry colours and is not
// a side anyone can belong to. Keep those out of any faction picker.
export const FACTIONS = {
	pc: {
		name: "Ally (player side)",
		tintColor: "#4CAF50",
		nameplateColor: "#00ff00",
	},
	// Colour-only. The PC renders with FACTIONS.pc; everyone else on the player's
	// side renders with this, so allies read as blue and the hero as green.
	// Nothing ever has faction 'pc_ally' - see CharacterRenderer.getFactionData().
	pc_ally: {
		name: "Ally colours (not a side)",
		spawnable: false,
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

// Combat modifiers applied on top of the rating subtraction
// FLANK_THC_BONUS is worth 3 skill levels or 5 stat points of defence, so
// earning it is a real play. Both flanking sources (behind-the-back and
// engagement overload) grant it, and they do not stack - see isFlanking() and
// EngagementManager.canEngageBack().
export const COMBAT_MODIFIERS = {
	// Baseline to-hit before the rating difference: two dead-even fighters land
	// half their swings. The single source for the "+ 50" in
	//   THC = (AttkR + atkMods) - (DefR + defMods) + THC_BASE
	// resolveHitRoll() and the builder's formula captions both read it from
	// here - CRIT_BASE moved once and its hardcoded HTML copy went stale, so
	// this number never gets a second home.
	THC_BASE: 50,
	FLANK_THC_BONUS: 15,
	// Baseline crit chance, before the CritAttkR - CritDefR difference and equipment critMod.
	// Was 50, which made two evenly-matched fighters crit about half their swings -
	// "critical" was the default outcome, and the negative critMods on hammers and
	// unarmed were the only thing holding it down. At 25 the modifiers move a
	// number that is genuinely a minority case.
	//
	// NOTE: this leaves only ~21 points of headroom below an even matchup, so
	// weapon critMods have to stay small. The pre-existing -15/-25 penalties were
	// sized against the old 50 baseline; at 25 anything steeper than about -20
	// clamps to a flat 0% and the weapon can never crit at all.
	CRIT_BASE: 25,
	// Default crit damage multiplier. A weapon's passives.critMultiplier REPLACES
	// this rather than compounding with it - see getCritMultiplier().
	CRIT_DAMAGE_MULT: 1.5,
	// Defense Rating multiplier while knocked down, applied against adjacent melee.
	// A state mod, not a THC mod - situation goes in the atkMods/defMods buckets,
	// state changes what a rating IS (same category as DefR's block-vs-dodge
	// branch). Multiplicative rather than flat for two reasons: it impairs
	// capability, so everyone keeps 70% of whatever they had rather than losing
	// a fixed chunk; and it rides rating inflation - a flat penalty sized for
	// today's DefR 44-69 roster (x0.7 ~ flat -15) goes trivial at the ~113 a
	// max block build reaches. See docs/reference.md "The formula never
	// changes shape".
	KNOCKDOWN_DR_MULT: 0.7,
};

// Shared-edge border visuals
// The hex edge between two adjacent enemies reports flanking. FLANK_COLOR
// appears if and only if flanking is live. Grammar:
//   faction -> faction gradient - neither exposed, both locked in
//   solid FLANK_COLOR - one side holds the advantage
//   faction -> FLANK_COLOR -> faction - both exposed to each other, all three
//     hues in one edge
// FLANK_COLOR must stay off the FACTIONS palette or it reads as a faction claim.
// Iso compression leaves the E/W edges ~17px tall at ZOOM_LEVEL, so all of this
// has to carry on hue alone - seams and dashes vanish at that size.
export const ENGAGEMENT_BORDER = {
	EDGE_WIDTH: 15,
	FLANK_COLOR: '#DDA0FF',
};

/**
 * Semantic tokens used by CombatSystem - replaced with formatted HTML
 * This keeps game logic separate from presentation
 */
export const COMBAT_TAGS = {
	'{{critical}}': '<span style="color: #001F3F;">[critical]</span>',
	'{{flanking}}': '<span style="color: #001F3F;">[flanking]</span>',
	'{{friendlyFire}}': '<span class="log-condition-bracket">[</span><span class="log-condition">friendly fire</span><span class="log-condition-bracket">]</span>',
	'{{blocked}}': '<span class="log-condition-bracket">(</span><span style="color: #001F3F;">Blocked</span><span class="log-condition-bracket">)</span>',
	'{{knockdown}}': '<span class="log-condition-bracket">(</span><span class="log-condition">knocked down</span><span class="log-condition-bracket">)</span>',
	'{{prone}}': '<span class="log-condition-bracket">[</span><span class="log-condition">prone</span><span class="log-condition-bracket">]</span>',
	'{{hit}}': '<span class="log-hit">HIT</span>',
	'{{miss}}': '<span class="log-miss">MISS</span>',
	'{{whiff}}': '<span class="log-miss">WHIFF</span>',
	'{{hitPrefix}}': '<span class="log-hit">HIT:</span>',
};

/**
 * Wrapper tokens that mark semantic regions
 * Format: {{tag}}content{{/tag}} -> styled content
 */
export const WRAPPER_TAGS = {
	'buf': (content) => `<span style="color: #9932CC;">${content}</span>`,
	'buf_depleted': (content) => `<span style="color: #9932CC;">${content}</span>`,
	'buf_bypassed': (content) => `<span class="log-buf-bypassed" data-tooltip="Unarmed attacks bypass Instinct HP buffer">${content}</span>`,
	'adr_bypassed': (content) => `<span class="log-buf-bypassed" data-tooltip="A critical concussive hit lands inside the guard - Armor Damage Reduction does not apply">${content}</span>`,
	'hp': (content) => `<span class="log-hp">${content}</span>`,
	'dmg': (content) => `<span class="log-damage">${content}</span>`,
	'thc': (content) => `<span class="log-thc">${content}</span>`,
	'csc': (content) => `<span class="log-csc">${content}</span>`,
	'roll': (content) => `<span class="log-thc">${content}</span>`,
	'adr': (content) => `<span style="color: #1a1a1a;">${content}</span>`,
	'vuln': (content) => `<span style="color: #9932CC;">${content}</span>`,
	'resist': (content) => `<span style="color: #505050;">${content}</span>`,
	'heavy': (content) => `<span class="log-heavy">${content}</span>`,
	'spd': (content) => `<span style="color: #1565C0;">${content}</span>`,
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
	// Player Character Template
	hero: {
		name: 'Hero',
		stats: {
			str: 7, int: 5,
			dex: 7, per: 6,
			con: 7, will: 5,
			beauty: 5, cha: 5,
			instinct: 6, wis: 7,
			source: 3, luck: 3
		},
		skills: {
			...createDefaultSkills(),
			unarmed: 3,
			dodge: 3,
		},
		equipment: {
			mainHand: 'unarmed',
			offHand: null,
			armor: 'scale',
		},
		// Must be one of the six hex facings. The sprite sets ship all eight
		// compass directions, but dir4/dir8 are the pure N/S pair a hex grid has
		// no neighbour for - facing one strands rotateFacing() and makes
		// getOppositeDirection() undefined, which silently disables flanking.
		facing: 'dir6',
		faction: 'pc',
		mode: 'aggressive',
	},

	// PC Faction Templates
	companion: {
		name: 'Companion',
		stats: {
			str: 6, int: 6,
			dex: 8, per: 6,
			con: 6, will: 6,
			beauty: 6, cha: 6,
			instinct: 7, wis: 6,
			source: 3, luck: 3
		},
		skills: {
			...createDefaultSkills(),
			dodge: 3,
			shortSword: 3,
		},
		equipment: {
			mainHand: 'shortSword',
			offHand: null,
			armor: 'leather',
		},
		faction: 'pc',
		mode: 'aggressive',
	},

	// Guard Templates
	guard_captain: {
		name: 'Guard Captain',
		stats: {
			str: 6, int: 5,
			dex: 6, per: 6,
			con: 7, will: 6,
			beauty: 6, cha: 7,
			instinct: 9, wis: 5,
			source: 3, luck: 3
		},
		skills: {
			...createDefaultSkills(),
			block: 4,
			shortSpear: 2,
		},
		equipment: {
			mainHand: 'shortSpear',
			offHand: 'largeShield',
			armor: 'chain',
		},
		faction: 'guard',
		mode: 'neutral',
	},

	guard_novice: {
		name: 'Guard Novice',
		stats: {
			str: 6, int: 5,
			dex: 6, per: 6,
			con: 7, will: 6,
			beauty: 6, cha: 7,
			instinct: 9, wis: 5,
			source: 3, luck: 3
		},
		skills: {
			...createDefaultSkills(),
			dodge: 2,
			longSpear: 2,
			criticalStrike: 2,
			criticalDefense: 2,
		},
		equipment: {
			mainHand: 'longSpear',
			offHand: null,
			armor: 'chain',
		},
		faction: 'guard',
		mode: 'neutral',
	},

	// Bandit Templates
	bandit_brute: {
		name: 'Bandit Brute',
		stats: {
			str: 9, int: 4,
			dex: 6, per: 5,
			con: 8, will: 6,
			beauty: 7, cha: 5,
			instinct: 8, wis: 5,
			source: 3, luck: 3
		},
		skills: {
			...createDefaultSkills(),
			criticalStrike: 3,
			longHammer: 3,
		},
		equipment: {
			mainHand: 'longHammer',
			offHand: null,
			armor: 'brigandine',
		},
		faction: 'bandit',
		mode: 'aggressive',
	},

	bandit_leader: {
		name: 'Bandit Leader',
		stats: {
			str: 4, int: 9,
			dex: 8, per: 8,
			con: 4, will: 4,
			beauty: 6, cha: 6,
			instinct: 8, wis: 6,
			source: 3, luck: 3
		},
		skills: {
			...createDefaultSkills(),
			dodge: 4,
			longSword: 2,
		},
		equipment: {
			mainHand: 'longSword',
			offHand: null,
			armor: 'brigandine',
		},
		faction: 'bandit',
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
	// An off-cycle facing (a dir4/dir8 sprite direction) used to return unchanged,
	// which froze rotation permanently and read as the keys being broken. Snap
	// into the cycle instead, so a press always visibly does something.
	if (idx === -1) return order[0];
	const offset = clockwise ? steps : (6 - (steps % 6)) % 6;
	const newIdx = (idx + offset) % 6;
	return order[newIdx];
}
