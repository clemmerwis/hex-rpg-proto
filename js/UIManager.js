import { GAME_STATES } from './GameStateManager.js';

/**
 * UIManager - Handles all DOM manipulation and UI updates
 * Separates UI concerns from game logic in Game.js
 */
export class UIManager {
	constructor() {
		this.elements = null;
		this.canvas = null;
		this.ctx = null;
	}

	/**
	 * Initialize and cache all DOM element references
	 * Replaces Game.initializeDOMElements()
	 */
	initializeDOMElements() {
		// Canvas
		this.canvas = document.getElementById('gameCanvas');
		this.ctx = this.canvas.getContext('2d');

		// Debug elements
		this.elements = {
			showGrid: document.getElementById('showGrid'),
			cameraPos: document.getElementById('cameraPos'),
			direction: document.getElementById('directionInfo'),
			animation: document.getElementById('animationInfo'),

			// UI elements
			stateIndicator: document.getElementById('stateIndicator'),
			combatInfo: document.getElementById('combatInfo'),
			currentTurn: document.getElementById('currentTurn'),
			activeCharacter: document.getElementById('activeCharacter'),
			enemyCount: document.getElementById('enemyCount'),

			// Hex marker elements
			hexMarkerMode: document.getElementById('hexMarkerMode'),
			hexMarkerControls: document.getElementById('hexMarkerControls'),
			exportHexes: document.getElementById('exportHexes'),
			clearHexes: document.getElementById('clearHexes'),
			markedCount: document.getElementById('markedCount')
		};
	}

	/**
	 * Update game state indicator UI based on current game state
	 * Replaces Game.updateGameStateUI()
	 * @param {GameStateManager} gameStateManager - The game state manager
	 * @param {Object} gameState - The game state object (this.state from Game)
	 */
	updateGameState(gameStateManager, gameState) {
		const elements = this.elements;
		const currentState = gameStateManager.currentState;

		if (currentState === GAME_STATES.COMBAT_INPUT) {
			elements.stateIndicator.textContent = 'COMBAT - INPUT PHASE';
			elements.stateIndicator.className = 'state-indicator state-combat';
			elements.combatInfo.style.display = 'block';

			elements.currentTurn.textContent = gameStateManager.turnNumber;
			elements.activeCharacter.textContent = gameStateManager.characterActions.has(gameState.pc)
				? 'Action Chosen' : 'Choose Action';

			const enemyCount = gameState.npcs.filter(npc => npc.faction === 'bandit' && !npc.isDefeated).length;
			elements.enemyCount.textContent = enemyCount;

		} else if (currentState === GAME_STATES.COMBAT_EXECUTION) {
			elements.stateIndicator.textContent = 'COMBAT - EXECUTION';
			elements.stateIndicator.className = 'state-indicator state-combat-execution';
			elements.combatInfo.style.display = 'block';

			elements.currentTurn.textContent = gameStateManager.turnNumber;

			// Show current phase and character
			const phase = gameStateManager.currentPhase;
			let activeChar = null;

			if (phase === 'move') {
				const idx = gameStateManager.currentMoveIndex;
				const queue = gameStateManager.moveQueue;
				if (idx < queue.length) {
					activeChar = queue[idx];
				}
				elements.activeCharacter.textContent = activeChar
					? `${activeChar.name} Moving`
					: 'Moves Complete';
			} else if (phase === 'action') {
				const idx = gameStateManager.currentActionIndex;
				const queue = gameStateManager.actionQueue;
				if (idx < queue.length) {
					activeChar = queue[idx];
				}
				elements.activeCharacter.textContent = activeChar
					? `${activeChar.name} Attacking`
					: 'Attacks Complete';
			} else {
				elements.activeCharacter.textContent = 'Preparing...';
			}

			const enemyCount = gameState.npcs.filter(npc => npc.faction === 'bandit' && !npc.isDefeated).length;
			elements.enemyCount.textContent = enemyCount;

		} else {
			elements.stateIndicator.textContent = 'EXPLORATION';
			elements.stateIndicator.className = 'state-indicator state-exploration';
			elements.combatInfo.style.display = 'none';
		}
	}

	/**
	 * Update camera position display
	 * Extracts UI update from Game.clampCamera()
	 * @param {number} x - Camera x position
	 * @param {number} y - Camera y position
	 */
	updateCameraPosition(x, y) {
		this.elements.cameraPos.textContent = `${Math.round(x)}, ${Math.round(y)}`;
	}

	/**
	 * Update marked hex count display
	 * Replaces Game.updateMarkedHexCount()
	 * @param {number} count - Number of marked hexes
	 */
	updateMarkedHexCount(count) {
		this.elements.markedCount.textContent = `Marked: ${count}`;
	}

	/**
	 * Update animation info display
	 * @param {string} animation - Current animation name
	 */
	updateAnimationInfo(animation) {
		this.elements.animation.textContent = animation;
	}

	/**
	 * Update direction info display
	 * @param {string} direction - Current facing direction
	 */
	updateDirectionInfo(direction) {
		this.elements.direction.textContent = direction;
	}

	/**
	 * Setup event listeners for UI controls
	 * Extracts event handler setup from Game.setupCallbacks()
	 * @param {Object} callbacks - Callback functions from Game
	 */
	setupEventHandlers(callbacks) {
		// Checkbox event for grid display
		this.elements.showGrid.addEventListener('change', callbacks.onShowGridChange);

		// Hex marker mode controls
		this.elements.hexMarkerMode.addEventListener('change', callbacks.onHexMarkerModeChange);
		this.elements.exportHexes.addEventListener('click', callbacks.onExportHexes);
		this.elements.clearHexes.addEventListener('click', callbacks.onClearHexes);
	}
}
