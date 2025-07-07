import { GAME_STATES, COMBAT_ACTIONS } from './GameStateManager.js';
import { GAME_CONSTANTS } from './const.js';

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
        this.onSpawnEnemy = null;
        this.onMouseMove = null;

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

        if (this.onMouseMove) {
            const rect = this.canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;
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

        // Handle combat input phase
        if (this.gameStateManager.currentState === GAME_STATES.COMBAT_INPUT) {
            this.gameStateManager.selectPlayerMoveTarget(targetHex.q, targetHex.r);
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
                this.gameStateManager.characterActions.set(this.game.pc, {
                    action: COMBAT_ACTIONS.WAIT,
                    target: null
                });

                // Check if we should transition to execution
                if (this.gameStateManager.isInputPhaseComplete()) {
                    this.gameStateManager.setState(GAME_STATES.COMBAT_EXECUTION);
                }
            }
            return;
        }

        switch (e.key) {
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
                const animations = ['idle', 'walk', 'run', 'attack', 'jump', 'die'];
                const animIndex = parseInt(e.key) - 1;
                if (animIndex >= 0 && animIndex < animations.length) {
                    this.game.pc.currentAnimation = animations[animIndex];
                    this.onAnimationChange?.(animations[animIndex]);
                }
                break;

            case '7':
                this.onSpawnEnemy?.();
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

    cleanup() {
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('click', this.handleMouseClick);
        this.canvas.removeEventListener('mouseenter', this.handleMouseEnter);
        this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
    }
}