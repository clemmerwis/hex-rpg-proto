import { HexGrid } from './HexGrid.js';
import { GameStateManager, GAME_STATES, COMBAT_ACTIONS } from './GameStateManager.js';
import { Renderer } from './Renderer.js';
import { InputHandler } from './InputHandler.js';
import { AssetManager } from './AssetManager.js';
import { Pathfinding } from './Pathfinding.js';
import { MovementSystem } from './MovementSystem.js';
import { GAME_CONSTANTS, ANIMATION_CONFIGS, FACTIONS } from './const.js';

export class Game {
    constructor() {
        // Configuration
        this.config = {
            world: {
                width: GAME_CONSTANTS.WORLD_WIDTH,
                height: GAME_CONSTANTS.WORLD_HEIGHT
            },
            viewport: {
                width: Math.min(window.innerWidth * 0.9, 1600),
                height: Math.min(window.innerHeight * 0.85, 900)
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
                baseKnightSprites: {}
            },
            pc: {
                hexQ: 5,
                hexR: -5,
                pixelX: 0,
                pixelY: 0,
                facing: 'dir8',
                animationFrame: 0,
                animationTimer: 0,
                currentAnimation: 'idle',
                name: 'Hero',
                health: 85,
                maxHealth: 100,
                faction: 'player',
                movementQueue: [],
                isMoving: false,
                moveSpeed: 300,
                currentMoveTimer: 0,
                targetPixelX: 0,
                targetPixelY: 0
            },
            npcs: [
                {
                    hexQ: 7,
                    hexR: -3,
                    pixelX: 0,
                    pixelY: 0,
                    facing: 'dir4',
                    animationFrame: 3,
                    animationTimer: 75,
                    currentAnimation: 'idle',
                    name: 'Guard',
                    health: 60,
                    maxHealth: 80,
                    faction: 'ally',
                    movementQueue: [],
                    isMoving: false,
                    moveSpeed: 300,
                    currentMoveTimer: 0,
                    targetPixelX: 0,
                    targetPixelY: 0
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
                    health: 45,
                    maxHealth: 60,
                    faction: 'enemy',
                    movementQueue: [],
                    isMoving: false,
                    moveSpeed: 300,
                    currentMoveTimer: 0,
                    targetPixelX: 0,
                    targetPixelY: 0
                }
            ]
        };

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
            enemyCount: document.getElementById('enemyCount')
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

        this.gameStateManager = new GameStateManager(
            this.state,
            this.hexGrid,
            this.getCharacterAtHex.bind(this)
        );

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

        this.movementSystem = new MovementSystem({
            hexGrid: this.hexGrid,
            game: this.state,
            gameStateManager: this.gameStateManager,
            animationConfig: ANIMATION_CONFIGS
        });
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
            animationConfig: ANIMATION_CONFIGS,
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

        this.inputHandler.onSpawnEnemy = () => this.spawnEnemy();

        // AssetManager callbacks
        this.assetManager.onProgress = (percent) => {
            this.elements.loadStatus.textContent = `Loading: ${percent}%`;
        };

        this.assetManager.onComplete = () => {
            this.elements.loadStatus.textContent = 'Ready - Press 7 to spawn, Shift+Space for combat';
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
    }

    async init() {
        // Load assets
        const assets = await this.assetManager.loadAssets();
        this.state.assets = assets;
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

        this.centerCameraOn(this.state.pc.pixelX, this.state.pc.pixelY);
        this.updateGameStateUI();
        this.startGameLoop();
    }

    startGameLoop() {
        const gameLoop = () => {
            this.movementSystem.updateMovement();
            this.movementSystem.updateAnimations();
            this.inputHandler.updateKeyboardScrolling();
            this.render();
            requestAnimationFrame(gameLoop);
        };

        gameLoop();
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

    spawnEnemy() {
        const factions = ['enemy', 'ally', 'neutral'];
        const randomFaction = factions[Math.floor(Math.random() * factions.length)];

        const newEnemy = {
            hexQ: this.state.pc.hexQ + Math.floor(Math.random() * 6) - 3,
            hexR: this.state.pc.hexR + Math.floor(Math.random() * 6) - 3,
            pixelX: 0,
            pixelY: 0,
            facing: ['dir1', 'dir2', 'dir3', 'dir4', 'dir5', 'dir6', 'dir7', 'dir8'][Math.floor(Math.random() * 8)],
            animationFrame: Math.floor(Math.random() * 17),
            animationTimer: Math.floor(Math.random() * 150),
            currentAnimation: 'idle',
            name: randomFaction.charAt(0).toUpperCase() + randomFaction.slice(1),
            health: 50 + Math.floor(Math.random() * 30),
            maxHealth: 80,
            faction: randomFaction,
            // Add movement properties
            movementQueue: [],
            isMoving: false,
            moveSpeed: 300,
            currentMoveTimer: 0,
            targetPixelX: 0,
            targetPixelY: 0
        };

        const enemyPos = this.hexGrid.hexToPixel(newEnemy.hexQ, newEnemy.hexR);
        newEnemy.pixelX = enemyPos.x;
        newEnemy.pixelY = enemyPos.y;

        this.state.npcs.push(newEnemy);

        // Update combat UI if in combat
        if (this.gameStateManager.currentState === GAME_STATES.COMBAT_INPUT ||
            this.gameStateManager.currentState === GAME_STATES.COMBAT_EXECUTION) {
            this.updateGameStateUI();
        }
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

            const enemyCount = this.state.npcs.filter(npc => npc.faction === 'enemy').length;
            elements.enemyCount.textContent = enemyCount;

        } else if (currentState === GAME_STATES.COMBAT_EXECUTION) {
            elements.stateIndicator.textContent = 'COMBAT - EXECUTION';
            elements.stateIndicator.className = 'state-indicator state-combat';
            elements.combatInfo.style.display = 'block';

            elements.currentTurn.textContent = this.gameStateManager.turnNumber;

            if (this.gameStateManager.currentExecutionIndex < this.gameStateManager.executionQueue.length) {
                const executingChar = this.gameStateManager.executionQueue[this.gameStateManager.currentExecutionIndex];
                elements.activeCharacter.textContent = `${executingChar.name} Acting`;
            } else {
                elements.activeCharacter.textContent = 'All Actions Complete';
            }

            const enemyCount = this.state.npcs.filter(npc => npc.faction === 'enemy').length;
            elements.enemyCount.textContent = enemyCount;

        } else {
            elements.stateIndicator.textContent = 'EXPLORATION';
            elements.stateIndicator.className = 'state-indicator state-exploration';
            elements.combatInfo.style.display = 'none';
        }
    }
}