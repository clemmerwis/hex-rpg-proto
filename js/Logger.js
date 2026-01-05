/**
 * Centralized logging system for both development debugging and gameplay combat logs
 * Provides structured logging with levels, filtering, and dual output (console + in-game)
 */

export const LOG_LEVELS = {
	DEBUG: 'debug',      // Developer debugging only (verbose)
	INFO: 'info',        // General game events
	COMBAT: 'combat',    // Combat events (visible to player in UI)
	WARNING: 'warning',  // Problems, edge cases, friendly fire
	ERROR: 'error'       // Actual errors
};

export class Logger {
	constructor() {
		// Console output toggle (for development)
		this.consoleEnabled = true;

		// In-game log toggle (will be rendered in UI)
		this.gameLogEnabled = true;

		// Storage for in-game combat log entries
		this.gameLog = [];

		// Maximum entries to keep in gameLog (prevent memory bloat)
		this.maxGameLogEntries = 100;

		// Per-level console filtering (can disable specific levels)
		this.levelFilters = {
			[LOG_LEVELS.DEBUG]: true,
			[LOG_LEVELS.INFO]: true,
			[LOG_LEVELS.COMBAT]: true,
			[LOG_LEVELS.WARNING]: true,
			[LOG_LEVELS.ERROR]: true
		};
	}

	/**
	 * Core logging method - all logs flow through here
	 * @param {string} level - Log level from LOG_LEVELS
	 * @param {string} message - Primary log message
	 * @param {Object} data - Optional structured data (for debugging or UI display)
	 */
	log(level, message, data = {}) {
		const entry = {
			level,
			message,
			timestamp: Date.now(),
			...data
		};

		// Console output (with level filtering)
		if (this.consoleEnabled && this.levelFilters[level]) {
			const prefix = `[${level.toUpperCase()}]`;
			if (Object.keys(data).length > 0) {
				console.log(prefix, message, data);
			} else {
				console.log(prefix, message);
			}
		}

		// Add to in-game log if level should be visible to player
		if (this.gameLogEnabled && this.shouldShowInGame(level)) {
			this.gameLog.push(entry);

			// Trim old entries if exceeding max
			if (this.gameLog.length > this.maxGameLogEntries) {
				this.gameLog.shift();
			}
		}
	}

	/**
	 * Determine if a log level should appear in the in-game UI
	 * Players see COMBAT and INFO, devs see everything in console
	 */
	shouldShowInGame(level) {
		return level === LOG_LEVELS.COMBAT || level === LOG_LEVELS.INFO;
	}

	// Convenience methods for each log level
	debug(message, data) {
		this.log(LOG_LEVELS.DEBUG, message, data);
	}

	info(message, data) {
		this.log(LOG_LEVELS.INFO, message, data);
	}

	combat(message, data) {
		this.log(LOG_LEVELS.COMBAT, message, data);
	}

	warn(message, data) {
		this.log(LOG_LEVELS.WARNING, message, data);
	}

	error(message, data) {
		this.log(LOG_LEVELS.ERROR, message, data);
	}

	/**
	 * Get all in-game log entries (for UI rendering)
	 * Returns a copy to prevent external mutation
	 */
	getGameLog() {
		return [...this.gameLog];
	}

	/**
	 * Clear the in-game combat log (e.g., when combat ends or area changes)
	 */
	clearGameLog() {
		this.gameLog = [];
	}

	/**
	 * Toggle console output on/off
	 */
	setConsoleEnabled(enabled) {
		this.consoleEnabled = enabled;
	}

	/**
	 * Toggle specific log level on/off in console
	 */
	setLevelFilter(level, enabled) {
		if (this.levelFilters.hasOwnProperty(level)) {
			this.levelFilters[level] = enabled;
		}
	}

	/**
	 * Toggle in-game log collection on/off
	 */
	setGameLogEnabled(enabled) {
		this.gameLogEnabled = enabled;
	}
}
