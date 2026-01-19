/**
 * CharacterCreation.js - Dynamic character creation UI
 * Manages state, calculations, and DOM updates for character-creation.html
 */

import {
	STATS, STAT_BONUSES, WEAPONS, ARMOR_TYPES, ATTACK_TYPES,
	calculateMaxHP, calculateHPBuffer, calculateCerebralPresence,
	calculateEngagedMax, calculateMoveSpeed, calculateActionSpeed,
	calculateDamage, calculateAttackRating, calculateDefenseRating,
	calculateCSA_R, calculateCSD_R, getEquipmentBonus, createDefaultSkills
} from './const.js';

class CharacterCreator {
	constructor() {
		// Character state
		this.character = {
			name: 'Hero',
			stats: {
				str: 3, int: 3,
				dex: 3, per: 3,
				con: 3, will: 3,
				beauty: 3, cha: 3,
				instinct: 3, wis: 3
			},
			skills: createDefaultSkills(),
			equipment: {
				mainHand: 'unarmed',
				offHand: null,
				armor: 'none'
			}
		};

		// Point pools
		this.statPointsTotal = 63; // 30 base (10 stats * 3) + 33 distributable
		this.statPointsUsed = 30; // 10 stats * 3 minimum
		this.skillPointsTotal = 15; // Starting skill points
		this.skillPointsUsed = 11; // 11 skills * 1 minimum

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
		this.bindEvents();
		this.bindFooterEvents();
		this.updateOffHandAvailability();
		this.updateAllDisplays();
	}

	cacheElements() {
		// Available points displays
		this.elements.statPoints = document.querySelector('[data-points="stats"]');
		this.elements.skillPoints = document.querySelector('[data-points="skills"]');

		// Character name
		this.elements.nameInput = document.querySelector('input[name="name"]');

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
			attackRating: document.querySelector('[data-derived="attackRating"]'),
			defenseRating: document.querySelector('[data-derived="defenseRating"]'),
			cerebralPresence: document.querySelector('[data-derived="cerebralPresence"]'),
			engageMax: document.querySelector('[data-derived="engageMax"]'),
			hpBuffer: document.querySelector('[data-derived="hpBuffer"]'),
			critAttack: document.querySelector('[data-derived="critAttack"]'),
			critDefense: document.querySelector('[data-derived="critDefense"]')
		};

		// Total values displays (center column - everything)
		this.elements.totals = {
			moveSpeed: document.querySelector('[data-total="moveSpeed"]'),
			actionSpeed: document.querySelector('[data-total="actionSpeed"]'),
			totalDamage: document.querySelector('[data-total="totalDamage"]'),
			attackRating: document.querySelector('[data-total="attackRating"]'),
			defenseRating: document.querySelector('[data-total="defenseRating"]'),
			critAttack: document.querySelector('[data-total="critAttack"]'),
			critDefense: document.querySelector('[data-total="critDefense"]')
		};

		// Equipment stats displays (right column)
		this.elements.equipment = {
			weaponDamage: document.querySelector('[data-equip="weaponDamage"]'),
			weaponType: document.querySelector('[data-equip="weaponType"]'),
			weaponSpeed: document.querySelector('[data-equip="weaponSpeed"]'),
			armorDR: document.querySelector('[data-equip="armorDR"]'),
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
	}

	// --- State Modification ---

	adjustStat(stat, delta) {
		const current = this.character.stats[stat];
		const newValue = current + delta;

		// Validate bounds
		if (newValue < STATS.MIN || newValue > STATS.MAX) return;

		// Validate points (increasing costs points, decreasing gives points back)
		const pointsAfter = this.statPointsUsed + delta;
		if (pointsAfter > this.statPointsTotal) return;

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

	calculateBaseAttackRating() {
		const { str, dex } = this.character.stats;
		return (str * 3) + (dex * 2);
	}

	calculateBaseDefenseRating() {
		const { dex, instinct } = this.character.stats;
		return (dex * 3) + (instinct * 2) + 5;
	}

	calculateBaseHitChance() {
		// vs average defender (defense 25)
		const baseAttack = this.calculateBaseAttackRating();
		return Math.max(0, Math.min(100, baseAttack - 25 + 50));
	}

	calculateBaseDodgeChance() {
		// vs average attacker (attack 20)
		const baseDefense = this.calculateBaseDefenseRating();
		return Math.max(0, Math.min(100, 100 - (20 - baseDefense + 50)));
	}

	calculateBaseCritChance() {
		const { str, int, dex, per, instinct } = this.character.stats;
		const csaBase = (int * 3) + (str * 2);
		const csdBase = (dex * 3) + (per * 2) + instinct;
		return Math.max(0, Math.min(100, (csaBase - csdBase) + 50));
	}

	calculateDamageMultiplier() {
		// STR multiplier for damage calculation
		return STAT_BONUSES.MULTIPLIER[this.character.stats.str];
	}

	// --- Calculations (Full - Center Column) ---

	calculateFullAttackRating() {
		return calculateAttackRating(this.character);
	}

	calculateFullDefenseRating() {
		return calculateDefenseRating(this.character);
	}

	calculateFullHitChance() {
		// vs average defender (defense 25, no evasion)
		const attackR = this.calculateFullAttackRating();
		return Math.max(0, Math.min(100, attackR - 25 + 50));
	}

	calculateFullDodgeChance() {
		// vs average attacker (attack 20), including our evasion
		const defenseR = this.calculateFullDefenseRating();
		const evasionBonus = getEquipmentBonus(this.character, 'evasionBonus');
		return Math.max(0, Math.min(100, 100 - (20 - defenseR + 50 - evasionBonus)));
	}

	// --- DOM Updates ---

	updateAllDisplays() {
		this.updatePointDisplays();
		this.updateStatDisplays();
		this.updateSkillDisplays();
		this.updateDerivedDisplays();
		this.updateTotalDisplays();
		this.updateEquipmentDisplays();
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
			if (valueEl) {
				valueEl.textContent = this.character.skills[skill];
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
		if (d.attackRating) {
			const attackRating = this.calculateBaseAttackRating();
			d.attackRating.textContent = attackRating;
			d.attackRating.value = attackRating;
			getLabel(d.attackRating).dataset.formula = `(Str(${stats.str}) × 3) + (Dex(${stats.dex}) × 2)`;
		}

		// Defense Rating (stats only)
		if (d.defenseRating) {
			const defenseRating = this.calculateBaseDefenseRating();
			d.defenseRating.textContent = defenseRating;
			d.defenseRating.value = defenseRating;
			getLabel(d.defenseRating).dataset.formula = `(Dex(${stats.dex}) × 3) + (Inst(${stats.instinct}) × 2) + 5`;
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
			getLabel(d.engageMax).dataset.formula = `CP(${cp}) / 6`;
		}

		// HP Buffer
		if (d.hpBuffer) {
			const buffer = calculateHPBuffer(stats);
			d.hpBuffer.textContent = buffer;
			d.hpBuffer.value = buffer;
			const willMult = STAT_BONUSES.MULTIPLIER[stats.will] ?? 1;
			getLabel(d.hpBuffer).dataset.formula = `Inst(${stats.instinct}) × Will mult(${willMult})`;
		}

		// Crit Attack (stats only)
		if (d.critAttack) {
			const critAttack = (stats.int * 3) + (stats.str * 2);
			d.critAttack.textContent = critAttack;
			d.critAttack.value = critAttack;
			getLabel(d.critAttack).dataset.formula = `(Int(${stats.int}) × 3) + (Str(${stats.str}) × 2)`;
		}

		// Crit Defense (stats only)
		if (d.critDefense) {
			const critDefense = (stats.dex * 3) + (stats.per * 2) + stats.instinct;
			d.critDefense.textContent = critDefense;
			d.critDefense.value = critDefense;
			getLabel(d.critDefense).dataset.formula = `(Dex(${stats.dex}) × 3) + (Per(${stats.per}) × 2) + Inst(${stats.instinct})`;
		}
	}

	updateTotalDisplays() {
		const t = this.elements.totals;
		const stats = this.character.stats;
		const weapon = WEAPONS[this.character.equipment.mainHand];
		const armor = ARMOR_TYPES[this.character.equipment.armor || 'none'];
		const offHand = this.character.equipment.offHand ? WEAPONS[this.character.equipment.offHand] : null;
		const hasShield = offHand && offHand.grip === 'off';

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
		if (t.attackRating) {
			const weaponSkill = this.character.skills[this.character.equipment.mainHand] || 1;
			const attackR = this.calculateFullAttackRating();
			t.attackRating.textContent = attackR;
			getLabel(t.attackRating).dataset.formula = `(${weapon.name} skill(${weaponSkill}) × 5) + (Str(${stats.str}) × 3) + (Dex(${stats.dex}) × 2)`;
		}

		// Defense Rating
		if (t.defenseRating) {
			const defSkill = hasShield ? this.character.skills.block : this.character.skills.dodge;
			const skillName = hasShield ? 'Block' : 'Dodge';
			const defenseBonus = getEquipmentBonus(this.character, 'defenseR');
			const defenseR = this.calculateFullDefenseRating();
			t.defenseRating.textContent = defenseR;
			const bonusPart = defenseBonus > 0 ? ` + equip(${defenseBonus})` : '';
			getLabel(t.defenseRating).dataset.formula = `(${skillName}(${defSkill}) × 5) + (Dex(${stats.dex}) × 3) + (Inst(${stats.instinct}) × 2) + 5${bonusPart}`;
		}

		// Crit Attack (full - with skill)
		if (t.critAttack) {
			const critAttack = calculateCSA_R(this.character);
			const critSkill = this.character.skills.criticalStrike || 1;
			t.critAttack.textContent = critAttack;
			getLabel(t.critAttack).dataset.formula = `(Crit Strike(${critSkill}) × 5) + (Int(${stats.int}) × 3) + (Str(${stats.str}) × 2)`;
		}

		// Crit Defense (full - with skill)
		if (t.critDefense) {
			const critDefense = calculateCSD_R(this.character);
			const critDefSkill = this.character.skills.criticalDefense || 1;
			t.critDefense.textContent = critDefense;
			getLabel(t.critDefense).dataset.formula = `(Crit Def(${critDefSkill}) × 5) + (Dex(${stats.dex}) × 3) + (Per(${stats.per}) × 2) + Inst(${stats.instinct})`;
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
			// Capitalize first letter
			const typeName = weapon.type.charAt(0).toUpperCase() + weapon.type.slice(1);
			e.weaponType.textContent = typeName;
			e.weaponType.value = weapon.type;
		}
		if (e.weaponSpeed && weapon) {
			e.weaponSpeed.textContent = weapon.speed;
			e.weaponSpeed.value = weapon.speed;
		}

		// Armor stats
		if (e.armorDR && armor) {
			e.armorDR.textContent = armor.defense;
			e.armorDR.value = armor.defense;
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

	// --- Footer Button Events ---

	bindFooterEvents() {
		document.getElementById('newCharacterBtn')?.addEventListener('click', () => this.resetCharacter());
		document.getElementById('loadTemplateBtn')?.addEventListener('click', () => this.loadTemplate());
		document.getElementById('saveTemplateBtn')?.addEventListener('click', () => this.saveTemplate());
	}

	// --- Template Management ---

	resetCharacter() {
		// Reset character state to defaults
		this.character = {
			name: 'Hero',
			stats: {
				str: 3, int: 3,
				dex: 3, per: 3,
				con: 3, will: 3,
				beauty: 3, cha: 3,
				instinct: 3, wis: 3
			},
			skills: createDefaultSkills(),
			equipment: {
				mainHand: 'unarmed',
				offHand: null,
				armor: 'none'
			}
		};

		// Reset point pools
		this.statPointsUsed = 30;
		this.skillPointsUsed = 11;

		// Update name input
		if (this.elements.nameInput) {
			this.elements.nameInput.value = 'Hero';
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

	saveTemplate() {
		const name = this.character.name.trim();
		if (!name) {
			alert('Please enter a character name before saving.');
			return;
		}

		const data = this.getCharacterData();
		const key = `charTemplate_${name}`;

		// Check if overwriting
		const existing = localStorage.getItem(key);
		if (existing) {
			// Silently overwrite as per requirements
		}

		localStorage.setItem(key, JSON.stringify(data));
		alert(`Template "${name}" saved!`);
	}

	loadTemplate() {
		// Get all saved templates
		const templates = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key.startsWith('charTemplate_')) {
				templates.push(key.replace('charTemplate_', ''));
			}
		}

		if (templates.length === 0) {
			alert('No saved templates found.');
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
		title.textContent = 'Load Template';
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

	selectTemplate(name) {
		const key = `charTemplate_${name}`;
		const data = localStorage.getItem(key);

		if (!data) {
			alert(`Template "${name}" not found.`);
			return;
		}

		const template = JSON.parse(data);
		this.loadCharacterData(template);
	}

	loadCharacterData(data) {
		// Load character state
		this.character.name = data.name || 'Hero';
		this.character.stats = { ...data.stats };
		this.character.skills = { ...data.skills };
		this.character.equipment = { ...data.equipment };

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
