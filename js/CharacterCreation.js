/**
 * CharacterCreation.js - Dynamic character creation UI
 * Manages state, calculations, and DOM updates for character-creation.html
 */

import {
	STATS, STAT_BONUSES, WEAPONS, ARMOR_TYPES, ATTACK_TYPES, COMBAT_MODIFIERS,
	calculateMaxHP, calculateHPBuffer, calculateCerebralPresence,
	calculateEngagedMax, calculateMoveSpeed, calculateActionSpeed,
	calculateDamage, calculateAttkR, calculateDefR,
	calculateCritAttkR, calculateCritDefR, getEquipmentBonus, getWeaponSynergy,
	createDefaultSkills, createDefaultStats
} from './const.js';
import { CharacterStore } from './CharacterStore.js';

class CharacterCreator {
	constructor() {
		// Character state
		this.character = {
			name: 'Hero',
			stats: createDefaultStats(),
			skills: createDefaultSkills(),
			equipment: {
				mainHand: 'unarmed',
				offHand: null,
				armor: 'none'
			}
		};

		// Point pools
		this.statPointsTotal = STATS.TOTAL_POINTS; // 36 base (12 stats * 3) + 33 distributable
		this.statPointsUsed = STATS.all.length * STATS.MIN; // 12 stats * 3 minimum
		this.skillPointsTotal = 15; // Starting skill points
		this.skillPointsUsed = 11; // 11 skills * 1 minimum

		// Slug of the build file currently loaded (null = unsaved//defaults only)
		this.activeSavedBuild = null;

		// Cache DOM elements
		this.elements = {};

		// Initialize when DOM is ready
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', () => this.init());
		} else {
			this.init();
		}
	}

	init() {
		this.cacheElements();
		this.renderFormulaCaptions();
		this.bindEvents();
		this.bindFooterEvents();
		this.updateOffHandAvailability();
		this.updateAllDisplays();
		this.autoLoadTemplate();
	}

	/**
	 * Fill the section formula captions from COMBAT_MODIFIERS so the baselines
	 * live in exactly one place. The CSC caption sat stale at "+ 50" after
	 * CRIT_BASE moved to 25 because the markup carried its own copy; rendering
	 * from the constant makes that class of drift impossible. The markup text
	 * is only a no-JS fallback. (Attribute is data-formula-const, NOT
	 * data-formula - that one is the hover-tooltip mechanism.)
	 */
	renderFormulaCaptions() {
		const captions = {
			// Stats-only column: no equipment or situation, so no mod buckets
			'thc-base': `THC = Atk - Def + ${COMBAT_MODIFIERS.THC_BASE}`,
			// The live formula from CombatSystem.resolveHitRoll(): atkMods =
			// attacker-side bonuses (flanking), defMods = defender-side
			// (equipment evasion)
			'thc': `THC = (Atk + AtkMods) - (Def + DefMods) + ${COMBAT_MODIFIERS.THC_BASE}`,
			'csc': `CSC = CritAtk - CritDef + ${COMBAT_MODIFIERS.CRIT_BASE}`,
		};
		for (const [key, text] of Object.entries(captions)) {
			document.querySelectorAll(`[data-formula-const="${key}"]`)
				.forEach(el => { el.textContent = text; });
		}
	}

	cacheElements() {
		// Available points displays
		this.elements.statPoints = document.querySelector('[data-points="stats"]');
		this.elements.skillPoints = document.querySelector('[data-points="skills"]');

		// Character name
		this.elements.nameInput = document.querySelector('input[name="name"]');

		// Saved-build indicator
		this.elements.savedBuildIndicator = document.getElementById('savedBuildIndicator');
		this.elements.savedBuildName = document.querySelector('[data-saved-build-name]');

		// Stat rows
		this.elements.statRows = document.querySelectorAll('[data-stat]');

		// Skill rows
		this.elements.skillRows = document.querySelectorAll('[data-skill]');

		// Equipment radios
		this.elements.mainHandRadios = document.querySelectorAll('input[name="mainHand"]');
		this.elements.offHandRadios = document.querySelectorAll('input[name="offHand"]');
		this.elements.armorRadios = document.querySelectorAll('input[name="armor"]');

		// Derived stat displays (left column - stats only)
		this.elements.derived = {
			maxHP: document.querySelector('[data-derived="maxHP"]'),
			damageBonus: document.querySelector('[data-derived="damageBonus"]'),
			attkR: document.querySelector('[data-derived="attkR"]'),
			defR: document.querySelector('[data-derived="defR"]'),
			cerebralPresence: document.querySelector('[data-derived="cerebralPresence"]'),
			engageMax: document.querySelector('[data-derived="engageMax"]'),
			hpBuffer: document.querySelector('[data-derived="hpBuffer"]'),
			critAttkR: document.querySelector('[data-derived="critAttkR"]'),
			critDefR: document.querySelector('[data-derived="critDefR"]')
		};

		// Total values displays (center column - everything)
		this.elements.totals = {
			moveSpeed: document.querySelector('[data-total="moveSpeed"]'),
			actionSpeed: document.querySelector('[data-total="actionSpeed"]'),
			totalDamage: document.querySelector('[data-total="totalDamage"]'),
			attkR: document.querySelector('[data-total="attkR"]'),
			defRBlock: document.querySelector('[data-total="defRBlock"]'),
			defRDodge: document.querySelector('[data-total="defRDodge"]'),
			critAttkR: document.querySelector('[data-total="critAttkR"]'),
			critDefR: document.querySelector('[data-total="critDefR"]')
		};

		// Equipment stats displays (right column)
		this.elements.equipment = {
			weaponDamage: document.querySelector('[data-equip="weaponDamage"]'),
			weaponType: document.querySelector('[data-equip="weaponType"]'),
			weaponSpeed: document.querySelector('[data-equip="weaponSpeed"]'),
			armorADR: document.querySelector('[data-equip="armorADR"]'),
			armorMobility: document.querySelector('[data-equip="armorMobility"]'),
			flankDefense: document.querySelector('[data-equip="flankDefense"]'),
			evasionBonus: document.querySelector('[data-equip="evasionBonus"]')
		};
	}

	bindEvents() {
		// Stat buttons - use event delegation
		this.elements.statRows.forEach(row => {
			const stat = row.dataset.stat;
			const buttons = row.querySelectorAll('button');
			buttons[0]?.addEventListener('click', () => this.adjustStat(stat, -1));
			buttons[1]?.addEventListener('click', () => this.adjustStat(stat, 1));
		});

		// Skill buttons - use event delegation
		this.elements.skillRows.forEach(row => {
			const skill = row.dataset.skill;
			const buttons = row.querySelectorAll('button');
			buttons[0]?.addEventListener('click', () => this.adjustSkill(skill, -1));
			buttons[1]?.addEventListener('click', () => this.adjustSkill(skill, 1));
		});

		// Equipment radios
		this.elements.mainHandRadios.forEach(radio => {
			radio.addEventListener('change', () => this.setMainHand(radio.value));
		});
		this.elements.offHandRadios.forEach(radio => {
			radio.addEventListener('change', () => this.setOffHand(radio.value));
		});
		this.elements.armorRadios.forEach(radio => {
			radio.addEventListener('change', () => this.setArmor(radio.value));
		});

		// Name input
		this.elements.nameInput?.addEventListener('input', (e) => {
			this.character.name = e.target.value;
		});

		// Cycle template button
		document.getElementById('cycleTemplateBtn')?.addEventListener('click', () => this.cycleTemplate());
	}

	// --- State Modification ---

	adjustStat(stat, delta) {
		const current = this.character.stats[stat];
		const newValue = current + delta;

		// Validate bounds
		if (newValue < STATS.MIN || newValue > STATS.MAX) return;

		// Validate points (increasing costs points, decreasing gives points back)
		// Only guard increases: if a character is somehow over the pool, blocking
		// decrements too would freeze the sheet with no way back under the cap
		const pointsAfter = this.statPointsUsed + delta;
		if (delta > 0 && pointsAfter > this.statPointsTotal) return;

		// Apply change
		this.character.stats[stat] = newValue;
		this.statPointsUsed = pointsAfter;

		this.updateAllDisplays();
	}

	adjustSkill(skill, delta) {
		const current = this.character.skills[skill];
		const newValue = current + delta;

		// Validate bounds (skills: 1-10)
		if (newValue < 1 || newValue > 10) return;

		// Validate points
		const pointsAfter = this.skillPointsUsed + delta;
		if (pointsAfter > this.skillPointsTotal) return;

		// Apply change
		this.character.skills[skill] = newValue;
		this.skillPointsUsed = pointsAfter;

		this.updateAllDisplays();
	}

	setMainHand(weaponKey) {
		this.character.equipment.mainHand = weaponKey;

		// Handle two-handed weapons - clear offHand
		const weapon = WEAPONS[weaponKey];
		if (weapon?.grip === 'two') {
			this.character.equipment.offHand = null;
			// Update radio to reflect this
			const noneRadio = document.querySelector('input[name="offHand"][value="none"]');
			if (noneRadio) noneRadio.checked = true;
		}

		this.updateOffHandAvailability();
		this.updateAllDisplays();
	}

	setOffHand(value) {
		this.character.equipment.offHand = value === 'none' ? null : value;
		this.updateAllDisplays();
	}

	setArmor(armorKey) {
		this.character.equipment.armor = armorKey;
		this.updateAllDisplays();
	}

	updateOffHandAvailability() {
		const weapon = WEAPONS[this.character.equipment.mainHand];
		const isTwoHanded = weapon?.grip === 'two';

		// Disable/enable offHand radios based on main hand grip
		this.elements.offHandRadios.forEach(radio => {
			if (radio.value === 'none') {
				radio.disabled = false;
			} else {
				radio.disabled = isTwoHanded;
			}
		});
	}

	// --- Calculations (Stats Only - Left Column) ---

	calculateBaseAttkR() {
		const { str, dex } = this.character.stats;
		return (str * 3) + (dex * 2);
	}

	calculateBaseDefR() {
		const { dex, instinct } = this.character.stats;
		return (dex * 3) + (instinct * 2) + 5;
	}

	calculateDamageMultiplier() {
		// STR multiplier for damage calculation
		return STAT_BONUSES.MULTIPLIER[this.character.stats.str];
	}

	// --- Calculations (Full - Center Column) ---

	calculateFullAttkR() {
		return calculateAttkR(this.character);
	}

	// --- DOM Updates ---

	updateAllDisplays() {
		this.updatePointDisplays();
		this.updateStatDisplays();
		this.updateSkillDisplays();
		this.updateDerivedDisplays();
		this.updateTotalDisplays();
		this.updateEquipmentDisplays();
		this.updateSavedBuildIndicator();
	}

	updateSavedBuildIndicator() {
		const indicator = this.elements.savedBuildIndicator;
		if (!indicator) return;

		if (this.activeSavedBuild) {
			if (this.elements.savedBuildName) {
				this.elements.savedBuildName.textContent = `characters/${this.activeSavedBuild}.json`;
			}
			indicator.hidden = false;
		} else {
			indicator.hidden = true;
		}
	}

	updatePointDisplays() {
		const availableStats = this.statPointsTotal - this.statPointsUsed;
		const availableSkills = this.skillPointsTotal - this.skillPointsUsed;

		if (this.elements.statPoints) {
			this.elements.statPoints.textContent = availableStats;
		}
		if (this.elements.skillPoints) {
			this.elements.skillPoints.textContent = availableSkills;
		}
	}

	updateStatDisplays() {
		this.elements.statRows.forEach(row => {
			const stat = row.dataset.stat;
			const valueEl = row.querySelector('.value');
			if (valueEl) {
				valueEl.textContent = this.character.stats[stat];
			}
		});
	}

	updateSkillDisplays() {
		this.elements.skillRows.forEach(row => {
			const skill = row.dataset.skill;
			const valueEl = row.querySelector('.value');
			const labelEl = row.querySelector('label');
			if (valueEl) {
				valueEl.textContent = this.character.skills[skill];
			}
			if (labelEl) {
				// Store original label text on first call
				if (!labelEl.dataset.baseLabel) {
					labelEl.dataset.baseLabel = labelEl.textContent;
				}
				const synergy = getWeaponSynergy(this.character, skill);
				if (synergy > 0) {
					labelEl.innerHTML = `${labelEl.dataset.baseLabel} <span class="value" style="font-size:inherit">(+${synergy})</span>`;
				} else {
					labelEl.textContent = labelEl.dataset.baseLabel;
				}
			}
		});
	}

	updateDerivedDisplays() {
		const d = this.elements.derived;
		const stats = this.character.stats;

		// Helper to get the label element (previous sibling span)
		const getLabel = (el) => el?.previousElementSibling;

		// Max HP
		if (d.maxHP) {
			const conBonus = STAT_BONUSES.CON_BONUS[stats.con] ?? 0;
			const strMult = STAT_BONUSES.MULTIPLIER[stats.str] ?? 1;
			const maxHP = calculateMaxHP(stats);
			d.maxHP.textContent = maxHP;
			d.maxHP.value = maxHP;
			getLabel(d.maxHP).dataset.formula = `(base(15) + Con bonus(${conBonus})) × Str mult(${strMult})`;
		}

		// Damage Multiplier
		if (d.damageBonus) {
			const mult = this.calculateDamageMultiplier();
			d.damageBonus.textContent = mult + 'x';
			d.damageBonus.value = mult;
			getLabel(d.damageBonus).dataset.formula = `Str(${stats.str}) → ${mult}x`;
		}

		// Attack Rating (stats only)
		if (d.attkR) {
			const attkR = this.calculateBaseAttkR();
			d.attkR.textContent = attkR;
			d.attkR.value = attkR;
			getLabel(d.attkR).dataset.formula = `(Str(${stats.str}) × 3) + (Dex(${stats.dex}) × 2)`;
		}

		// Defense Rating (stats only)
		if (d.defR) {
			const defR = this.calculateBaseDefR();
			d.defR.textContent = defR;
			d.defR.value = defR;
			getLabel(d.defR).dataset.formula = `(Dex(${stats.dex}) × 3) + (Inst(${stats.instinct}) × 2) + 5`;
		}

		// Cerebral Presence
		if (d.cerebralPresence) {
			const cp = calculateCerebralPresence(stats);
			d.cerebralPresence.textContent = cp;
			d.cerebralPresence.value = cp;
			getLabel(d.cerebralPresence).dataset.formula = `Per(${stats.per}) + Wis(${stats.wis}) + Int(${stats.int})`;
		}

		// Engage Max
		if (d.engageMax) {
			const cp = calculateCerebralPresence(stats);
			const engageMax = calculateEngagedMax(stats);
			d.engageMax.textContent = engageMax;
			d.engageMax.value = engageMax;
			getLabel(d.engageMax).dataset.formula = `Cerebral Presence(${cp}) / 6`;
		}

		// HP Buffer
		if (d.hpBuffer) {
			const buffer = calculateHPBuffer(stats);
			d.hpBuffer.textContent = buffer;
			d.hpBuffer.value = buffer;
			const willMult = STAT_BONUSES.MULTIPLIER[stats.will] ?? 1;
			getLabel(d.hpBuffer).dataset.formula = `Inst(${stats.instinct}) × Will Multiplier(${willMult})`;
		}

		// Crit Attack (stats only)
		if (d.critAttkR) {
			const critAttkR = (stats.int * 3) + (stats.str * 2);
			d.critAttkR.textContent = critAttkR;
			d.critAttkR.value = critAttkR;
			getLabel(d.critAttkR).dataset.formula = `(Int(${stats.int}) × 3) + (Str(${stats.str}) × 2)`;
		}

		// Crit Defense (stats only)
		if (d.critDefR) {
			const critDefR = (stats.dex * 3) + (stats.per * 2) + stats.instinct;
			d.critDefR.textContent = critDefR;
			d.critDefR.value = critDefR;
			getLabel(d.critDefR).dataset.formula = `(Dex(${stats.dex}) × 3) + (Per(${stats.per}) × 2) + Inst(${stats.instinct})`;
		}
	}

	updateTotalDisplays() {
		const t = this.elements.totals;
		const stats = this.character.stats;
		const weapon = WEAPONS[this.character.equipment.mainHand];
		const armor = ARMOR_TYPES[this.character.equipment.armor || 'none'];
		const offHand = this.character.equipment.offHand ? WEAPONS[this.character.equipment.offHand] : null;
		const hasShield = !!(offHand && offHand.grip === 'off');

		// Helper to get the label element (previous sibling)
		const getLabel = (el) => el?.previousElementSibling;

		// Move Speed
		if (t.moveSpeed) {
			const moveSpeed = calculateMoveSpeed(this.character);
			t.moveSpeed.textContent = moveSpeed;
			getLabel(t.moveSpeed).dataset.formula = `${armor.name} mobility(${armor.mobility}) - Str(${stats.str})`;
		}

		// Action Speed (using light attack as default display)
		if (t.actionSpeed) {
			const actionSpeed = calculateActionSpeed(this.character, 'light');
			t.actionSpeed.textContent = actionSpeed;
			const shieldSpeed = hasShield ? offHand.speed : 0;
			const shieldPart = hasShield ? ` + shield(${shieldSpeed})` : '';
			getLabel(t.actionSpeed).dataset.formula = `${weapon.name} speed(${weapon.speed})${shieldPart} + light Attack(12) - Dex(${stats.dex})`;
		}

		// Total Damage (using light attack)
		if (t.totalDamage) {
			const damage = calculateDamage(stats, this.character.equipment.mainHand, 'light');
			t.totalDamage.textContent = damage;
			const strMult = STAT_BONUSES.MULTIPLIER[stats.str] ?? 1;
			getLabel(t.totalDamage).dataset.formula = `${weapon.name} base(${weapon.base}) + (force(${weapon.force}) × Str mult(${strMult}))`;
		}

		// Attack Rating
		if (t.attkR) {
			const weaponKey = this.character.equipment.mainHand;
			const weaponSkill = this.character.skills[weaponKey] || 1;
			const synergy = getWeaponSynergy(this.character, weaponKey);
			const attkR = this.calculateFullAttkR();
			t.attkR.textContent = attkR;
			const synergyPart = synergy > 0 ? ` + synergy(${synergy})` : '';
			getLabel(t.attkR).dataset.formula = `(${weapon.name} skill(${weaponSkill})${synergyPart} × 5) + (Str(${stats.str}) × 3) + (Dex(${stats.dex}) × 2)`;
		}

		// Defense Rating - both sides of the shield trade-off, block vs dodge.
		// The row the current off-hand actually uses stays lit; the other dims.
		const blockBonus = getEquipmentBonus(this.character, 'defR');
		const dodgeBonus = blockBonus - (offHand?.passives?.defR || 0);
		const renderDefR = (el, mode, skill, skillName, equipBonus) => {
			if (!el) return;
			el.textContent = calculateDefR(this.character, mode);
			const bonusPart = equipBonus > 0 ? ` + equip(${equipBonus})` : '';
			getLabel(el).dataset.formula = `(${skillName}(${skill}) × 5) + (Dex(${stats.dex}) × 3) + (Inst(${stats.instinct}) × 2) + 5${bonusPart}`;
			el.parentElement.toggleAttribute('data-inactive', hasShield !== (mode === 'block'));
		};
		renderDefR(t.defRBlock, 'block', this.character.skills.block, 'Block', blockBonus);
		renderDefR(t.defRDodge, 'dodge', this.character.skills.dodge, 'Dodge', dodgeBonus);

		// Crit Attack (full - with skill)
		if (t.critAttkR) {
			const critAttkR = calculateCritAttkR(this.character);
			const critSkill = this.character.skills.criticalStrike || 1;
			t.critAttkR.textContent = critAttkR;
			getLabel(t.critAttkR).dataset.formula = `(Crit Strike(${critSkill}) × 5) + (Int(${stats.int}) × 3) + (Str(${stats.str}) × 2)`;
		}

		// Crit Defense (full - with skill)
		if (t.critDefR) {
			const critDefR = calculateCritDefR(this.character);
			const critDefSkill = this.character.skills.criticalDefense || 1;
			t.critDefR.textContent = critDefR;
			getLabel(t.critDefR).dataset.formula = `(Crit Def(${critDefSkill}) × 5) + (Dex(${stats.dex}) × 3) + (Per(${stats.per}) × 2) + Inst(${stats.instinct})`;
		}
	}

	updateEquipmentDisplays() {
		const e = this.elements.equipment;
		const weapon = WEAPONS[this.character.equipment.mainHand];
		const armor = ARMOR_TYPES[this.character.equipment.armor || 'none'];

		// Weapon stats
		if (e.weaponDamage && weapon) {
			e.weaponDamage.textContent = weapon.base;
			e.weaponDamage.value = weapon.base;
		}
		if (e.weaponType && weapon) {
			const weaponKey = this.character.equipment.mainHand;
			const typeCapitalized = weapon.type.charAt(0).toUpperCase() + weapon.type.slice(1);
			let typeName;
			if (weaponKey === 'unarmed') {
				typeName = 'Concussive';
			} else {
				const sizePrefix = weaponKey.startsWith('short') ? 'Short' : weaponKey.startsWith('long') ? 'Long' : '';
				typeName = sizePrefix ? `${sizePrefix} ${typeCapitalized}` : typeCapitalized;
			}
			e.weaponType.textContent = typeName;
			e.weaponType.value = weapon.type;
		}
		if (e.weaponSpeed && weapon) {
			e.weaponSpeed.textContent = weapon.speed;
			e.weaponSpeed.value = weapon.speed;
		}

		// Armor stats
		if (e.armorADR && armor) {
			e.armorADR.textContent = armor.adr;
			e.armorADR.value = armor.adr;
		}
		if (e.armorMobility && armor) {
			e.armorMobility.textContent = armor.mobility;
			e.armorMobility.value = armor.mobility;
		}
		if (e.flankDefense && armor) {
			// Display "none" for 1.0 (no penalty), otherwise show percentage
			const flankDef = armor.flankingDefense;
			if (flankDef === 1.0) {
				e.flankDefense.textContent = 'none';
			} else if (flankDef === 0) {
				e.flankDefense.textContent = '0%';
			} else {
				e.flankDefense.textContent = Math.round(flankDef * 100) + '%';
			}
			e.flankDefense.value = flankDef;
		}

		// Passive bonuses - aggregate from all equipment
		if (e.evasionBonus) {
			const evasion = getEquipmentBonus(this.character, 'evasionBonus');
			if (evasion > 0) {
				e.evasionBonus.textContent = '+' + evasion;
			} else {
				e.evasionBonus.textContent = '0';
			}
			e.evasionBonus.value = evasion;
		}
	}

	// --- Template Auto-load & Cycling ---

	async autoLoadTemplate() {
		const build = await CharacterStore.fetchBuild('hero');
		if (build) {
			this.loadCharacterData(build, 'hero');
		}
	}

	/** Slugs of every build file, sorted */
	async getSavedTemplateNames() {
		return CharacterStore.list();
	}

	async cycleTemplate() {
		const slugs = await this.getSavedTemplateNames();
		if (slugs.length === 0) return;

		const currentIdx = slugs.indexOf(this.activeSavedBuild);
		const nextIdx = (currentIdx + 1) % slugs.length;
		this.selectTemplate(slugs[nextIdx]);
	}

	// --- Footer Button Events ---

	bindFooterEvents() {
		document.getElementById('newCharacterBtn')?.addEventListener('click', () => this.resetCharacter());
		document.getElementById('loadTemplateBtn')?.addEventListener('click', () => this.loadTemplate());
		document.getElementById('saveTemplateBtn')?.addEventListener('click', () => this.saveTemplate());
		document.getElementById('clearSavedBuildBtn')?.addEventListener('click', () => this.clearSavedBuild());
	}

	/**
	 * Delete the active build file so the game falls back to NPC_TEMPLATES.
	 * Only touches the one build currently loaded - never the whole store.
	 */
	async clearSavedBuild() {
		const slug = this.activeSavedBuild;
		if (!slug) return;

		if (!confirm(`Delete characters/${slug}.json?\n\nThe game will fall back to the NPC_TEMPLATES entry in const.js.`)) return;

		const ok = await CharacterStore.remove(this.character.name);
		if (!ok) {
			alert(`Failed to delete characters/${slug}.json - see the console.`);
			return;
		}

		this.resetCharacter();
	}

	// --- Template Management ---

	resetCharacter() {
		// Reset character state to defaults.
		// Name is deliberately blank: defaulting to 'Hero' meant New Character
		// followed by Save silently overwrote characters/hero.json with an
		// all-3s sheet. Save refuses an empty name, so this forces a rename.
		this.character = {
			name: '',
			stats: createDefaultStats(),
			skills: createDefaultSkills(),
			equipment: {
				mainHand: 'unarmed',
				offHand: null,
				armor: 'none'
			}
		};

		// Reset point pools
		this.statPointsUsed = STATS.all.length * STATS.MIN;
		this.skillPointsUsed = 11;

		// No longer editing a saved build
		this.activeSavedBuild = null;

		// Update name input
		if (this.elements.nameInput) {
			this.elements.nameInput.value = '';
			this.elements.nameInput.focus();
		}

		// Reset equipment radios
		const unarmedRadio = document.querySelector('input[name="mainHand"][value="unarmed"]');
		if (unarmedRadio) unarmedRadio.checked = true;

		const offHandNone = document.querySelector('input[name="offHand"][value="none"]');
		if (offHandNone) offHandNone.checked = true;

		const armorNone = document.querySelector('input[name="armor"][value="none"]');
		if (armorNone) armorNone.checked = true;

		// Update displays
		this.updateOffHandAvailability();
		this.updateAllDisplays();
	}

	async saveTemplate() {
		const name = this.character.name.trim();
		if (!name) {
			alert('Please enter a character name before saving.');
			return;
		}

		const ok = await CharacterStore.save(this.getCharacterData());
		if (!ok) {
			alert(`Failed to save "${name}".\n\nIs the dev container running with nginx-dev.conf mounted?\nSee the console for details.`);
			return;
		}

		this.activeSavedBuild = CharacterStore.slug(name);
		this.updateSavedBuildIndicator();

		alert(`Saved to characters/${CharacterStore.slug(name)}.json`);
	}

	async loadTemplate() {
		const templates = await this.getSavedTemplateNames();

		if (templates.length === 0) {
			alert('No character builds found in characters/.');
			return;
		}

		this.showTemplateModal(templates);
	}

	showTemplateModal(templates) {
		// Create modal overlay
		const overlay = document.createElement('div');
		overlay.id = 'templateModal';
		overlay.style.cssText = `
			position: fixed; top: 0; left: 0; right: 0; bottom: 0;
			background: rgba(0, 0, 0, 0.7);
			display: flex; align-items: center; justify-content: center;
			z-index: 1000;
		`;

		// Create modal content
		const modal = document.createElement('div');
		modal.style.cssText = `
			background: #0d1117; border: 1px solid #21505c;
			padding: 20px; min-width: 250px; max-width: 400px;
		`;

		// Title
		const title = document.createElement('h3');
		title.textContent = 'Load Character Build';
		title.style.cssText = `
			color: #58a6b1; margin: 0 0 15px 0;
			font-size: 14px; text-transform: uppercase; letter-spacing: 1px;
		`;
		modal.appendChild(title);

		// Template list
		const list = document.createElement('div');
		list.style.cssText = `
			max-height: 300px; overflow-y: auto;
		`;

		templates.forEach(name => {
			const item = document.createElement('div');
			item.textContent = name;
			item.style.cssText = `
				padding: 10px 12px; cursor: pointer;
				color: #c9d1d9; border-bottom: 1px solid #21505c;
			`;
			item.addEventListener('mouseenter', () => {
				item.style.background = '#161b22';
				item.style.color = '#7ee8fa';
			});
			item.addEventListener('mouseleave', () => {
				item.style.background = 'transparent';
				item.style.color = '#c9d1d9';
			});
			item.addEventListener('click', () => {
				this.selectTemplate(name);
				overlay.remove();
			});
			list.appendChild(item);
		});
		modal.appendChild(list);

		// Cancel button
		const cancelBtn = document.createElement('button');
		cancelBtn.textContent = 'Cancel';
		cancelBtn.style.cssText = `
			margin-top: 15px; padding: 8px 16px;
			background: #161b22; border: 1px solid #21505c;
			color: #c9d1d9; cursor: pointer; width: 100%;
		`;
		cancelBtn.addEventListener('click', () => overlay.remove());
		modal.appendChild(cancelBtn);

		overlay.appendChild(modal);

		// Close on overlay click
		overlay.addEventListener('click', (e) => {
			if (e.target === overlay) overlay.remove();
		});

		document.body.appendChild(overlay);
	}

	async selectTemplate(slug) {
		const build = await CharacterStore.fetchBuild(slug);

		if (!build) {
			alert(`Build "${slug}" could not be loaded.`);
			return;
		}

		this.loadCharacterData(build, slug);
	}

	loadCharacterData(data, savedBuildName = null) {
		// Load character state
		// Merge over defaults rather than replacing: a build saved before a stat
		// existed has no value for it, and a missing stat renders blank and makes
		// adjustStat() produce NaN. Defaults guarantee every stat is present.
		this.character.name = data.name || 'Hero';
		this.character.stats = { ...createDefaultStats(), ...data.stats };
		this.character.skills = { ...createDefaultSkills(), ...data.skills };
		this.character.equipment = { ...data.equipment };

		this.activeSavedBuild = savedBuildName;

		// Recalculate point usage
		this.statPointsUsed = Object.values(this.character.stats).reduce((sum, val) => sum + val, 0);
		this.skillPointsUsed = Object.values(this.character.skills).reduce((sum, val) => sum + val, 0);

		// Update name input
		if (this.elements.nameInput) {
			this.elements.nameInput.value = this.character.name;
		}

		// Update equipment radios
		const mainHandRadio = document.querySelector(`input[name="mainHand"][value="${this.character.equipment.mainHand}"]`);
		if (mainHandRadio) mainHandRadio.checked = true;

		const offHandValue = this.character.equipment.offHand || 'none';
		const offHandRadio = document.querySelector(`input[name="offHand"][value="${offHandValue}"]`);
		if (offHandRadio) offHandRadio.checked = true;

		const armorRadio = document.querySelector(`input[name="armor"][value="${this.character.equipment.armor}"]`);
		if (armorRadio) armorRadio.checked = true;

		// Update displays
		this.updateOffHandAvailability();
		this.updateAllDisplays();
	}

	// --- Export character data ---

	getCharacterData() {
		return {
			name: this.character.name,
			stats: { ...this.character.stats },
			skills: { ...this.character.skills },
			equipment: { ...this.character.equipment }
		};
	}
}

// Initialize and expose globally for debugging
const creator = new CharacterCreator();
window.characterCreator = creator;

export default creator;
