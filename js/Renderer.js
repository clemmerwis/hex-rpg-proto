import { GAME_CONSTANTS, getAnimationConfig } from "./const.js";

export class Renderer {
    constructor(canvas, ctx, config) {
        this.canvas = canvas;
        this.ctx = ctx;

        // Configuration
        this.viewportWidth = config.viewportWidth;
        this.viewportHeight = config.viewportHeight;
        this.worldWidth = config.worldWidth;
        this.worldHeight = config.worldHeight;
        this.zoomLevel = config.zoomLevel;
        this.hexSize = config.hexSize;

        // Dependencies (injected)
        this.game = null;
        this.hexGrid = null;
        this.gameStateManager = null;
        this.getCharacterAtHex = null;
        this.inputHandler = null;
        this.areaManager = null;
        this.pathfinding = null;
        this.hexGridRenderer = null;
    }

    setDependencies(deps) {
        const required = ['game', 'hexGrid', 'gameStateManager', 'getCharacterAtHex', 'inputHandler', 'pathfinding', 'hexGridRenderer'];
        for (const dep of required) {
            if (!deps[dep]) throw new Error(`Renderer: missing required dependency '${dep}'`);
        }
        this.game = deps.game;
        this.hexGrid = deps.hexGrid;
        this.gameStateManager = deps.gameStateManager;
        this.getCharacterAtHex = deps.getCharacterAtHex;
        this.inputHandler = deps.inputHandler;
        this.areaManager = deps.areaManager;
        this.pathfinding = deps.pathfinding;
        this.hexGridRenderer = deps.hexGridRenderer;
    }

    // Delegate to HexGridRenderer (needed by drawCharacter/drawNameplate)
    getFactionData(character) {
        return this.hexGridRenderer.getFactionData(character);
    }

    render(cameraX, cameraY, showGrid) {
        // Clear canvas
        this.ctx.fillStyle = "#2a2a2a";
        this.ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);

        this.ctx.save();
        this.ctx.scale(this.zoomLevel, this.zoomLevel);
        this.ctx.translate(
            -cameraX / this.zoomLevel,
            -cameraY / this.zoomLevel,
        );

        // Draw layers
        this.drawBackground();
        if (showGrid) {
            this.hexGridRenderer.drawHexGrid(this.ctx, cameraX, cameraY);
        }
        this.drawCharacters();

        this.ctx.restore();
    }

    drawBackground() {
        // Try to get background from AreaManager first, fallback to assets
        const background =
            this.areaManager?.getBackground() || this.game.assets.background;

        if (background) {
            this.ctx.drawImage(
                background,
                0,
                0,
                this.worldWidth,
                this.worldHeight,
            );
        } else {
            // Placeholder background
            this.ctx.fillStyle = "#1a3a1a";
            this.ctx.fillRect(0, 0, this.worldWidth, this.worldHeight);

            this.ctx.strokeStyle = "#0a2a0a";
            this.ctx.lineWidth = 1;
            for (let x = 0; x < this.worldWidth; x += 100) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, 0);
                this.ctx.lineTo(x, this.worldHeight);
                this.ctx.stroke();
            }
            for (let y = 0; y < this.worldWidth; y += 100) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(this.worldWidth, y);
                this.ctx.stroke();
            }
        }
    }

    drawCharacters() {
        const hoveredHex = this.inputHandler?.hoveredHex;
        const showAll = this.inputHandler?.isShowAllNameplates();

        // Helper to determine nameplate visibility for a character
        const getNameplateMode = (character, isPC) => {
            const isHovered = this.isCharacterHovered(character, hoveredHex);

            // Tab = all full nameplates
            if (showAll) return "full";
            // Hover = full nameplate for hovered character only
            if (isHovered) return "full";
            // Recently hit characters show health bar temporarily
            if (this.gameStateManager?.wasRecentlyHit(character))
                return "healthOnly";
            // Otherwise: hidden (active character indicated by hex glow only)
            return "hidden";
        };

        // Draw PC
        this.drawCharacter(this.game.pc);
        const pcMode = getNameplateMode(this.game.pc, true);
        if (pcMode === "full") {
            this.drawNameplate(this.game.pc, true, false);
        } else if (pcMode === "healthOnly") {
            this.drawNameplate(this.game.pc, true, true);
        }

        // Draw NPCs
        this.game.npcs.forEach((npc) => {
            this.drawCharacter(npc);
            const npcMode = getNameplateMode(npc, false);
            if (npcMode === "full") {
                this.drawNameplate(npc, false, false);
            } else if (npcMode === "healthOnly") {
                this.drawNameplate(npc, false, true);
            }
        });
    }

    isCharacterHovered(character, hoveredHex) {
        if (!hoveredHex) return false;
        return (
            character.hexQ === hoveredHex.q && character.hexR === hoveredHex.r
        );
    }

    drawCharacter(character) {
        // Get sprite set from character's spriteSet property
        const spriteSetData = this.game.assets.sprites[character.spriteSet];
        const sprite = spriteSetData?.[character.facing]?.[character.currentAnimation];

        if (sprite && sprite.complete) {
            const frameSize = GAME_CONSTANTS.SPRITE_FRAME_SIZE;
            // Get animation config (uses centralized helper with fallback)
            const animConfig = getAnimationConfig(character.spriteSet, character.currentAnimation);
            const framesPerRow = animConfig.cols;

            const col = character.animationFrame % framesPerRow;
            const row = Math.floor(character.animationFrame / framesPerRow);

            const frameX = col * frameSize;
            const frameY = row * frameSize;

            // Draw the sprite frame
            if (
                frameX + frameSize <= sprite.width &&
                frameY + frameSize <= sprite.height
            ) {
                this.ctx.drawImage(
                    sprite,
                    frameX,
                    frameY,
                    frameSize,
                    frameSize,
                    character.pixelX - frameSize / 2,
                    character.pixelY - frameSize / 2,
                    frameSize,
                    frameSize,
                );
            } else {
                // Fallback to first frame
                this.ctx.drawImage(
                    sprite,
                    0,
                    0,
                    frameSize,
                    frameSize,
                    character.pixelX - frameSize / 2,
                    character.pixelY - frameSize / 2,
                    frameSize,
                    frameSize,
                );
            }
        } else {
            // Placeholder
            const factionData = this.getFactionData(character);
            this.ctx.fillStyle = factionData.tintColor;
            this.ctx.beginPath();
            this.ctx.arc(
                character.pixelX,
                character.pixelY,
                30,
                0,
                Math.PI * 2,
            );
            this.ctx.fill();
            this.ctx.strokeStyle = "#ffffff";
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
        }
    }

    drawNameplate(character, isPC = false, healthOnly = false) {
        const actualSpriteSize = 256 * this.zoomLevel;
        const nameplateY = character.pixelY - actualSpriteSize / 2 - 63;

        const barWidth = GAME_CONSTANTS.NAMEPLATE_WIDTH;
        const barHeight = GAME_CONSTANTS.HEALTH_BAR_HEIGHT;
        const bufferBarHeight = GAME_CONSTANTS.BUFFER_BAR_HEIGHT;

        this.ctx.save();

        // Health bar position
        const barX = character.pixelX - barWidth / 2;
        const barY = healthOnly ? nameplateY + 25 : nameplateY + 8;

        if (!healthOnly) {
            const nameplatePadding = 8;
            const nameplateWidth =
                Math.max(barWidth, 120) + nameplatePadding * 2;
            const nameplateHeight = 65;
            const nameplateX = character.pixelX - nameplateWidth / 2;
            const nameplateBackgroundY = nameplateY - 40;
            const factionData = this.getFactionData(character);

            // Background
            this.ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
            this.ctx.fillRect(
                nameplateX,
                nameplateBackgroundY,
                nameplateWidth,
                nameplateHeight,
            );

            // Border
            this.ctx.strokeStyle = factionData.nameplateColor;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(
                nameplateX,
                nameplateBackgroundY,
                nameplateWidth,
                nameplateHeight,
            );

            // Name
            this.ctx.font = "bold 28px Arial";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "bottom";

            // Shadow
            this.ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
            this.ctx.fillText(
                character.name,
                character.pixelX + 2,
                nameplateY + 2,
            );

            // Text
            this.ctx.fillStyle = factionData.nameplateColor;
            this.ctx.fillText(character.name, character.pixelX, nameplateY);
        }

        // Health bar (always drawn)
        // Background
        this.ctx.fillStyle = "rgba(150, 0, 0, 0.9)";
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        // Health fill
        const healthPercent = character.health / character.maxHealth;
        const healthWidth = barWidth * healthPercent;
        this.ctx.fillStyle = "rgba(0, 200, 0, 0.9)";
        this.ctx.fillRect(barX, barY, healthWidth, barHeight);

        // Border
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(barX, barY, barWidth, barHeight);

        // Buffer bar (thin pink bar above health bar, only when recently hit)
        if (healthOnly && character.lastAttackedBy && character.hpBufferByAttacker) {
            const remainingBuffer = character.hpBufferByAttacker.get(character.lastAttackedBy);
            if (remainingBuffer > 0 && character.hpBufferMax > 0) {
                const bufferBarY = barY - bufferBarHeight - 1;
                const bufferPercent = remainingBuffer / character.hpBufferMax;
                const bufferWidth = barWidth * bufferPercent;

                // Buffer background (depleted portion)
                this.ctx.fillStyle = "rgba(80, 40, 40, 0.8)";
                this.ctx.fillRect(barX, bufferBarY, barWidth, bufferBarHeight);

                // Buffer fill (remaining)
                this.ctx.fillStyle = "rgba(255, 105, 180, 0.9)";
                this.ctx.fillRect(barX, bufferBarY, bufferWidth, bufferBarHeight);
            }
        }

        // Health text
        this.ctx.font = "bold 18px Arial";
        this.ctx.fillStyle = "white";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(
            `${character.health}/${character.maxHealth}`,
            character.pixelX,
            barY + barHeight / 2,
        );

        this.ctx.restore();
    }
}
