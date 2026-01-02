import { HexGrid } from './HexGrid.js';
import { GameStateManager, GAME_STATES, COMBAT_ACTIONS } from './GameStateManager.js';
import { Renderer } from './Renderer.js';
import { InputHandler } from './InputHandler.js';
import { AssetManager } from './AssetManager.js';
import { AreaManager } from './AreaManager.js';
import { Pathfinding } from './Pathfinding.js';
import { MovementSystem } from './MovementSystem.js';
import { CombatSystem } from './CombatSystem.js';
import { GAME_CONSTANTS, FACTIONS, calculateMaxHP, calculateHPBuffer } from './const.js';
import { makeEnemies } from './utils.js';

export class Game {
    constructor() {
        // Configuration
        this.config = {
            world: {
                width: GAME_CONSTANTS.WORLD_WIDTH,
                height: GAME_CONSTANTS.WORLD_HEIGHT
            },
            viewport: {
                width: 1280,
                height: 720
            },
            zoom: GAME_CONSTANTS.ZOOM_LEVEL,
            hexSize: GAME_CONSTANTS.HEX_SIZE
        };

        // Camera state
        this.camera = { x: 0, y: 0 };

        // Game state
        this.state = {
            assets: {
                background: null,
                sprites: {}
            },
            pc: {
                hexQ: 5,
                hexR: -6,
                pixelX: 0,
                pixelY: 0,
                facing: 'dir8',
                animationFrame: 0,
                animationTimer: 0,
                currentAnimation: 'idle',
                name: 'Hero',
                stats: {
                    str: 7, int: 5,
                    dex: 6, per: 6,
                    con: 8, will: 5,
                    beauty: 5, cha: 6,
                    instinct: 6, wis: 6
                }, // Total: 60
                health: null,    // Set after definition
                maxHealth: null,
                hpBufferMax: null,        // Temp HP per attacker
                hpBufferByAttacker: null, // Map<attacker, remaining buffer>
                equipment: {
                    mainHand: 'unarmed',
                    offHand: null,
                },
                faction: 'pc',
                spriteSet: 'baseKnight',
                attack_rating: 15,
                defense_rating: 8,
                speed: 12,
                isDefeated: false,
                movementQueue: [],
                isMoving: false,
                moveSpeed: 300,
                currentMoveTimer: 0,
                targetPixelX: 0,
                targetPixelY: 0,
                // Disposition properties
                mode: 'aggressive',
                enemies: null,  // Initialized in onAssetsLoaded
                lastAttackedBy: null
            },
            npcs: [
                {
                    hexQ: 6,
                    hexR: -4,
                    pixelX: 0,
                    pixelY: 0,
                    facing: 'dir4',
                    animationFrame: 0,
                    animationTimer: 0,
                    currentAnimation: 'idle',
                    name: 'Companion',
                    stats: {
                        str: 5, int: 6,
                        dex: 7, per: 7,
                        con: 4, will: 6,
                        beauty: 6, cha: 6,
                        instinct: 7, wis: 6
                    }, // Total: 60
                    health: null,
                    maxHealth: null,
                    hpBufferMax: null,
                    hpBufferByAttacker: null,
                    equipment: {
                        mainHand: 'shortSword',
                        offHand: 'basicShield',
                    },
                    faction: 'pc',
                    spriteSet: 'swordShieldKnight',
                    attack_rating: 14,
                    defense_rating: 6,
                    speed: 11,
                    isDefeated: false,
                    movementQueue: [],
                    isMoving: false,
                    moveSpeed: 300,
                    currentMoveTimer: 0,
                    targetPixelX: 0,
                    targetPixelY: 0,
                    mode: 'aggressive',
                    enemies: null,
                    lastAttackedBy: null
                },
                {
                    hexQ: 8,
                    hexR: -3,
                    pixelX: 0,
                    pixelY: 0,
                    facing: 'dir5',
                    animationFrame: 3,
                    animationTimer: 75,
                    currentAnimation: 'idle',
                    name: 'Guard',
                    stats: {
                        str: 7, int: 5,
                        dex: 6, per: 7,
                        con: 7, will: 6,
                        beauty: 5, cha: 5,
                        instinct: 6, wis: 6
                    }, // Total: 60
                    health: null,
                    maxHealth: null,
                    hpBufferMax: null,
                    hpBufferByAttacker: null,
                    equipment: {
                        mainHand: 'unarmed',
                        offHand: null,
                    },
                    faction: 'guard',
                    spriteSet: 'baseKnight',
                    attack_rating: 13,
                    defense_rating: 7,
                    speed: 10,
                    isDefeated: false,
                    movementQueue: [],
                    isMoving: false,
                    moveSpeed: 300,
                    currentMoveTimer: 0,
                    targetPixelX: 0,
                    targetPixelY: 0,
                    mode: 'neutral',
                    enemies: null,
                    lastAttackedBy: null
                },
                {
                    hexQ: 9,
                    hexR: -5,
                    pixelX: 0,
                    pixelY: 0,
                    facing: 'dir3',
                    animationFrame: 5,
                    animationTimer: 50,
                    currentAnimation: 'idle',
                    name: 'Guard',
                    stats: {
                        str: 7, int: 5,
                        dex: 6, per: 7,
                        con: 7, will: 6,
                        beauty: 5, cha: 5,
                        instinct: 6, wis: 6
                    }, // Total: 60
                    health: null,
                    maxHealth: null,
                    hpBufferMax: null,
                    hpBufferByAttacker: null,
                    equipment: {
                        mainHand: 'unarmed',
                        offHand: null,
                    },
                    faction: 'guard',
                    spriteSet: 'baseKnight',
                    attack_rating: 13,
                    defense_rating: 7,
                    speed: 10,
                    isDefeated: false,
                    movementQueue: [],
                    isMoving: false,
                    moveSpeed: 300,
                    currentMoveTimer: 0,
                    targetPixelX: 0,
                    targetPixelY: 0,
                    mode: 'neutral',
                    enemies: null,
                    lastAttackedBy: null
                },
                {
                    hexQ: 3,
                    hexR: -7,
                    pixelX: 0,
                    pixelY: 0,
                    facing: 'dir6',
                    animationFrame: 8,
                    animationTimer: 25,
                    currentAnimation: 'idle',
                    name: 'Bandit',
                    stats: {
                        str: 6, int: 5,
                        dex: 8, per: 6,
                        con: 5, will: 5,
                        beauty: 4, cha: 6,
                        instinct: 8, wis: 7
                    }, // Total: 60
                    health: null,
                    maxHealth: null,
                    hpBufferMax: null,
                    hpBufferByAttacker: null,
                    equipment: {
                        mainHand: 'unarmed',
                        offHand: null,
                    },
                    faction: 'bandit',
                    spriteSet: 'baseKnight',
                    attack_rating: 12,
                    defense_rating: 5,
                    speed: 8,
                    isDefeated: false,
                    movementQueue: [],
                    isMoving: false,
                    moveSpeed: 300,
                    currentMoveTimer: 0,
                    targetPixelX: 0,
                    targetPixelY: 0,
                    mode: 'aggressive',
                    enemies: null,
                    lastAttackedBy: null
                },
                {
                    hexQ: 2,
                    hexR: -2,
                    pixelX: 0,
                    pixelY: 0,
                    facing: 'dir2',
                    animationFrame: 2,
                    animationTimer: 100,
                    currentAnimation: 'idle',
                    name: 'Bandit',
                    stats: {
                        str: 5, int: 5,
                        dex: 7, per: 7,
                        con: 6, will: 5,
                        beauty: 4, cha: 6,
                        instinct: 8, wis: 7
                    }, // Total: 60
                    health: null,
                    maxHealth: null,
                    hpBufferMax: null,
                    hpBufferByAttacker: null,
                    equipment: {
                        mainHand: 'unarmed',
                        offHand: null,
                    },
                    faction: 'bandit',
                    spriteSet: 'baseKnight',
                    attack_rating: 11,
                    defense_rating: 6,
                    speed: 9,
                    isDefeated: false,
                    movementQueue: [],
                    isMoving: false,
                    moveSpeed: 300,
                    currentMoveTimer: 0,
                    targetPixelX: 0,
                    targetPixelY: 0,
                    mode: 'aggressive',
                    enemies: null,
                    lastAttackedBy: null
                }
            ]
        };

        // Delta time tracking for consistent timing across refresh rates
        this.lastFrameTime = null;

        // Get DOM elements
        this.initializeDOMElements();

        // Setup canvas
        this.setupCanvas();

        // Initialize all modules
        this.initializeModules();

        // Setup module callbacks
        this.setupCallbacks();
    }

    initializeDOMElements() {
        // Canvas
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Debug elements
        this.elements = {
            mousePos: document.getElementById('mousePos'),
            hexPos: document.getElementById('hexPos'),
            loadStatus: document.getElementById('loadStatus'),
            showGrid: document.getElementById('showGrid'),
            cameraPos: document.getElementById('cameraPos'),
            direction: document.getElementById('directionInfo'),
            animation: document.getElementById('animationInfo'),

            // UI elements
            stateIndicator: document.getElementById('stateIndicator'),
            combatInfo: document.getElementById('combatInfo'),
            currentTurn: document.getElementById('currentTurn'),
            activeCharacter: document.getElementById('activeCharacter'),
            enemyCount: document.getElementById('enemyCount'),

            // Hex marker elements
            hexMarkerMode: document.getElementById('hexMarkerMode'),
            hexMarkerControls: document.getElementById('hexMarkerControls'),
            exportHexes: document.getElementById('exportHexes'),
            clearHexes: document.getElementById('clearHexes'),
            markedCount: document.getElementById('markedCount')
        };
    }

    setupCanvas() {
        this.canvas.width = this.config.viewport.width;
        this.canvas.height = this.config.viewport.height;
    }

    initializeModules() {
        // Core modules
        this.hexGrid = new HexGrid(
            GAME_CONSTANTS.HEX_SIZE,
            GAME_CONSTANTS.WORLD_WIDTH,
            GAME_CONSTANTS.WORLD_HEIGHT
        );

        this.pathfinding = new Pathfinding(this.hexGrid);

        // Initialize AreaManager for map loading
        this.areaManager = new AreaManager();
        this.areaManager.setDependencies({
            hexGrid: this.hexGrid,
            pathfinding: this.pathfinding,
            game: this
        });

        // Initialize MovementSystem before GameStateManager (needed for dependency injection)
        this.movementSystem = new MovementSystem({
            hexGrid: this.hexGrid,
            game: this.state,
            gameStateManager: null // Will be set after GameStateManager is created
        });

        // Initialize CombatSystem
        this.combatSystem = new CombatSystem(
            this.hexGrid,
            this.getCharacterAtHex.bind(this),
            null // Will be set after GameStateManager is created
        );

        // Now create GameStateManager with MovementSystem and CombatSystem
        this.gameStateManager = new GameStateManager(
            this.state,
            this.hexGrid,
            this.getCharacterAtHex.bind(this),
            this.movementSystem,
            this.combatSystem,
            this.pathfinding
        );

        // Set the gameStateManager reference in dependent systems (circular dependency)
        this.movementSystem.gameStateManager = this.gameStateManager;
        this.combatSystem.gameStateManager = this.gameStateManager;

        this.renderer = new Renderer(this.canvas, this.ctx, {
            viewportWidth: this.config.viewport.width,
            viewportHeight: this.config.viewport.height,
            worldWidth: this.config.world.width,
            worldHeight: this.config.world.height,
            zoomLevel: this.config.zoom,
            hexSize: this.config.hexSize
        });

        this.inputHandler = new InputHandler(this.canvas, {
            viewportWidth: this.config.viewport.width,
            viewportHeight: this.config.viewport.height
        });

        this.assetManager = new AssetManager();
    }

    setupCallbacks() {
        // GameStateManager callbacks
        this.gameStateManager.onStateChange = (newState, oldState) => {
            this.updateGameStateUI();
        };

        // Renderer dependencies
        this.renderer.setDependencies({
            game: this.state,
            hexGrid: this.hexGrid,
            gameStateManager: this.gameStateManager,
            getCharacterAtHex: this.getCharacterAtHex.bind(this),
            inputHandler: this.inputHandler,
            areaManager: this.areaManager,
            pathfinding: this.pathfinding,
        });

        // InputHandler dependencies and callbacks
        this.inputHandler.setDependencies({
            game: this.state,
            hexGrid: this.hexGrid,
            gameStateManager: this.gameStateManager,
            findPath: (start, goal, obstacles) => this.pathfinding.findPath(start, goal, obstacles),
            getCharacterAtHex: this.getCharacterAtHex.bind(this)
        });

        this.inputHandler.onCameraUpdate = (scroll) => {
            if (scroll && scroll.scrollX !== undefined) {
                this.camera.x += scroll.scrollX;
                this.camera.y += scroll.scrollY;
                this.clampCamera();
                return { x: this.camera.x, y: this.camera.y, zoom: this.config.zoom };
            }
            return { x: this.camera.x, y: this.camera.y, zoom: this.config.zoom };
        };

        this.inputHandler.onMouseMove = (canvasX, canvasY) => {
            const worldX = (canvasX + this.camera.x) / this.config.zoom;
            const worldY = (canvasY + this.camera.y) / this.config.zoom;
            this.elements.mousePos.textContent = `${Math.round(worldX)}, ${Math.round(worldY)}`;
            const hex = this.hexGrid.pixelToHex(worldX, worldY);
            this.elements.hexPos.textContent = `${hex.q}, ${hex.r}`;
        };

        this.inputHandler.onAnimationChange = (animation) => {
            this.elements.animation.textContent = animation;
        };

        this.inputHandler.onMarkedHexesChange = () => {
            this.updateMarkedHexCount();
        };

        // AssetManager callbacks
        this.assetManager.onProgress = (percent) => {
            this.elements.loadStatus.textContent = `Loading: ${percent}%`;
        };

        this.assetManager.onComplete = () => {
            this.elements.loadStatus.textContent = 'Ready - Shift+Space for combat';
            this.elements.loadStatus.style.color = '#0f0';
            this.onAssetsLoaded();
        };

        // MovementSystem callbacks
        this.movementSystem.onAnimationChange = (animation) => {
            this.elements.animation.textContent = animation;
        };

        this.movementSystem.onDirectionChange = (direction) => {
            this.elements.direction.textContent = direction;
        };

        // Checkbox event
        this.elements.showGrid.addEventListener('change', () => {
            requestAnimationFrame(() => this.render());
        });

        // Hex marker mode controls
        this.elements.hexMarkerMode.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            // Pass existing blocked hexes when enabling marker mode
            const blockedHexes = enabled ? (this.areaManager.currentArea?.blocked || []) : [];
            this.inputHandler.setHexMarkerMode(enabled, blockedHexes);
            this.elements.hexMarkerControls.style.display = enabled ? 'block' : 'none';
            this.updateMarkedHexCount();
        });

        this.elements.exportHexes.addEventListener('click', () => {
            this.inputHandler.exportMarkedHexes();
        });

        this.elements.clearHexes.addEventListener('click', () => {
            this.inputHandler.clearMarkedHexes();
            this.updateMarkedHexCount();
        });
    }

    async init() {
        // Load assets (sprites)
        const assets = await this.assetManager.loadAssets();
        this.state.assets = assets;

        // Load initial area
        await this.areaManager.loadArea('bridge_crossing');

        // Store area background for renderer fallback
        this.state.assets.background = this.areaManager.getBackground();

        // Update world dimensions from area
        const dims = this.areaManager.getDimensions();
        this.config.world.width = dims.width;
        this.config.world.height = dims.height;
        this.renderer.worldWidth = dims.width;
        this.renderer.worldHeight = dims.height;
    }

    onAssetsLoaded() {
        // Set PC starting position
        const startPos = this.hexGrid.hexToPixel(this.state.pc.hexQ, this.state.pc.hexR);
        this.state.pc.pixelX = startPos.x;
        this.state.pc.pixelY = startPos.y;

        // Set NPC starting positions
        this.state.npcs.forEach(npc => {
            const npcStartPos = this.hexGrid.hexToPixel(npc.hexQ, npc.hexR);
            npc.pixelX = npcStartPos.x;
            npc.pixelY = npcStartPos.y;
        });

        // Initialize HP and buffer from stats
        this.state.pc.maxHealth = calculateMaxHP(this.state.pc.stats);
        this.state.pc.health = this.state.pc.maxHealth;
        this.state.pc.hpBufferMax = calculateHPBuffer(this.state.pc.stats);
        this.state.pc.hpBufferByAttacker = new Map();
        this.state.npcs.forEach(npc => {
            npc.maxHealth = calculateMaxHP(npc.stats);
            npc.health = npc.maxHealth;
            npc.hpBufferMax = calculateHPBuffer(npc.stats);
            npc.hpBufferByAttacker = new Map();
        });

        // Initialize enemy Sets (can't reference objects in object literals)
        this.state.pc.enemies = new Set();
        this.state.npcs.forEach(npc => {
            npc.enemies = new Set();
        });

        // Set up initial hostilities
        const bandits = this.state.npcs.filter(n => n.faction === 'bandit');
        const pcFaction = [this.state.pc, ...this.state.npcs.filter(n => n.faction === 'pc')];
        const guards = this.state.npcs.filter(n => n.faction === 'guard');

        bandits.forEach(bandit => {
            // Bandits <-> PC faction (bidirectional)
            pcFaction.forEach(char => makeEnemies(bandit, char));

            // Bandits -> Guards (one-way, guards don't auto-aggro)
            guards.forEach(guard => bandit.enemies.add(guard));
        });

        this.centerCameraOn(this.state.pc.pixelX, this.state.pc.pixelY);
        this.updateGameStateUI();
        this.startGameLoop();
    }

    startGameLoop() {
        const gameLoop = (currentTime) => {
            // Calculate delta time
            if (this.lastFrameTime === null) {
                this.lastFrameTime = currentTime;
            }

            let deltaTime = currentTime - this.lastFrameTime;
            this.lastFrameTime = currentTime;

            // Cap delta time to prevent huge jumps (e.g., tab backgrounding)
            const MAX_DELTA_TIME = 100; // 100ms = 10fps minimum
            deltaTime = Math.min(deltaTime, MAX_DELTA_TIME);

            // Update systems with delta time
            this.movementSystem.updateMovement(deltaTime);
            this.movementSystem.updateAnimations(deltaTime);
            this.inputHandler.updateKeyboardScrolling();
            this.render();

            requestAnimationFrame(gameLoop);
        };

        requestAnimationFrame(gameLoop);
    }

    render() {
        this.renderer.render(this.camera.x, this.camera.y, this.elements.showGrid.checked);
    }

    // Helper methods
    centerCameraOn(worldX, worldY) {
        this.camera.x = (worldX * this.config.zoom) - this.config.viewport.width / 2;
        this.camera.y = (worldY * this.config.zoom) - this.config.viewport.height / 2;
        this.clampCamera();
    }

    clampCamera() {
        const maxCameraX = this.config.world.width * this.config.zoom - this.config.viewport.width;
        const maxCameraY = this.config.world.height * this.config.zoom - this.config.viewport.height;

        this.camera.x = Math.max(0, Math.min(this.camera.x, maxCameraX));
        this.camera.y = Math.max(0, Math.min(this.camera.y, maxCameraY));

        this.elements.cameraPos.textContent = `${Math.round(this.camera.x)}, ${Math.round(this.camera.y)}`;
    }

    updateMarkedHexCount() {
        const count = this.inputHandler.markedHexes.size;
        this.elements.markedCount.textContent = `Marked: ${count}`;
    }

    getCharacterAtHex(q, r) {
        // Check PC first
        if (this.state.pc.hexQ === q && this.state.pc.hexR === r) {
            return this.state.pc;
        }

        // Check NPCs
        for (let npc of this.state.npcs) {
            if (npc.hexQ === q && npc.hexR === r) {
                return npc;
            }
        }

        return null;
    }

    updateGameStateUI() {
        const elements = this.elements;
        const currentState = this.gameStateManager.currentState;

        if (currentState === GAME_STATES.COMBAT_INPUT) {
            elements.stateIndicator.textContent = 'COMBAT - INPUT PHASE';
            elements.stateIndicator.className = 'state-indicator state-combat';
            elements.combatInfo.style.display = 'block';

            elements.currentTurn.textContent = this.gameStateManager.turnNumber;
            elements.activeCharacter.textContent = this.gameStateManager.characterActions.has(this.state.pc)
                ? 'Action Chosen' : 'Choose Action';

            const enemyCount = this.state.npcs.filter(npc => npc.faction === 'bandit' && !npc.isDefeated).length;
            elements.enemyCount.textContent = enemyCount;

        } else if (currentState === GAME_STATES.COMBAT_EXECUTION) {
            elements.stateIndicator.textContent = 'COMBAT - EXECUTION';
            elements.stateIndicator.className = 'state-indicator state-combat';
            elements.combatInfo.style.display = 'block';

            elements.currentTurn.textContent = this.gameStateManager.turnNumber;

            // Show current phase and character
            const phase = this.gameStateManager.currentPhase;
            let activeChar = null;

            if (phase === 'move') {
                const idx = this.gameStateManager.currentMoveIndex;
                const queue = this.gameStateManager.moveQueue;
                if (idx < queue.length) {
                    activeChar = queue[idx];
                }
                elements.activeCharacter.textContent = activeChar
                    ? `${activeChar.name} Moving`
                    : 'Moves Complete';
            } else if (phase === 'action') {
                const idx = this.gameStateManager.currentActionIndex;
                const queue = this.gameStateManager.actionQueue;
                if (idx < queue.length) {
                    activeChar = queue[idx];
                }
                elements.activeCharacter.textContent = activeChar
                    ? `${activeChar.name} Attacking`
                    : 'Attacks Complete';
            } else {
                elements.activeCharacter.textContent = 'Preparing...';
            }

            const enemyCount = this.state.npcs.filter(npc => npc.faction === 'bandit' && !npc.isDefeated).length;
            elements.enemyCount.textContent = enemyCount;

        } else {
            elements.stateIndicator.textContent = 'EXPLORATION';
            elements.stateIndicator.className = 'state-indicator state-exploration';
            elements.combatInfo.style.display = 'none';
        }
    }
}