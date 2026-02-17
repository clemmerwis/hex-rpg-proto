import { GAME_CONSTANTS } from "./const.js";

/**
 * Combat UI Log - Draggable, resizable combat log panel
 * Manages DOM display, drag/resize, and incremental log updates.
 * Delegates all text formatting to CombatLogFormatter.
 */
export class CombatUILog {
	constructor(logger, formatter) {
		this.logger = logger;
		this.formatter = formatter;

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
		this.lastWasSeparator = false;

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
		if (!this.container) {
			console.error('[CombatUILog] Cannot show - container is null');
			return;
		}
		this.container.style.display = 'block';

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
		this.lastWasSeparator = false;
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
					// Skip consecutive separators
					if (entry.message === '{{row_separator}}' && this.lastWasSeparator) continue;
					this.lastWasSeparator = entry.message === '{{row_separator}}';

					const formattedHTML = this.formatter.formatLogEntry(entry);
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

}
