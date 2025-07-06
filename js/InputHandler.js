import { GAME_STATES } from './GameStateManager.js';

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
        console.log(`Clicked hex: q=${targetHex.q}, r=${targetHex.r}`);

        // Handle combat input phase
        if (this.gameStateManager.currentState === GAME_STATES.COMBAT_INPUT) {
            this.gameStateManager.selectPlayerMoveTarget(targetHex.q, targetHex.r);
            return;
        }

        // Handle exploration movement
        if (!this.gameStateManager.canPlayerMove()) {
            console.log(`Cannot move - wrong game state`);
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
            console.log(`Can't move to occupied hex: ${characterAtTarget.name}`);
            return;
        }

        // Get all obstacles
        const obstacles = this.game.npcs.map(npc => ({ q: npc.hexQ, r: npc.hexR }));

        // Find path
        const startHex = { q: this.game.pc.hexQ, r: this.game.pc.hexR };
        const path = this.findPath(startHex, targetHex, obstacles);

        if (path.length > 0) {
            console.log(`Found path with ${path.length} steps`);
            this.game.pc.movementQueue = path;
            this.game.pc.isMoving = true;
            this.game.pc.currentMoveTimer = 0;
        } else {
            console.log(`No path found to hex: q=${targetHex.q}, r=${targetHex.r}`);
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

            case 'n': // Next turn in combat (for testing)
                if (this.gameStateManager.currentState === GAME_STATES.COMBAT_INPUT) {
                    console.log('Force advancing to execution phase');
                    this.gameStateManager.setState(GAME_STATES.COMBAT_EXECUTION);
                } else if (this.gameStateManager.currentState === GAME_STATES.COMBAT_EXECUTION) {
                    console.log('Force advancing to next input phase');
                    this.gameStateManager.turnNumber++;
                    this.gameStateManager.setState(GAME_STATES.COMBAT_INPUT);
                }
                break;
        }
    }

    handleKeyUp(e) {
        this.keys[e.key] = false;
    }

    updateKeyboardScrolling() {
        const KEYBOARD_SCROLL_SPEED = 15;

        let scrollX = 0;
        let scrollY = 0;

        if (this.keys['ArrowUp'] || this.keys['w'] || this.keys['W']) scrollY -= KEYBOARD_SCROLL_SPEED;
        if (this.keys['ArrowDown'] || this.keys['s'] || this.keys['S']) scrollY += KEYBOARD_SCROLL_SPEED;
        if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) scrollX -= KEYBOARD_SCROLL_SPEED;
        if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) scrollX += KEYBOARD_SCROLL_SPEED;

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

        const EDGE_THRESHOLD = 100;
        const MAX_SCROLL_SPEED = 12;

        const rect = this.canvas.getBoundingClientRect();
        const relativeX = this.mouseX - rect.left;
        const relativeY = this.mouseY - rect.top;

        // Check if mouse is in edge zone
        const leftDistance = relativeX;
        const rightDistance = rect.width - relativeX;
        const topDistance = relativeY;
        const bottomDistance = rect.height - relativeY;

        const currentlyInEdgeZone = (
            (leftDistance < EDGE_THRESHOLD && leftDistance >= 0) ||
            (rightDistance < EDGE_THRESHOLD && rightDistance >= 0) ||
            (topDistance < EDGE_THRESHOLD && topDistance >= 0) ||
            (bottomDistance < EDGE_THRESHOLD && bottomDistance >= 0)
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

        if (leftDistance < EDGE_THRESHOLD && leftDistance >= 0) {
            const speedMultiplier = 1 - (leftDistance / EDGE_THRESHOLD);
            scrollX = -MAX_SCROLL_SPEED * speedMultiplier;
        } else if (rightDistance < EDGE_THRESHOLD && rightDistance >= 0) {
            const speedMultiplier = 1 - (rightDistance / EDGE_THRESHOLD);
            scrollX = MAX_SCROLL_SPEED * speedMultiplier;
        }

        if (topDistance < EDGE_THRESHOLD && topDistance >= 0) {
            const speedMultiplier = 1 - (topDistance / EDGE_THRESHOLD);
            scrollY = -MAX_SCROLL_SPEED * speedMultiplier;
        } else if (bottomDistance < EDGE_THRESHOLD && bottomDistance >= 0) {
            const speedMultiplier = 1 - (bottomDistance / EDGE_THRESHOLD);
            scrollY = MAX_SCROLL_SPEED * speedMultiplier;
        }

        if (scrollX !== 0 || scrollY !== 0) {
            this.onCameraUpdate?.({ scrollX, scrollY });
        }

        requestAnimationFrame(() => this.updateEdgeScrolling());
    }

    debugCharacterPositions() {
        console.log('=== CHARACTER POSITION DEBUG ===');
        console.log(`PC: hex(${this.game.pc.hexQ},${this.game.pc.hexR}) faction: ${this.game.pc.faction}`);

        const foundPC = this.getCharacterAtHex(this.game.pc.hexQ, this.game.pc.hexR);
        console.log(`Can find PC at its hex? ${foundPC ? foundPC.name : 'NO'}`);

        this.game.npcs.forEach(npc => {
            console.log(`NPC ${npc.name}: hex(${npc.hexQ},${npc.hexR}) faction: ${npc.faction}`);
            const foundNPC = this.getCharacterAtHex(npc.hexQ, npc.hexR);
            console.log(`Can find ${npc.name} at its hex? ${foundNPC ? foundNPC.name : 'NO'}`);
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