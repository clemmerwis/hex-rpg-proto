import { createDefaultSkills, calculateMaxHP, calculateHPBuffer, calculateEngagedMax } from './const.js';

/**
 * CharacterFactory - Creates character objects with default properties
 *
 * IMPORTANT: Characters created here are FULLY INITIALIZED - no partial state.
 * All Sets, Maps, and calculated properties are ready immediately.
 * This prevents race conditions where game systems access uninitialized properties.
 *
 * Build priority: CharacterFactory defaults < NPC_TEMPLATES/config < localStorage saved template
 * localStorage only overrides stats, skills, equipment (the "build").
 * Game properties (faction, spriteSet, mode, position) always come from config.
 */
export class CharacterFactory {
	/**
	 * Load saved character build (stats/skills/equipment) from localStorage.
	 * @param {string} name - Character name to look up
	 * @returns {Object|null} Saved build or null if not found
	 */
	static loadSavedBuild(name) {
		try {
			const saved = localStorage.getItem(`charTemplate_${name}`);
			if (saved) return JSON.parse(saved);
		} catch (e) {
			console.warn(`[CharacterFactory] Failed to load saved build for "${name}":`, e);
		}
		return null;
	}

	/**
	 * Create a character with default properties merged with config.
	 * Automatically checks localStorage for a saved build matching config.name.
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
			spriteSet: 'baseKnight',
			faction: 'neutral',

			// Stats and equipment
			stats: {
				str: 5, int: 5,
				dex: 5, per: 5,
				con: 5, will: 5,
				beauty: 5, cha: 5,
				instinct: 5, wis: 5
			},
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

		// Check localStorage for saved build (stats/skills/equipment only)
		const savedBuild = config.name ? CharacterFactory.loadSavedBuild(config.name) : null;

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
