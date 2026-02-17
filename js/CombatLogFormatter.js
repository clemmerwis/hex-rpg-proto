import { FACTIONS, GAME_CONSTANTS, ARMOR_TYPES, WEAPONS, COMBAT_TAGS, WRAPPER_TAGS } from "./const.js";

/**
 * CombatLogFormatter - Formats combat log entries with rich HTML
 * Handles all tag replacement (combat, wrapper, character, tooltip, armor, weapon)
 * and produces final HTML strings for display in the combat log UI.
 */
export class CombatLogFormatter {
	constructor(game) {
		this.game = game;
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
			if (char === this.game.pc) {
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
	 * Replace tooltip tokens with hoverable spans
	 * Format: {{tip:tooltip text}}visible content{{/tip}} -> <span data-tooltip="...">content</span>
	 * Must run before other tag replacements so inner tokens are still processed
	 */
	replaceTooltipTags(text) {
		const openPattern = '{{tip:';
		const closeTag = '{{/tip}}';

		while (text.includes(openPattern)) {
			const startIdx = text.indexOf(openPattern);
			const tooltipEndIdx = text.indexOf('}}', startIdx + openPattern.length);
			if (tooltipEndIdx === -1) break;

			const tooltipText = text.substring(startIdx + openPattern.length, tooltipEndIdx);
			const contentStartIdx = tooltipEndIdx + 2;
			const contentEndIdx = text.indexOf(closeTag, contentStartIdx);
			if (contentEndIdx === -1) break;

			const content = text.substring(contentStartIdx, contentEndIdx);
			const escaped = tooltipText.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
			const formatted = `<span data-tooltip="${escaped}">${content}</span>`;

			text = text.substring(0, startIdx) + formatted + text.substring(contentEndIdx + closeTag.length);
		}
		return text;
	}

	/**
	 * Replace armor tokens with hoverable armor name + styled tooltip
	 * Format: {{armor:key}} -> <span class="log-armor">Name<span class="armor-tooltip">...</span></span>
	 */
	replaceArmorTokens(text) {
		const pattern = '{{armor:';
		const closeToken = '}}';

		while (text.includes(pattern)) {
			const startIdx = text.indexOf(pattern);
			const endIdx = text.indexOf(closeToken, startIdx + pattern.length);
			if (endIdx === -1) break;

			const armorKey = text.substring(startIdx + pattern.length, endIdx);
			const armor = ARMOR_TYPES[armorKey];

			if (!armor) {
				text = text.substring(0, startIdx) + armorKey + text.substring(endIdx + closeToken.length);
				continue;
			}

			// Build tooltip lines
			let tooltipLines = [];
			if (armor.resistantAgainst.length > 0) {
				for (const type of armor.resistantAgainst) {
					tooltipLines.push(`<div class="armor-tip-resist">Resist: ${type}</div>`);
				}
			}
			if (armor.vulnerableAgainst.length > 0) {
				for (const type of armor.vulnerableAgainst) {
					tooltipLines.push(`<div class="armor-tip-vuln">Vuln: ${type}</div>`);
				}
			}

			const tooltipHTML = tooltipLines.length > 0
				? `<span class="armor-tooltip">${tooltipLines.join('')}</span>`
				: '';
			const formatted = `<span class="log-armor">${armor.name}${tooltipHTML}</span>`;

			text = text.substring(0, startIdx) + formatted + text.substring(endIdx + closeToken.length);
		}
		return text;
	}

	/**
	 * Replace weapon tokens with hoverable weapon name + styled tooltip
	 * Format: {{weapon:key}} -> <span class="log-weapon">short-sword<span class="weapon-tooltip">...</span></span>
	 */
	replaceWeaponTokens(text) {
		const pattern = '{{weapon:';
		const closeToken = '}}';

		while (text.includes(pattern)) {
			const startIdx = text.indexOf(pattern);
			const endIdx = text.indexOf(closeToken, startIdx + pattern.length);
			if (endIdx === -1) break;

			const weaponKey = text.substring(startIdx + pattern.length, endIdx);
			const weapon = WEAPONS[weaponKey];

			if (!weapon) {
				text = text.substring(0, startIdx) + weaponKey + text.substring(endIdx + closeToken.length);
				continue;
			}

			// Hyphenated lowercase display name: "shortSword" -> "short-sword"
			const displayName = weaponKey.replace(/([A-Z])/g, '-$1').toLowerCase();

			const tooltipHTML = `<span class="weapon-tooltip">Base: ${weapon.base} | Speed: ${weapon.speed}</span>`;
			const formatted = `<span class="log-weapon">${displayName}${tooltipHTML}</span>`;

			text = text.substring(0, startIdx) + formatted + text.substring(endIdx + closeToken.length);
		}
		return text;
	}

	/**
	 * Format a single log entry with color coding and styling
	 */
	formatLogEntry(entry) {
		// Row separator - thin line between character actions
		if (entry.message === '{{row_separator}}') {
			return '<div class="log-row-separator"></div>';
		}

		let html = entry.message;

		// 1. Replace tooltip tokens ({{tip:text}}content{{/tip}}) - must be first
		html = this.replaceTooltipTags(html);

		// 2. Replace armor tokens ({{armor:key}}) - before other tags so tooltip HTML isn't mangled
		html = this.replaceArmorTokens(html);

		// 3. Replace weapon tokens ({{weapon:key}}) - before other tags so tooltip HTML isn't mangled
		html = this.replaceWeaponTokens(html);

		// 4. Replace simple semantic tokens ({{critical}}, {{hit}}, etc.)
		html = this.replaceCombatTags(html);

		// 3. Replace wrapper tokens ({{buf}}...{{/buf}}, {{dmg}}...{{/dmg}}, etc.)
		html = this.replaceWrapperTags(html);

		// 4. Replace character name tokens ({{char:Name}})
		html = this.replaceCharacterTokens(html);

		// 5. Check if this is a turn separator
		const isSeparator = html.includes('===') || html.includes('---');
		const cssClass = isSeparator ? 'log-entry log-turn-separator' : 'log-entry';

		return `<div class="${cssClass}">${html}</div>`;
	}

	/**
	 * Get all characters (player + NPCs)
	 */
	getAllCharacters() {
		if (!this.game || !this.game.pc) {
			return [];
		}
		return [this.game.pc, ...this.game.npcs];
	}

}
