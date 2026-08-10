import { NPC_TEMPLATES } from './const.js';
import { CharacterFactory } from './CharacterFactory.js';

/**
 * AreaManager - Handles loading and transitioning between game areas
 *
 * Areas are discrete maps with their own backgrounds, dimensions, and blocked hexes.
 * Inspired by Baldur's Gate style area-based world design.
 *
 * Architecture: AreaManager acts as the "repository" for NPCs - abstracts where template data comes from.
 * Current: NPC templates loaded from const.js (local data)
 * Future: NPC templates fetched from backend API (only this file changes)
 */
export class AreaManager {
    constructor() {
        this.currentArea = null;
        this.areaCache = new Map(); // Cache loaded area definitions
        this.imageCache = new Map(); // Cache loaded background images

        // Dependencies (set via setDependencies)
        this.hexGrid = null;
        this.pathfinding = null;
        this.game = null;

        // Callbacks
        this.onAreaLoaded = null;
        this.onAreaTransition = null;
    }

    setDependencies({ hexGrid, pathfinding, game }) {
        const required = { hexGrid, pathfinding, game };
        for (const [name, dep] of Object.entries(required)) {
            if (!dep) throw new Error(`AreaManager: missing required dependency '${name}'`);
        }
        this.hexGrid = hexGrid;
        this.pathfinding = pathfinding;
        this.game = game;
    }

    /**
     * Validate an area definition against the expected schema.
     * Throws on missing/invalid required fields; warns on optional field issues.
     * @param {Object} areaDef - The parsed area.json object
     * @param {string} areaId - The area identifier (for error messages)
     */
    validateAreaDefinition(areaDef, areaId) {
        // Required fields — throw on failure
        const requiredStrings = ["id", "name", "background"];
        for (const field of requiredStrings) {
            if (typeof areaDef[field] !== "string" || areaDef[field].length === 0) {
                throw new Error(`[AreaManager] Area '${areaId}': missing or invalid '${field}' (expected non-empty string, got ${typeof areaDef[field]})`);
            }
        }
        const requiredNumbers = ["width", "height"];
        for (const field of requiredNumbers) {
            if (typeof areaDef[field] !== "number" || areaDef[field] <= 0) {
                throw new Error(`[AreaManager] Area '${areaId}': missing or invalid '${field}' (expected positive number, got ${typeof areaDef[field]})`);
            }
        }

        // Optional fields — warn on issues

        if (areaDef.blocked !== undefined) {
            if (!Array.isArray(areaDef.blocked)) {
                console.warn(`[AreaManager] Area '${areaId}': 'blocked' should be an array, got ${typeof areaDef.blocked}`);
            } else {
                areaDef.blocked.forEach((entry, i) => {
                    if (typeof entry.q !== "number" || typeof entry.r !== "number") {
                        console.warn(`[AreaManager] Area '${areaId}': blocked[${i}] missing numeric q/r`);
                    }
                });
            }
        }

        if (areaDef.spawns !== undefined) {
            if (typeof areaDef.spawns !== "object" || Array.isArray(areaDef.spawns)) {
                console.warn(`[AreaManager] Area '${areaId}': 'spawns' should be an object, got ${Array.isArray(areaDef.spawns) ? "array" : typeof areaDef.spawns}`);
            } else {
                for (const [key, val] of Object.entries(areaDef.spawns)) {
                    if (!val || typeof val.q !== "number" || typeof val.r !== "number") {
                        console.warn(`[AreaManager] Area '${areaId}': spawns['${key}'] missing numeric q/r`);
                    }
                }
            }
        }

        if (areaDef.npcs !== undefined) {
            if (!Array.isArray(areaDef.npcs)) {
                console.warn(`[AreaManager] Area '${areaId}': 'npcs' should be an array, got ${typeof areaDef.npcs}`);
            } else {
                areaDef.npcs.forEach((entry, i) => {
                    if (typeof entry.templateId !== "string") {
                        console.warn(`[AreaManager] Area '${areaId}': npcs[${i}] missing string 'templateId'`);
                    }
                    if (typeof entry.hexQ !== "number" || typeof entry.hexR !== "number") {
                        console.warn(`[AreaManager] Area '${areaId}': npcs[${i}] missing numeric hexQ/hexR`);
                    }
                });
            }
        }

        if (areaDef.exits !== undefined) {
            if (!Array.isArray(areaDef.exits)) {
                console.warn(`[AreaManager] Area '${areaId}': 'exits' should be an array, got ${typeof areaDef.exits}`);
            } else {
                areaDef.exits.forEach((entry, i) => {
                    if (typeof entry.id !== "string") {
                        console.warn(`[AreaManager] Area '${areaId}': exits[${i}] missing string 'id'`);
                    }
                    if (!Array.isArray(entry.hexes)) {
                        console.warn(`[AreaManager] Area '${areaId}': exits[${i}] missing array 'hexes'`);
                    }
                    if (typeof entry.target !== "string") {
                        console.warn(`[AreaManager] Area '${areaId}': exits[${i}] missing string 'target'`);
                    }
                    if (typeof entry.spawn !== "string") {
                        console.warn(`[AreaManager] Area '${areaId}': exits[${i}] missing string 'spawn'`);
                    }
                });
            }
        }
    }

    /**
     * Load an area definition from JSON
     * @param {string} areaId - The area identifier (e.g., 'bridge_crossing')
     * @returns {Promise<Object>} The area definition
     */
    async loadAreaDefinition(areaId) {
        // Check cache first
        if (this.areaCache.has(areaId)) {
            return this.areaCache.get(areaId);
        }

        try {
            const response = await fetch(`areas/${areaId}/area.json`);
            if (!response.ok) {
                throw new Error(`Failed to load area: ${areaId}`);
            }
            const areaDef = await response.json();
            if (!areaDef || typeof areaDef !== "object") {
                throw new Error(`[AreaManager] Area '${areaId}': area.json is empty or not a valid JSON object`);
            }
            this.validateAreaDefinition(areaDef, areaId);
            this.areaCache.set(areaId, areaDef);
            return areaDef;
        } catch (error) {
            console.error(`Error loading area ${areaId}:`, error);
            throw error;
        }
    }

    /**
     * Load a background image for an area
     * @param {string} imagePath - Path to the background image
     * @returns {Promise<HTMLImageElement>}
     */
    async loadBackgroundImage(imagePath) {
        // Check cache first
        if (this.imageCache.has(imagePath)) {
            return this.imageCache.get(imagePath);
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.imageCache.set(imagePath, img);
                resolve(img);
            };
            img.onerror = () => reject(new Error(`Failed to load image: ${imagePath}`));
            img.src = imagePath;
        });
    }

    /**
     * Load and switch to a new area
     * @param {string} areaId - The area to load
     * @param {string} [spawnId] - Optional spawn point ID within the area
     * @returns {Promise<Object>} The loaded area
     */
    async loadArea(areaId, spawnId = 'default') {
        const areaDef = await this.loadAreaDefinition(areaId);
        // Background path is relative to area folder
        const bgPath = `areas/${areaId}/${areaDef.background}`;
        const background = await this.loadBackgroundImage(bgPath);

        // Store reference to loaded background
        areaDef._backgroundImage = background;

        // Instantiate NPCs from area definition (repository pattern)
        const npcs = this.instantiateNPCs(areaDef);
        areaDef._instantiatedNPCs = npcs; // Store for Game.js to retrieve via getNPCs()

        // Update current area
        this.currentArea = areaDef;

        // Apply area to game systems
        this.applyArea(areaDef, spawnId);

        if (this.onAreaLoaded) {
            this.onAreaLoaded(areaDef);
        }

        return areaDef;
    }

    /**
     * Apply an area's settings to the game systems
     * @param {Object} areaDef - The area definition
     * @param {string} spawnId - Spawn point ID
     */
    applyArea(areaDef, spawnId) {
        // Update hex grid dimensions if it supports resizing
        if (this.hexGrid && this.hexGrid.resize) {
            this.hexGrid.resize(areaDef.width, areaDef.height);
        }

        // Set blocked hexes for pathfinding
        if (this.pathfinding) {
            this.pathfinding.setBlockedHexes(areaDef.blocked || []);
        }

        // Get spawn point
        const spawn = this.getSpawnPoint(areaDef, spawnId);

        return { spawn, areaDef };
    }

    /**
     * Get a spawn point from an area definition
     * @param {Object} areaDef - The area definition
     * @param {string} spawnId - Spawn point ID
     * @returns {Object} Spawn point with hex coordinates
     */
    getSpawnPoint(areaDef, spawnId) {
        const spawns = areaDef.spawns || {};

        // Try to find requested spawn, fall back to default, then first available
        if (spawns[spawnId]) {
            return spawns[spawnId];
        }
        if (spawns.default) {
            return spawns.default;
        }

        // Return first spawn point or center of map
        const spawnKeys = Object.keys(spawns);
        if (spawnKeys.length > 0) {
            return spawns[spawnKeys[0]];
        }

        // Fallback: center of map
        return { q: 5, r: -5 };
    }

    /**
     * Instantiate NPCs from area definition
     * This is the "repository" layer - abstracts where template data comes from
     *
     * Current: Templates from const.js (synchronous, local)
     * Future: Templates from API (async, make this method async and await fetch)
     *
     * @param {Object} areaDef - The area definition with npcs array
     * @returns {Array<Object>} Array of instantiated character objects
     */
    instantiateNPCs(areaDef) {
        if (!areaDef.npcs || areaDef.npcs.length === 0) {
            return [];
        }

        return areaDef.npcs.map((npcSpec, index) => {
            const templateId = npcSpec.templateId;

            // A placement is backed either by a code template (templateId) or by a
            // build file alone (buildId), in which case it carries its own identity
            // fields and needs no NPC_TEMPLATES entry.
            let template = {};
            if (templateId) {
                // Repository Pattern: Lookup template (NOW: const.js, FUTURE: API fetch)
                template = NPC_TEMPLATES[templateId];
                if (!template) {
                    console.warn(`[AreaManager] Area '${this.currentArea?.id}': npcs[${index}] references unknown template '${templateId}'`);
                    return null;
                }
            } else if (!npcSpec.buildId) {
                console.warn(`[AreaManager] Area '${this.currentArea?.id}': npcs[${index}] has neither templateId nor buildId`);
                return null;
            }

            // Merge template with area-specific overrides (position, facing, name, etc.)
            const npcConfig = {
                ...template,
                ...npcSpec,
            };

            // Remove templateId from final config (not needed by CharacterFactory)
            delete npcConfig.templateId;

            return CharacterFactory.createCharacter(npcConfig);
        }).filter(npc => npc !== null); // Remove any failed lookups
    }

    /**
     * Get instantiated NPCs for the current area
     * @returns {Array<Object>} Array of character objects
     */
    getNPCs() {
        return this.currentArea?._instantiatedNPCs || [];
    }

    // --- Live placement editing (dev) ---
    //
    // Placements live in area.json's npcs[] and are written back via WebDAV, so
    // characters placed in-game survive a refresh. A placement entry overrides
    // its template (see instantiateNPCs' {...template, ...npcSpec}), which is
    // what lets the same build spawn under any faction.

    /**
     * Add an NPC placement and re-instantiate the roster.
     * @param {Object} spec - { buildId, faction, hexQ, hexR, name?, mode?, spriteSet? }
     * @returns {Promise<Object|null>} The new character, or null on failure
     */
    async addNPCPlacement(spec) {
        if (!this.currentArea) return null;

        this.currentArea.npcs = this.currentArea.npcs || [];
        this.currentArea.npcs.push(spec);

        const character = this.refreshNPCs();
        await this.saveArea();
        return character[character.length - 1] || null;
    }

    /**
     * Remove whatever placement sits on a hex.
     * @returns {Promise<boolean>} True if something was removed
     */
    async removeNPCPlacementAt(q, r) {
        if (!this.currentArea?.npcs) return false;

        const before = this.currentArea.npcs.length;
        this.currentArea.npcs = this.currentArea.npcs.filter(n => !(n.hexQ === q && n.hexR === r));
        if (this.currentArea.npcs.length === before) return false;

        this.refreshNPCs();
        await this.saveArea();
        return true;
    }

    /**
     * Rebuild the instantiated roster from the current placements.
     * Mutates the existing array in place so references held by Game.state stay valid.
     */
    refreshNPCs() {
        const npcs = this.instantiateNPCs(this.currentArea);
        const live = this.currentArea._instantiatedNPCs;

        if (Array.isArray(live)) {
            live.length = 0;
            live.push(...npcs);
            return live;
        }

        this.currentArea._instantiatedNPCs = npcs;
        return npcs;
    }

    /**
     * Serialize an area definition in the file's hand-authored style:
     * 4-space indent, with {q, r} coordinate pairs kept on one line.
     *
     * Plain JSON.stringify explodes every blocked hex across three lines, which
     * turns a one-NPC change into a thousand-line diff.
     */
    serializeArea(areaDef) {
        return JSON.stringify(areaDef, null, 4)
            .replace(/\{\s*\n\s*"q": (-?\d+),\s*\n\s*"r": (-?\d+)\s*\n\s*\}/g, '{"q": $1, "r": $2}');
    }

    /**
     * Persist the current area definition back to areas/{id}/area.json.
     * DEV ONLY - relies on the WebDAV PUT enabled in nginx-dev.conf.
     */
    async saveArea() {
        if (!this.currentArea) return false;

        // Strip every runtime-only field (convention: leading underscore) so
        // cached images and instantiated characters never land in level data
        const areaDef = Object.fromEntries(
            Object.entries(this.currentArea).filter(([key]) => !key.startsWith('_'))
        );

        try {
            const res = await fetch(`areas/${areaDef.id}/area.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: this.serializeArea(areaDef) + '\n',
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return true;
        } catch (e) {
            console.error(`[AreaManager] Failed to save area '${areaDef.id}':`, e.message);
            return false;
        }
    }

    /**
     * Get a spawn point from the current area by ID
     * @param {string} spawnId - Spawn point ID (e.g. 'default', 'north')
     * @returns {Object} Spawn point {q, r}
     */
    getSpawn(spawnId) {
        if (!this.currentArea) return { q: 0, r: 0 };
        return this.getSpawnPoint(this.currentArea, spawnId);
    }

    /**
     * Check if a character is on an exit hex and get the transition info
     * @param {number} q - Hex Q coordinate
     * @param {number} r - Hex R coordinate
     * @returns {Object|null} Exit info or null if not on an exit
     */
    getExitAt(q, r) {
        if (!this.currentArea || !this.currentArea.exits) {
            return null;
        }

        for (const exit of this.currentArea.exits) {
            for (const hex of exit.hexes) {
                if (hex.q === q && hex.r === r) {
                    return {
                        targetArea: exit.target,
                        targetSpawn: exit.spawn
                    };
                }
            }
        }

        return null;
    }

    /**
     * Trigger a transition to another area
     * @param {string} targetArea - Target area ID
     * @param {string} targetSpawn - Spawn point in target area
     */
    async transition(targetArea, targetSpawn) {
        if (this.onAreaTransition) {
            this.onAreaTransition(this.currentArea?.id, targetArea);
        }

        await this.loadArea(targetArea, targetSpawn);
    }

    /**
     * Check if a hex is blocked in the current area
     * @param {number} q - Hex Q coordinate
     * @param {number} r - Hex R coordinate
     * @returns {boolean}
     */
    isBlocked(q, r) {
        if (!this.currentArea || !this.currentArea.blocked) {
            return false;
        }

        return this.currentArea.blocked.some(hex => hex.q === q && hex.r === r);
    }

    /**
     * Get the current area's background image
     * @returns {HTMLImageElement|null}
     */
    getBackground() {
        return this.currentArea?._backgroundImage || null;
    }

    /**
     * Get the current area's dimensions
     * @returns {Object} { width, height }
     */
    getDimensions() {
        if (!this.currentArea) {
            return { width: 1920, height: 1080 }; // Default fallback
        }
        return {
            width: this.currentArea.width,
            height: this.currentArea.height
        };
    }
}
