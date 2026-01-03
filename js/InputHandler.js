import { GAME_STATES, COMBAT_ACTIONS } from './GameStateManager.js';
import { GAME_CONSTANTS, rotateFacing } from './const.js';

export class InputHandler {
    constructor(canvas, config) {
        this.canvas = canvas;
        this.config = config;

        // Mouse state
        this.mouseX = 0;
        this.mouseY = 0;
        this.isMouseOverCanvas = false;
        this.keyboardScrollActive = false;
        this.mouseInEdgeZone = false;
        this.wasInEdgeZone = false;
        this.hoveredHex = null;  // Current hex under mouse cursor

        // Hex marker mode (for map editing)
        this.hexMarkerMode = false;
        this.markedHexes = new Map(); // Key: "q,r", Value: {q, r}

        // Combat attack mode (when player presses 1 or 2 for light/heavy attack)
        this.attackModeActive = false;

        // Keyboard state
        this.keys = {};

        // Dependencies (injected)
        this.game = null;
        this.hexGrid = null;
        this.gameStateManager = null;
        this.findPath = null;
        this.getCharacterAtHex = null;

        // Callbacks
        this.onCameraUpdate = null;
        this.onDebugUpdate = null;
        this.onAnimationChange = null;
        this.onMouseMove = null;
        this.onMarkedHexesChange = null;

        // Bind methods
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseClick = this.handleMouseClick.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleMouseEnter = this.handleMouseEnter.bind(this);
        this.handleMouseLeave = this.handleMouseLeave.bind(this);

        // Set up event listeners
        this.setupEventListeners();

        // Start edge scrolling loop
        this.updateEdgeScrolling();
    }

    setDependencies(deps) {
        this.game = deps.game;
        this.hexGrid = deps.hexGrid;
        this.gameStateManager = deps.gameStateManager;
        this.findPath = deps.findPath;
        this.getCharacterAtHex = deps.getCharacterAtHex;
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('click', this.handleMouseClick);
        this.canvas.addEventListener('mouseenter', this.handleMouseEnter);
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
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
        const camera = this.onCameraUpdate?.() || { x: 0, y: 0, zoom: 1 };
        const worldX = (canvasX + camera.x) / camera.zoom;
        const worldY = (canvasY + camera.y) / camera.zoom;
        this.hoveredHex = this.hexGrid.pixelToHex(worldX, worldY);

        if (this.onMouseMove) {
            this.onMouseMove(canvasX, canvasY);
        }
    }

    handleMouseClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;

        const camera = this.onCameraUpdate?.() || { x: 0, y: 0, zoom: 1 };
        const worldX = (canvasX + camera.x) / camera.zoom;
        const worldY = (canvasY + camera.y) / camera.zoom;

        const targetHex = this.hexGrid.pixelToHex(worldX, worldY);

        // Handle hex marker mode (only when not in combat)
        if (this.hexMarkerMode && this.gameStateManager.currentState !== GAME_STATES.COMBAT_INPUT) {
            this.toggleMarkedHex(targetHex.q, targetHex.r);
            return;
        }

        // Handle combat input phase
        if (this.gameStateManager.currentState === GAME_STATES.COMBAT_INPUT) {
            if (this.attackModeActive) {
                // Attack mode: click adjacent hex to attack it
                const success = this.gameStateManager.selectPlayerAttackTarget(targetHex.q, targetHex.r);
                if (success) {
                    this.attackModeActive = false;  // Reset after successful attack selection
                }
            } else {
                // Move mode: click adjacent hex to move to it
                this.gameStateManager.selectPlayerMoveTarget(targetHex.q, targetHex.r);
            }
            return;
        }

        // Handle exploration movement
        if (!this.gameStateManager.canPlayerMove()) {
            return;
        }

        // Don't move if already moving or clicking on current position
        if (this.game.pc.isMoving ||
            (targetHex.q === this.game.pc.hexQ && targetHex.r === this.game.pc.hexR)) {
            return;
        }

        // Check if target hex is occupied
        const characterAtTarget = this.getCharacterAtHex(targetHex.q, targetHex.r);
        if (characterAtTarget) {
            return;
        }

        // Get all obstacles
        const obstacles = this.game.npcs.map(npc => ({ q: npc.hexQ, r: npc.hexR }));

        // Find path
        const startHex = { q: this.game.pc.hexQ, r: this.game.pc.hexR };
        const path = this.findPath(startHex, targetHex, obstacles);

        if (path.length > 0) {
            this.game.pc.movementQueue = path;
            this.game.pc.isMoving = true;
            this.game.pc.currentMoveTimer = 0;
        }
    }

    handleKeyDown(e) {
        this.keys[e.key] = true;

        // Prevent Tab from switching focus (used for show all nameplates)
        if (e.key === 'Tab') {
            e.preventDefault();
            return;
        }

        // Handle Shift+Space for combat toggle
        if (e.key === ' ' && e.shiftKey) {
            e.preventDefault();
            this.gameStateManager.toggleCombat();
            return;
        }

        // Handle just Space for skipping turn in combat
        if (e.key === ' ' && !e.shiftKey) {
            e.preventDefault();
            // Skip turn in combat input phase
            if (this.gameStateManager.currentState === GAME_STATES.COMBAT_INPUT &&
                !this.gameStateManager.characterActions.has(this.game.pc)) {
                // Player chooses to wait
                this.gameStateManager.skipPlayerTurn();
            }
            return;
        }

        // Handle facing rotation during combat input (ArrowLeft/ArrowRight)
        // Ctrl+Arrow rotates 2 steps for faster direction change
        if (this.gameStateManager.currentState === GAME_STATES.COMBAT_INPUT) {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const steps = e.ctrlKey ? 2 : 1;
                this.game.pc.facing = rotateFacing(this.game.pc.facing, false, steps);
                return;
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                const steps = e.ctrlKey ? 2 : 1;
                this.game.pc.facing = rotateFacing(this.game.pc.facing, true, steps);
                return;
            }

            // Attack type selection during combat input
            if (e.key === '1') {
                e.preventDefault();
                this.gameStateManager.setPlayerAttackType('light');
                this.attackModeActive = true;
                return;
            }
            if (e.key === '2') {
                e.preventDefault();
                this.gameStateManager.setPlayerAttackType('heavy');
                this.attackModeActive = true;
                return;
            }

            // Enter key repeats last attack action
            if (e.key === 'Enter') {
                e.preventDefault();
                const success = this.gameStateManager.repeatLastAttack();
                if (success) {
                    this.attackModeActive = false;
                }
                return;
            }
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
                        this.game.pc.currentAnimation = animations[animIndex];
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
        this.keys[e.key] = false;
    }

    updateKeyboardScrolling() {
        let scrollX = 0;
        let scrollY = 0;

        if (this.keys['ArrowUp'] || this.keys['w'] || this.keys['W']) scrollY -= GAME_CONSTANTS.KEYBOARD_SCROLL_SPEED;
        if (this.keys['ArrowDown'] || this.keys['s'] || this.keys['S']) scrollY += GAME_CONSTANTS.KEYBOARD_SCROLL_SPEED;
        if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) scrollX -= GAME_CONSTANTS.KEYBOARD_SCROLL_SPEED;
        if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) scrollX += GAME_CONSTANTS.KEYBOARD_SCROLL_SPEED;

        if (scrollX !== 0 || scrollY !== 0) {
            this.keyboardScrollActive = true;
            this.onCameraUpdate?.({ scrollX, scrollY });
        }

        return { scrollX, scrollY };
    }

    updateEdgeScrolling() {
        if (!this.isMouseOverCanvas) {
            requestAnimationFrame(() => this.updateEdgeScrolling());
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const relativeX = this.mouseX - rect.left;
        const relativeY = this.mouseY - rect.top;

        // Check if mouse is in edge zone
        const leftDistance = relativeX;
        const rightDistance = rect.width - relativeX;
        const topDistance = relativeY;
        const bottomDistance = rect.height - relativeY;

        const currentlyInEdgeZone = (
            (leftDistance < GAME_CONSTANTS.EDGE_SCROLL_THRESHOLD && leftDistance >= 0) ||
            (rightDistance < GAME_CONSTANTS.EDGE_SCROLL_THRESHOLD && rightDistance >= 0) ||
            (topDistance < GAME_CONSTANTS.EDGE_SCROLL_THRESHOLD && topDistance >= 0) ||
            (bottomDistance < GAME_CONSTANTS.EDGE_SCROLL_THRESHOLD && bottomDistance >= 0)
        );

        // Track edge zone entry/exit
        if (!this.wasInEdgeZone && currentlyInEdgeZone) {
            this.mouseInEdgeZone = true;
            if (this.keyboardScrollActive) {
                this.keyboardScrollActive = false;
            }
        } else if (this.wasInEdgeZone && !currentlyInEdgeZone) {
            this.mouseInEdgeZone = false;
        }

        this.wasInEdgeZone = currentlyInEdgeZone;

        // Skip edge scrolling if keyboard scrolling is active
        if (this.keyboardScrollActive) {
            requestAnimationFrame(() => this.updateEdgeScrolling());
            return;
        }

        let scrollX = 0;
        let scrollY = 0;

        if (leftDistance < GAME_CONSTANTS.EDGE_SCROLL_THRESHOLD && leftDistance >= 0) {
            const speedMultiplier = 1 - (leftDistance / GAME_CONSTANTS.EDGE_SCROLL_THRESHOLD);
            scrollX = -GAME_CONSTANTS.MAX_EDGE_SCROLL_SPEED * speedMultiplier;
        } else if (rightDistance < GAME_CONSTANTS.EDGE_SCROLL_THRESHOLD && rightDistance >= 0) {
            const speedMultiplier = 1 - (rightDistance / GAME_CONSTANTS.EDGE_SCROLL_THRESHOLD);
            scrollX = GAME_CONSTANTS.MAX_EDGE_SCROLL_SPEED * speedMultiplier;
        }

        if (topDistance < GAME_CONSTANTS.EDGE_SCROLL_THRESHOLD && topDistance >= 0) {
            const speedMultiplier = 1 - (topDistance / GAME_CONSTANTS.EDGE_SCROLL_THRESHOLD);
            scrollY = -GAME_CONSTANTS.MAX_EDGE_SCROLL_SPEED * speedMultiplier;
        } else if (bottomDistance < GAME_CONSTANTS.EDGE_SCROLL_THRESHOLD && bottomDistance >= 0) {
            const speedMultiplier = 1 - (bottomDistance / GAME_CONSTANTS.EDGE_SCROLL_THRESHOLD);
            scrollY = GAME_CONSTANTS.MAX_EDGE_SCROLL_SPEED * speedMultiplier;
        }

        if (scrollX !== 0 || scrollY !== 0) {
            this.onCameraUpdate?.({ scrollX, scrollY });
        }

        requestAnimationFrame(() => this.updateEdgeScrolling());
    }

    debugCharacterPositions() {

        const foundPC = this.getCharacterAtHex(this.game.pc.hexQ, this.game.pc.hexR);

        this.game.npcs.forEach(npc => {
            const foundNPC = this.getCharacterAtHex(npc.hexQ, npc.hexR);
        });
    }

    // Hex marker mode methods
    setHexMarkerMode(enabled, blockedHexes = []) {
        this.hexMarkerMode = enabled;
        if (enabled && blockedHexes.length > 0) {
            // Pre-populate with existing blocked hexes
            blockedHexes.forEach(hex => {
                this.markedHexes.set(`${hex.q},${hex.r}`, { q: hex.q, r: hex.r });
            });
        }
        console.log(`Hex marker mode: ${enabled ? 'ON' : 'OFF'}${enabled ? ` (${this.markedHexes.size} blocked hexes loaded)` : ''}`);
    }

    toggleMarkedHex(q, r) {
        const key = `${q},${r}`;
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