import { HexGrid } from './HexGrid.js';
import { GameStateManager, GAME_STATES, COMBAT_ACTIONS } from './GameStateManager.js';
import { Renderer } from './Renderer.js';
import { InputHandler } from './InputHandler.js';
import { AssetManager } from './AssetManager.js';
import { AreaManager } from './AreaManager.js';
import { Pathfinding } from './Pathfinding.js';
import { MovementSystem } from './MovementSystem.js';
import { CombatSystem } from './CombatSystem.js';
import { Logger } from './Logger.js';
import { CombatUILog } from './CombatUILog.js';
import { CharacterFactory } from './CharacterFactory.js';
import { UIManager } from './UIManager.js';
import { GAME_CONSTANTS, FACTIONS, calculateMaxHP, calculateHPBuffer, calculateEngagedMax } from './const.js';
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
            pc: CharacterFactory.createCharacter({
                hexQ: 5,
                hexR: -6,
                facing: 'dir8',
                name: 'Hero',
                stats: {
                    str: 7, int: 5,
                    dex: 7, per: 6,
                    con: 7, will: 5,
                    beauty: 5, cha: 5,
                    instinct: 6, wis: 7
                }, // Total: 60 - Jack of all trades
                equipment: {
                    mainHand: 'unarmed',
                    offHand: null,
                    armor: 'scale',
                },
                faction: 'pc',
                spriteSet: 'baseKnight',
                mode: 'aggressive',
            }),
            // NPCs loaded from area.json via AreaManager (see init() method)
            // Architecture: NPCs come from templates (const.js) + placement data (area.json)
            // Future: Templates will be fetched from backend API instead of const.js
            npcs: []
        };

        // Delta time tracking for consistent timing across refresh rates
        this.lastFrameTime = null;

        // Create UI Manager
        this.uiManager = new UIManager();
        this.uiManager.initializeDOMElements();

        // Get DOM elements and canvas from UIManager
        this.elements = this.uiManager.elements;
        this.canvas = this.uiManager.canvas;
        this.ctx = this.uiManager.ctx;

        // Setup canvas
        this.setupCanvas();

        // Initialize all modules
        this.initializeModules();

        // Setup module callbacks
        this.setupCallbacks();
    }


    setupCanvas() {
        this.canvas.width = this.config.viewport.width;
        this.canvas.height = this.config.viewport.height;
    }

    initializeModules() {
        // Create logger first - it's a foundational dependency for all systems
        this.logger = new Logger();

        // Create combat UI log with logger and game references
        this.combatUILog = new CombatUILog(this.logger, this);

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

        // Initialize CombatSystem with logger
        this.combatSystem = new CombatSystem(
            this.hexGrid,
            this.getCharacterAtHex.bind(this),
            null, // Will be set after GameStateManager is created
            this.logger
        );

        // Now create GameStateManager with MovementSystem, CombatSystem, logger, and Game instance
        this.gameStateManager = new GameStateManager(
            this.state,
            this.hexGrid,
            this.getCharacterAtHex.bind(this),
            this.movementSystem,
            this.combatSystem,
            this.pathfinding,
            this.logger,
            this  // Pass the Game instance for accessing UI systems
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

        this.inputHandler.onAnimationChange = (animation) => {
            this.uiManager.updateAnimationInfo(animation);
        };

        this.inputHandler.onMarkedHexesChange = () => {
            this.updateMarkedHexCount();
        };

        // AssetManager callbacks (removed - now called at end of init())
        // this.assetManager.onComplete is not used anymore

        // MovementSystem callbacks
        this.movementSystem.onAnimationChange = (animation) => {
            this.uiManager.updateAnimationInfo(animation);
        };

        this.movementSystem.onDirectionChange = (direction) => {
            this.uiManager.updateDirectionInfo(direction);
        };

        // Setup UI event handlers through UIManager
        this.uiManager.setupEventHandlers({
            onShowGridChange: () => {
                requestAnimationFrame(() => this.render());
            },
            onHexMarkerModeChange: (e) => {
                const enabled = e.target.checked;
                // Pass existing blocked hexes when enabling marker mode
                const blockedHexes = enabled ? (this.areaManager.currentArea?.blocked || []) : [];
                this.inputHandler.setHexMarkerMode(enabled, blockedHexes);
                this.elements.hexMarkerControls.style.display = enabled ? 'block' : 'none';
                this.updateMarkedHexCount();
            },
            onExportHexes: () => {
                this.inputHandler.exportMarkedHexes();
            },
            onClearHexes: () => {
                this.inputHandler.clearMarkedHexes();
                this.updateMarkedHexCount();
            }
        });
    }

    async init() {
        try {
            // Load assets (sprites)
            const assets = await this.assetManager.loadAssets();
            this.state.assets = assets;

            // Load initial area (NPCs are instantiated inside loadArea via repository pattern)
            await this.areaManager.loadArea('bridge_crossing');

            // Retrieve instantiated NPCs from AreaManager (loaded from area.json + templates)
            this.state.npcs = this.areaManager.getNPCs();

            // Store area background for renderer fallback
            this.state.assets.background = this.areaManager.getBackground();

            // Update world dimensions from area
            const dims = this.areaManager.getDimensions();
            this.config.world.width = dims.width;
            this.config.world.height = dims.height;
            this.renderer.worldWidth = dims.width;
            this.renderer.worldHeight = dims.height;

            // NOW initialize all characters (assets and NPCs are both loaded)
            this.onAssetsLoaded();
        } catch (error) {
            console.error('Game initialization failed:', error);
            this.ctx.fillStyle = '#1a1a1a';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = '#ff4444';
            this.ctx.font = 'bold 24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Failed to load game', this.canvas.width / 2, this.canvas.height / 2 - 20);
            this.ctx.fillStyle = '#aaaaaa';
            this.ctx.font = '16px Arial';
            this.ctx.fillText(error.message || 'Check console for details', this.canvas.width / 2, this.canvas.height / 2 + 15);
        }
    }

    onAssetsLoaded() {
        // Set PC starting position (hex to pixel conversion)
        const startPos = this.hexGrid.hexToPixel(this.state.pc.hexQ, this.state.pc.hexR);
        this.state.pc.pixelX = startPos.x;
        this.state.pc.pixelY = startPos.y;

        // Set NPC starting positions (hex to pixel conversion)
        this.state.npcs.forEach(npc => {
            const npcStartPos = this.hexGrid.hexToPixel(npc.hexQ, npc.hexR);
            npc.pixelX = npcStartPos.x;
            npc.pixelY = npcStartPos.y;
        });

        // NOTE: Health, Sets, Maps already initialized by CharacterFactory
        // No need to initialize maxHealth, health, hpBufferByAttacker, enemies, engagedBy, engagedMax
        // Characters are fully ready immediately after creation

        // Set up initial hostilities (relationships between existing characters)
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

        // Initialize combat UI log after DOM is ready
        this.combatUILog.init();

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

            // Update combat log if in combat
            if (this.gameStateManager.isInCombat()) {
                this.combatUILog.update();
            }

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

        this.uiManager.updateCameraPosition(this.camera.x, this.camera.y);
    }

    updateMarkedHexCount() {
        const count = this.inputHandler.markedHexes.size;
        this.uiManager.updateMarkedHexCount(count);
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

    getAllCharacters() {
        return [this.state.pc, ...this.state.npcs];
    }

    getLivingCharacters() {
        return this.getAllCharacters().filter(c => !c.isDefeated);
    }

    updateGameStateUI() {
        this.uiManager.updateGameState(this.gameStateManager, this.state);
    }
}