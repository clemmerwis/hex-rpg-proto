import { FACTIONS, GAME_CONSTANTS } from './const.js';

/**
 * Semantic tokens used by CombatSystem - replaced with formatted HTML
 * This keeps game logic separate from presentation
 */
const COMBAT_TAGS = {
	'{{critical}}': '<span style="color: #001F3F;">[critical]</span>',
	'{{flanking}}': '<span style="color: #001F3F;">[flanking]</span>',
	'{{friendlyFire}}': '<span class="log-condition-bracket">[</span><span class="log-condition">friendly fire</span><span class="log-condition-bracket">]</span>',
	'{{blocked}}': '<span class="log-condition-bracket">(</span><span style="color: #001F3F;">Blocked</span><span class="log-condition-bracket">)</span>',
	'{{hit}}': '<span class="log-hit">HIT</span>',
	'{{miss}}': '<span class="log-miss">MISS</span>',
	'{{whiff}}': '<span class="log-miss">WHIFF</span>',
	'{{hitPrefix}}': '<span class="log-hit">HIT:</span>',
};

/**
 * Wrapper tokens that mark semantic regions
 * Format: {{tag}}content{{/tag}} -> styled content
 */
const WRAPPER_TAGS = {
	'buf': (content) => `<span style="color: #9932CC;">${content}</span>`,
	'buf_depleted': (content) => `<span style="color: #9932CC;">${content}</span>`,
	'buf_bypassed': (content) => `<span style="color: #FF8C00;">${content}</span>`,
	'hp': (content) => `<span class="log-hp">${content}</span>`,
	'dmg': (content) => `<span class="log-damage">${content}</span>`,
	'thc': (content) => `<span class="log-thc">${content}</span>`,
	'csc': (content) => `<span class="log-csc">${content}</span>`,
	'roll': (content) => `<span class="log-thc">${content}</span>`,
	'dr': (content) => `<span style="color: #1a1a1a;">${content}</span>`,
	'vuln': (content) => `<span style="color: #9932CC;">${content}</span>`,
	'resist': (content) => `<span style="color: #505050;">${content}</span>`,
	'heavy': (content) => `<span class="log-heavy">${content}</span>`,
};

/**
 * Combat UI Log - Draggable, resizable combat log with rich text formatting
 * Displays combat events with faction-colored character names, damage breakdowns, and special effects
 */
export class CombatUILog {
	constructor(logger, game) {
		this.logger = logger;
		this.game = game;

		// DOM elements (initialized in init())
		this.container = null;
		this.header = null;
		this.content = null;
		this.resizeHandle = null;
		this.clearButton = null;

		// Drag state
		this.isDragging = false;
		this.dragStartX = 0;
		this.dragStartY = 0;
		this.dragStartLeft = 0;
		this.dragStartTop = 0;

		// Resize state
		this.isResizing = false;
		this.resizeStartX = 0;
		this.resizeStartY = 0;
		this.resizeStartWidth = 0;
		this.resizeStartHeight = 0;

		// Minimum size constraints
		this.minWidth = 300;
		this.minHeight = 150;

		// Last processed log index (for incremental updates)
		this.lastProcessedIndex = 0;

		// Track if box has been moved by user
		this.hasBeenMoved = false;

		// Bind methods for event listeners
		this.onDrag = this.onDrag.bind(this);
		this.stopDrag = this.stopDrag.bind(this);
		this.onResize = this.onResize.bind(this);
		this.stopResize = this.stopResize.bind(this);
	}

	/**
	 * Initialize the combat log UI - cache DOM elements and setup events
	 */
	init() {
		console.log('[CombatUILog] Initializing...');
		// Cache DOM elements
		this.container = document.getElementById('combatLog');
		this.header = document.getElementById('combatLogHeader');
		this.content = document.getElementById('combatLogContent');
		this.resizeHandle = document.getElementById('combatLogResize');
		this.clearButton = document.getElementById('combatLogClear');

		if (!this.container) {
			console.error('[CombatUILog] Could not find #combatLog element');
			return;
		}

		console.log('[CombatUILog] Initialized successfully');

		// Setup event listeners
		this.setupDragAndDrop();
		this.setupResize();
		this.setupClearButton();
	}

	/**
	 * Setup drag and drop functionality (header as drag handle)
	 */
	setupDragAndDrop() {
		this.header.addEventListener('mousedown', (e) => {
			// Don't drag if clicking on the clear button
			if (e.target === this.clearButton) return;
			this.startDrag(e);
		});
	}

	/**
	 * Setup resize functionality (bottom-right handle)
	 */
	setupResize() {
		this.resizeHandle.addEventListener('mousedown', (e) => {
			this.startResize(e);
			e.stopPropagation(); // Prevent drag from triggering
		});
	}

	/**
	 * Setup clear button functionality
	 */
	setupClearButton() {
		this.clearButton.addEventListener('click', () => {
			this.clear();
		});
	}

	/**
	 * Start dragging the combat log
	 */
	startDrag(e) {
		this.isDragging = true;
		this.dragStartX = e.clientX;
		this.dragStartY = e.clientY;

		// Get current position
		const rect = this.container.getBoundingClientRect();
		this.dragStartLeft = rect.left;
		this.dragStartTop = rect.top;

		// Remove transform centering when dragging starts
		this.container.style.transform = 'none';
		this.container.style.left = `${this.dragStartLeft}px`;
		this.container.style.top = `${this.dragStartTop}px`;

		this.hasBeenMoved = true;

		document.addEventListener('mousemove', this.onDrag);
		document.addEventListener('mouseup', this.stopDrag);
		e.preventDefault();
	}

	/**
	 * Handle drag movement
	 */
	onDrag(e) {
		if (!this.isDragging) return;

		const deltaX = e.clientX - this.dragStartX;
		const deltaY = e.clientY - this.dragStartY;

		this.container.style.left = `${this.dragStartLeft + deltaX}px`;
		this.container.style.top = `${this.dragStartTop + deltaY}px`;
	}

	/**
	 * Stop dragging
	 */
	stopDrag(e) {
		this.isDragging = false;
		document.removeEventListener('mousemove', this.onDrag);
		document.removeEventListener('mouseup', this.stopDrag);
	}

	/**
	 * Start resizing the combat log
	 */
	startResize(e) {
		this.isResizing = true;
		this.resizeStartX = e.clientX;
		this.resizeStartY = e.clientY;
		this.resizeStartWidth = this.container.offsetWidth;
		this.resizeStartHeight = this.container.offsetHeight;

		document.addEventListener('mousemove', this.onResize);
		document.addEventListener('mouseup', this.stopResize);
		e.preventDefault();
	}

	/**
	 * Handle resize movement
	 */
	onResize(e) {
		if (!this.isResizing) return;

		const deltaX = e.clientX - this.resizeStartX;
		const deltaY = e.clientY - this.resizeStartY;

		const newWidth = Math.max(this.minWidth, this.resizeStartWidth + deltaX);
		const newHeight = Math.max(this.minHeight, this.resizeStartHeight + deltaY);

		this.container.style.width = `${newWidth}px`;
		this.container.style.height = `${newHeight}px`;
	}

	/**
	 * Stop resizing
	 */
	stopResize(e) {
		this.isResizing = false;
		document.removeEventListener('mousemove', this.onResize);
		document.removeEventListener('mouseup', this.stopResize);
	}

	/**
	 * Show the combat log
	 */
	show() {
		console.log('[CombatUILog] show() called, container:', this.container);
		if (!this.container) {
			console.error('[CombatUILog] Cannot show - container is null');
			return;
		}
		this.container.style.display = 'block';
		console.log('[CombatUILog] Display set to block');

		// Reset to default position if never moved
		if (!this.hasBeenMoved) {
			this.resetPosition();
		}
	}

	/**
	 * Hide the combat log
	 */
	hide() {
		this.container.style.display = 'none';
	}

	/**
	 * Reset to default center-bottom position
	 */
	resetPosition() {
		this.container.style.left = '50%';
		this.container.style.top = '';
		this.container.style.bottom = '20px';
		this.container.style.transform = 'translateX(-50%)';
		this.container.style.width = '600px';
		this.container.style.height = '375px';
		this.hasBeenMoved = false;
	}

	/**
	 * Clear the combat log and reset index
	 */
	clear() {
		this.logger.clearGameLog();
		this.content.innerHTML = '';
		this.lastProcessedIndex = 0;
	}

	/**
	 * Update the combat log with new entries (called in game loop)
	 */
	update() {
		const allLogs = this.logger.getGameLog();

		// Only process new entries since last update
		if (allLogs.length > this.lastProcessedIndex) {
			const newEntries = allLogs.slice(this.lastProcessedIndex);

			for (const entry of newEntries) {
				// Only show combat and info level logs
				if (entry.level === 'combat' || entry.level === 'info') {
					const formattedHTML = this.formatLogEntry(entry);
					this.content.innerHTML += formattedHTML;
				}
			}

			this.lastProcessedIndex = allLogs.length;

			// Trim old DOM entries if exceeding visible limit
			this.trimOldEntries();

			// Auto-scroll to bottom
			this.content.scrollTop = this.content.scrollHeight;
		}
	}

	/**
	 * Remove oldest DOM entries when exceeding COMBAT_LOG_VISIBLE limit
	 */
	trimOldEntries() {
		const maxVisible = GAME_CONSTANTS.COMBAT_LOG_VISIBLE;
		const entries = this.content.querySelectorAll('.log-entry');

		if (entries.length > maxVisible) {
			const removeCount = entries.length - maxVisible;
			for (let i = 0; i < removeCount; i++) {
				entries[i].remove();
			}
		}
	}

	/**
	 * Replace semantic tokens with formatted HTML
	 */
	replaceCombatTags(text) {
		for (const [token, html] of Object.entries(COMBAT_TAGS)) {
			text = text.replaceAll(token, html);
		}
		return text;
	}

	/**
	 * Replace wrapper tokens with formatted HTML
	 * Format: {{tag}}content{{/tag}} -> styled content
	 */
	replaceWrapperTags(text) {
		for (const [tag, formatter] of Object.entries(WRAPPER_TAGS)) {
			const openTag = `{{${tag}}}`;
			const closeTag = `{{/${tag}}}`;

			// Keep replacing while there are matching pairs
			while (text.includes(openTag)) {
				const startIdx = text.indexOf(openTag);
				const endIdx = text.indexOf(closeTag, startIdx);

				if (endIdx === -1) break; // No closing tag found

				const content = text.substring(startIdx + openTag.length, endIdx);
				const formatted = formatter(content);

				text = text.substring(0, startIdx) + formatted + text.substring(endIdx + closeTag.length);
			}
		}
		return text;
	}

	/**
	 * Replace character name tokens with colored names
	 * Format: {{char:CharacterName}} -> <span style="color: ...">CharacterName</span>
	 */
	replaceCharacterTokens(text) {
		const openToken = '{{char:';
		const closeToken = '}}';

		// Build a lookup map of character names to colors (do this once per log entry)
		const charColorMap = new Map();
		const characters = this.getAllCharacters();

		for (const char of characters) {
			let color = '#ffffff';
			if (char === this.game.state.pc) {
				color = '#2E7D32'; // Darker green for hero
			} else if (char.faction === 'pc') {
				color = FACTIONS.pc_ally.nameplateColor;
			} else if (char.faction === 'guard') {
				color = '#FF9800'; // Darker orange for guards
			} else {
				const faction = FACTIONS[char.faction];
				color = faction ? faction.nameplateColor : '#ffffff';
			}
			charColorMap.set(char.name, color);
		}

		// Replace all {{char:NAME}} tokens
		while (text.includes(openToken)) {
			const startIdx = text.indexOf(openToken);
			const endIdx = text.indexOf(closeToken, startIdx);

			if (endIdx === -1) break; // No closing token found

			const charName = text.substring(startIdx + openToken.length, endIdx);
			const color = charColorMap.get(charName) || '#ffffff';
			const formatted = `<span class="log-character" style="color: ${color};">${charName}</span>`;

			text = text.substring(0, startIdx) + formatted + text.substring(endIdx + closeToken.length);
		}

		return text;
	}

	/**
	 * Format a single log entry with color coding and styling
	 */
	formatLogEntry(entry) {
		let html = entry.message;

		// 1. Replace simple semantic tokens ({{critical}}, {{hit}}, etc.)
		html = this.replaceCombatTags(html);

		// 2. Replace wrapper tokens ({{buf}}...{{/buf}}, {{dmg}}...{{/dmg}}, etc.)
		html = this.replaceWrapperTags(html);

		// 3. Replace character name tokens ({{char:Name}})
		html = this.replaceCharacterTokens(html);

		// 4. Check if this is a turn separator
		const isSeparator = html.includes('===') || html.includes('---');
		const cssClass = isSeparator ? 'log-entry log-turn-separator' : 'log-entry';

		return `<div class="${cssClass}">${html}</div>`;
	}

	/**
	 * Get all characters (player + NPCs)
	 */
	getAllCharacters() {
		if (!this.game.state || !this.game.state.pc) {
			return [];
		}
		return [this.game.state.pc, ...this.game.state.npcs];
	}

}
