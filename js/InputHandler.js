import { GAME_STATES } from './GameStateManager.js';
import { GAME_CONSTANTS, hexKey } from './const.js';
import { CharacterStore } from './CharacterStore.js';

export class InputHandler {
    constructor(canvas, config) {
        this.canvas = canvas;
        this.config = config;

        // Mouse state
        this.mouseX = 0;
        this.mouseY = 0;
        this.isMouseOverCanvas = false;
        this.hoveredHex = null;  // Current hex under mouse cursor

        // Hex marker mode (for map editing)
        this.hexMarkerMode = false;
        this.markedHexes = new Map(); // Key: "q,r", Value: {q, r}

        // Spawn mode (dev): click an empty hex to place, a placed NPC to remove
        this.spawnMode = false;
        this.spawnBuildId = null;
        this.spawnFaction = 'bandit';

        // Held keys, indexed by physical key (e.code) rather than the produced
        // character, so Shift or CapsLock can't strand a key in the held state
        this.keys = {};

        // Dependencies (injected)
        this.world = null;
        this.hexGrid = null;
        this.gameStateManager = null;
        this.camera = null;
        this.findPath = null;
        this.getCharacterAtHex = null;
        this.areaManager = null; // Optional - only needed for spawn mode

        // Callbacks
        this.onDebugUpdate = null;
        this.onAnimationChange = null;
        this.onMouseMove = null;
        this.onMarkedHexesChange = null;
        this.onRosterChange = null;

        // Bind methods
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseClick = this.handleMouseClick.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleMouseEnter = this.handleMouseEnter.bind(this);
        this.handleMouseLeave = this.handleMouseLeave.bind(this);
        this.handleWindowBlur = this.handleWindowBlur.bind(this);

        // Set up event listeners
        this.setupEventListeners();
    }

    setDependencies(deps) {
        const required = ['game', 'hexGrid', 'gameStateManager', 'combatInputHandler', 'camera', 'findPath', 'getCharacterAtHex'];
        for (const dep of required) {
            if (!deps[dep]) throw new Error(`InputHandler: missing required dependency '${dep}'`);
        }
        this.world = deps.world;
        this.hexGrid = deps.hexGrid;
        this.gameStateManager = deps.gameStateManager;
        this.camera = deps.camera;
        this.combatInputHandler = deps.combatInputHandler;
        this.findPath = deps.findPath;
        this.getCharacterAtHex = deps.getCharacterAtHex;
        this.areaManager = deps.areaManager || null;
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('click', this.handleMouseClick);
        this.canvas.addEventListener('mouseenter', this.handleMouseEnter);
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
        // Losing focus mid-scroll never delivers the keyup, which would leave the
        // camera scrolling on its own once focus returns
        window.addEventListener('blur', this.handleWindowBlur);
    }

    handleWindowBlur() {
        this.keys = {};
    }

    handleMouseEnter() {
        this.isMouseOverCanvas = true;
    }

    handleMouseLeave() {
        this.isMouseOverCanvas = false;
    }

    handleMouseMove(e) {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;

        const rect = this.canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;

        // Update hovered hex
        const worldX = (canvasX + this.camera.x) / this.camera.zoom;
        const worldY = (canvasY + this.camera.y) / this.camera.zoom;
        this.hoveredHex = this.hexGrid.pixelToHex(worldX, worldY);

        if (this.onMouseMove) {
            this.onMouseMove(canvasX, canvasY);
        }
    }

    handleMouseClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;

        const worldX = (canvasX + this.camera.x) / this.camera.zoom;
        const worldY = (canvasY + this.camera.y) / this.camera.zoom;

        const targetHex = this.hexGrid.pixelToHex(worldX, worldY);

        // Handle spawn mode (only when not in combat)
        if (this.spawnMode && !this.gameStateManager.isInCombat()) {
            this.handleSpawnClick(targetHex);
            return;
        }

        // Handle hex marker mode (only when not in combat)
        if (this.hexMarkerMode && !this.gameStateManager.isInCombat()) {
            this.toggleMarkedHex(targetHex.q, targetHex.r);
            return;
        }

        // Handle combat input phase
        if (this.gameStateManager.currentState === GAME_STATES.COMBAT_INPUT) {
            this.combatInputHandler.handleCombatClick(targetHex);
            return;
        }

        // Handle exploration movement
        if (!this.gameStateManager.canPlayerMove()) {
            return;
        }

        // Don't move if already moving or clicking on current position
        if (this.world.pc.isMoving ||
            (targetHex.q === this.world.pc.hexQ && targetHex.r === this.world.pc.hexR)) {
            return;
        }

        // Check if target hex is occupied
        const characterAtTarget = this.getCharacterAtHex(targetHex.q, targetHex.r);
        if (characterAtTarget) {
            return;
        }

        // Get all obstacles
        const obstacles = this.world.npcs.map(npc => ({ q: npc.hexQ, r: npc.hexR }));

        // Find path
        const startHex = { q: this.world.pc.hexQ, r: this.world.pc.hexR };
        const path = this.findPath(startHex, targetHex, obstacles);

        if (path.length > 0) {
            this.world.pc.movementQueue = path;
            this.world.pc.isMoving = true;
            this.world.pc.currentMoveTimer = 0;
        }
    }

    handleKeyDown(e) {
        this.keys[e.code] = true;

        // Prevent Tab from switching focus (used for show all nameplates)
        if (e.key === 'Tab') {
            e.preventDefault();
            return;
        }

        // Arrow keys are deliberately unbound — camera is WASD, facing is Q/E.
        // Still swallowed so they cannot scroll the page, and reserved for a
        // future binding.
        if (e.key.startsWith('Arrow')) {
            e.preventDefault();
            return;
        }

        // Handle Shift+Space for combat toggle (works from any state)
        if (e.key === ' ' && e.shiftKey) {
            e.preventDefault();
            this.gameStateManager.toggleCombat();
            return;
        }

        // Delegate combat-specific keys to CombatInputHandler
        if (this.gameStateManager.currentState === GAME_STATES.COMBAT_INPUT) {
            if (this.combatInputHandler.handleCombatKeyDown(e)) return;
        }

        // Non-combat key bindings
        switch (e.key) {
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
                // Only change animations outside of combat
                if (this.gameStateManager.currentState !== GAME_STATES.COMBAT_INPUT) {
                    const animations = ['idle', 'walk', 'run', 'attack', 'jump', 'die'];
                    const animIndex = parseInt(e.key) - 1;
                    if (animIndex >= 0 && animIndex < animations.length) {
                        this.world.pc.currentAnimation = animations[animIndex];
                        this.onAnimationChange?.(animations[animIndex]);
                    }
                }
                break;

            case '8':
                this.debugCharacterPositions();
                break;
        }
    }

    handleKeyUp(e) {
        this.keys[e.code] = false;
    }

    /**
     * Desired camera scroll velocity in pixels per second, read once per frame
     * by the game loop. Reports intent only - CameraController owns the physics.
     * Keyboard wins over mouse edge scrolling while any scroll key is held.
     */
    getScrollIntent() {
        const keyboard = this.getKeyboardScrollIntent();
        if (keyboard.x !== 0 || keyboard.y !== 0) {
            return keyboard;
        }
        return this.getEdgeScrollIntent();
    }

    getKeyboardScrollIntent() {
        let dirX = 0;
        let dirY = 0;

        // WASD only — the arrow keys are deliberately unbound and reserved
        if (this.keys['KeyW']) dirY -= 1;
        if (this.keys['KeyS']) dirY += 1;
        if (this.keys['KeyA']) dirX -= 1;
        if (this.keys['KeyD']) dirX += 1;

        const length = Math.hypot(dirX, dirY);
        if (length === 0) {
            return { x: 0, y: 0, kick: 0 };
        }

        // Normalize so diagonals aren't faster than the cardinals
        const speed = GAME_CONSTANTS.KEYBOARD_SCROLL_SPEED;
        return {
            x: (dirX / length) * speed,
            y: (dirY / length) * speed,
            kick: GAME_CONSTANTS.KEYBOARD_SCROLL_KICK
        };
    }

    getEdgeScrollIntent() {
        // No kick: edge speed ramps with how deep the cursor sits in the zone,
        // so jumping to a minimum speed at the boundary would feel like a lurch
        const intent = { x: 0, y: 0, kick: 0 };
        if (!this.isMouseOverCanvas) {
            return intent;
        }

        const rect = this.canvas.getBoundingClientRect();
        const relativeX = this.mouseX - rect.left;
        const relativeY = this.mouseY - rect.top;

        const leftDistance = relativeX;
        const rightDistance = rect.width - relativeX;
        const topDistance = relativeY;
        const bottomDistance = rect.height - relativeY;

        const threshold = GAME_CONSTANTS.EDGE_SCROLL_THRESHOLD;
        const maxSpeed = GAME_CONSTANTS.MAX_EDGE_SCROLL_SPEED;

        if (leftDistance >= 0 && leftDistance < threshold) {
            intent.x = -maxSpeed * (1 - leftDistance / threshold);
        } else if (rightDistance >= 0 && rightDistance < threshold) {
            intent.x = maxSpeed * (1 - rightDistance / threshold);
        }

        if (topDistance >= 0 && topDistance < threshold) {
            intent.y = -maxSpeed * (1 - topDistance / threshold);
        } else if (bottomDistance >= 0 && bottomDistance < threshold) {
            intent.y = maxSpeed * (1 - bottomDistance / threshold);
        }

        return intent;
    }

    debugCharacterPositions() {

        const foundPC = this.getCharacterAtHex(this.world.pc.hexQ, this.world.pc.hexR);

        this.world.npcs.forEach(npc => {
            const foundNPC = this.getCharacterAtHex(npc.hexQ, npc.hexR);
        });
    }

    // Spawn mode methods (dev)

    setSpawnMode(enabled) {
        this.spawnMode = enabled;
        console.log(`Spawn mode: ${enabled ? 'ON' : 'OFF'}`);
    }

    setSpawnBuild(buildId) {
        this.spawnBuildId = buildId;
    }

    setSpawnFaction(faction) {
        this.spawnFaction = faction;
    }

    /**
     * Click handler while in spawn mode.
     * Occupied hex -> remove that placement. Empty hex -> place the selected build.
     * The PC is never removable - it is not an area placement.
     */
    async handleSpawnClick(hex) {
        const occupant = this.getCharacterAtHex(hex.q, hex.r);

        if (occupant) {
            if (occupant === this.world.pc) {
                console.warn('[Spawn] The PC is not an area placement - cannot remove');
                return;
            }
            const removed = await this.areaManager.removeNPCPlacement(occupant);
            console.log(removed
                ? `[Spawn] Removed ${occupant.name} at (${hex.q},${hex.r})`
                : `[Spawn] ${occupant.name} is not an area placement - cannot remove`);
            this.onRosterChange?.();
            return;
        }

        if (!this.spawnBuildId) {
            console.warn('[Spawn] No build selected');
            return;
        }

        const build = CharacterStore.get(this.spawnBuildId);
        const character = await this.areaManager.addNPCPlacement({
            buildId: this.spawnBuildId,
            name: this.uniqueName(build?.name || this.spawnBuildId),
            faction: this.spawnFaction,
            mode: 'aggressive',
            hexQ: hex.q,
            hexR: hex.r,
        });

        console.log(`[Spawn] Placed ${character?.name} (${this.spawnFaction}) at (${hex.q},${hex.r})`);
        this.onRosterChange?.();
    }

    /**
     * Suffix a name until it is unique, so several instances of one build stay
     * distinguishable in the log and nameplates.
     */
    uniqueName(base) {
        const taken = new Set([this.world.pc?.name, ...this.world.npcs.map(n => n.name)]);
        if (!taken.has(base)) return base;

        let i = 2;
        while (taken.has(`${base} ${i}`)) i++;
        return `${base} ${i}`;
    }

    // Hex marker mode methods
    setHexMarkerMode(enabled, blockedHexes = []) {
        this.hexMarkerMode = enabled;
        if (enabled && blockedHexes.length > 0) {
            // Pre-populate with existing blocked hexes
            blockedHexes.forEach(hex => {
                this.markedHexes.set(hexKey(hex.q, hex.r), { q: hex.q, r: hex.r });
            });
        }
        console.log(`Hex marker mode: ${enabled ? 'ON' : 'OFF'}${enabled ? ` (${this.markedHexes.size} blocked hexes loaded)` : ''}`);
    }

    toggleMarkedHex(q, r) {
        const key = hexKey(q, r);
        if (this.markedHexes.has(key)) {
            this.markedHexes.delete(key);
        } else {
            this.markedHexes.set(key, { q, r });
        }
        this.onMarkedHexesChange?.();
    }

    clearMarkedHexes() {
        this.markedHexes.clear();
        console.log('Cleared all marked hexes');
    }

    exportMarkedHexes() {
        const hexes = Array.from(this.markedHexes.values());
        if (hexes.length === 0) {
            console.log('No hexes marked');
            return [];
        }

        // Sort by q then r for readability
        hexes.sort((a, b) => a.q !== b.q ? a.q - b.q : a.r - b.r);

        // Output as JSON array
        const json = JSON.stringify(hexes, null, 2);
        console.log('=== MARKED HEXES ===');
        console.log(json);
        console.log('====================');
        console.log(`Total: ${hexes.length} hexes`);

        return hexes;
    }

    isShowAllNameplates() {
        return this.keys['Tab'] === true;
    }

    cleanup() {
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('click', this.handleMouseClick);
        this.canvas.removeEventListener('mouseenter', this.handleMouseEnter);
        this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
    }
}