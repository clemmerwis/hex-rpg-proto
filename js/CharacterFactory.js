import { createDefaultSkills, createDefaultStats, deriveSpriteSet, calculateMaxHP, calculateHPBuffer, calculateEngagedMax } from './const.js';
import { CharacterStore } from './CharacterStore.js';

/**
 * CharacterFactory - Creates character objects with default properties
 *
 * IMPORTANT: Characters created here are FULLY INITIALIZED - no partial state.
 * All Sets, Maps, and calculated properties are ready immediately.
 * This prevents race conditions where game systems access uninitialized properties.
 *
 * Build priority: CharacterFactory defaults < NPC_TEMPLATES/config < saved build
 * Saved builds (characters/*.json via CharacterStore) only override stats, skills,
 * and equipment. Game properties (faction, spriteSet, mode, position) always come
 * from config, so a saved build can never change a character's identity.
 *
 * CharacterStore.loadAll() must be awaited before createCharacter() is called.
 */
export class CharacterFactory {
	/**
	 * Create a character with default properties merged with config.
	 * Automatically applies a saved build from CharacterStore matching config.name.
	 * @param {Object} config - Character configuration overrides
	 * @returns {Object} Character object with all required properties (fully initialized)
	 */
	static createCharacter(config) {
		const defaults = {
			// Hex position
			hexQ: 0,
			hexR: 0,
			pixelX: 0,
			pixelY: 0,

			// Visual state
			facing: 'dir6',
			animationFrame: 0,
			animationTimer: 0,
			currentAnimation: 'idle',

			// Character identity
			name: 'Unnamed',
			faction: 'neutral',

			// Stats and equipment
			stats: createDefaultStats(5),
			equipment: {
				mainHand: 'unarmed',
				offHand: null,
				armor: 'none',
			},
			skills: createDefaultSkills(),

			// Combat stats (calculated immediately - no null state)
			isDefeated: false,

			// Movement state
			movementQueue: [],
			isMoving: false,
			moveSpeed: 300,
			currentMoveTimer: 0,
			targetPixelX: 0,
			targetPixelY: 0,

			// AI/Disposition state
			mode: 'neutral',
			lastAttackedBy: null,
		};

		// Saved build from characters/*.json (stats/skills/equipment only).
		// buildId lets several placements share one build under different names.
		const buildKey = config.buildId || config.name;
		const savedBuild = buildKey ? CharacterStore.get(buildKey) : null;

		// Merge: defaults < config < savedBuild (for build properties only)
		const character = {
			...defaults,
			...config,
			stats: {
				...defaults.stats,
				...(config.stats || {}),
				...(savedBuild?.stats || {}),
			},
			equipment: {
				...defaults.equipment,
				...(config.equipment || {}),
				...(savedBuild?.equipment || {}),
			},
			skills: {
				...(config.skills || defaults.skills),
				...(savedBuild?.skills || {}),
			},
		};

		// Appearance follows gear unless a template or placement names a set
		// explicitly. Equipment is build-editable, so deriving here is what makes
		// swapping a weapon in the creator change how the character looks.
		character.spriteSet = config.spriteSet || deriveSpriteSet(character.equipment);

		// Initialize Sets and Maps (NEVER null - always ready)
		character.enemies = new Set();
		character.engagedBy = new Set();
		character.hpBufferByAttacker = new Map();

		// Calculate health properties from stats (immediate, not deferred)
		character.maxHealth = calculateMaxHP(character.stats);
		character.health = character.maxHealth;
		character.hpBufferMax = calculateHPBuffer(character.stats);
		character.engagedMax = calculateEngagedMax(character.stats);

		return character;
	}
}
