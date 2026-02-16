import { GAME_CONSTANTS, FACTIONS, getAnimationConfig } from "./const.js";

export class CharacterRenderer {
    constructor(hexGrid, zoomLevel) {
        this.hexGrid = hexGrid;
        this.zoomLevel = zoomLevel;

        // Dependencies (injected via setDependencies)
        this.game = null;
        this.gameStateManager = null;
        this.inputHandler = null;
    }

    setDependencies(deps) {
        const required = ["game", "gameStateManager", "inputHandler"];
        for (const dep of required) {
            if (!deps[dep]) throw new Error(`CharacterRenderer: missing required dependency '${dep}'`);
        }
        this.game = deps.game;
        this.gameStateManager = deps.gameStateManager;
        this.inputHandler = deps.inputHandler;
    }

    // Get faction display data (companions use different color than hero)
    getFactionData(character) {
        if (character === this.game.pc) {
            return FACTIONS.pc;
        }
        if (character.faction === "pc") {
            return FACTIONS.pc_ally;
        }
        return FACTIONS[character.faction] || FACTIONS.guard;
    }

    drawCharacters(ctx) {
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
        this.drawCharacter(ctx, this.game.pc);
        const pcMode = getNameplateMode(this.game.pc, true);
        if (pcMode === "full") {
            this.drawNameplate(ctx, this.game.pc, true, false);
        } else if (pcMode === "healthOnly") {
            this.drawNameplate(ctx, this.game.pc, true, true);
        }

        // Draw NPCs
        this.game.npcs.forEach((npc) => {
            this.drawCharacter(ctx, npc);
            const npcMode = getNameplateMode(npc, false);
            if (npcMode === "full") {
                this.drawNameplate(ctx, npc, false, false);
            } else if (npcMode === "healthOnly") {
                this.drawNameplate(ctx, npc, false, true);
            }
        });
    }

    isCharacterHovered(character, hoveredHex) {
        if (!hoveredHex) return false;
        return (
            character.hexQ === hoveredHex.q && character.hexR === hoveredHex.r
        );
    }

    drawCharacter(ctx, character) {
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
                ctx.drawImage(
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
                ctx.drawImage(
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
            ctx.fillStyle = factionData.tintColor;
            ctx.beginPath();
            ctx.arc(
                character.pixelX,
                character.pixelY,
                30,
                0,
                Math.PI * 2,
            );
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }

    drawNameplate(ctx, character, isPC = false, healthOnly = false) {
        const actualSpriteSize = 256 * this.zoomLevel;
        const nameplateY = character.pixelY - actualSpriteSize / 2 - 63;

        const barWidth = GAME_CONSTANTS.NAMEPLATE_WIDTH;
        const barHeight = GAME_CONSTANTS.HEALTH_BAR_HEIGHT;
        const bufferBarHeight = GAME_CONSTANTS.BUFFER_BAR_HEIGHT;

        ctx.save();

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
            ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
            ctx.fillRect(
                nameplateX,
                nameplateBackgroundY,
                nameplateWidth,
                nameplateHeight,
            );

            // Border
            ctx.strokeStyle = factionData.nameplateColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(
                nameplateX,
                nameplateBackgroundY,
                nameplateWidth,
                nameplateHeight,
            );

            // Name
            ctx.font = "bold 28px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";

            // Shadow
            ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
            ctx.fillText(
                character.name,
                character.pixelX + 2,
                nameplateY + 2,
            );

            // Text
            ctx.fillStyle = factionData.nameplateColor;
            ctx.fillText(character.name, character.pixelX, nameplateY);
        }

        // Health bar (always drawn)
        // Background
        ctx.fillStyle = "rgba(150, 0, 0, 0.9)";
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Health fill
        const healthPercent = character.health / character.maxHealth;
        const healthWidth = barWidth * healthPercent;
        ctx.fillStyle = "rgba(0, 200, 0, 0.9)";
        ctx.fillRect(barX, barY, healthWidth, barHeight);

        // Border
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.lineWidth = 3;
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        // Buffer bar (thin pink bar above health bar, only when recently hit)
        if (healthOnly && character.lastAttackedBy && character.hpBufferByAttacker) {
            const remainingBuffer = character.hpBufferByAttacker.get(character.lastAttackedBy);
            if (remainingBuffer > 0 && character.hpBufferMax > 0) {
                const bufferBarY = barY - bufferBarHeight - 1;
                const bufferPercent = remainingBuffer / character.hpBufferMax;
                const bufferWidth = barWidth * bufferPercent;

                // Buffer background (depleted portion)
                ctx.fillStyle = "rgba(80, 40, 40, 0.8)";
                ctx.fillRect(barX, bufferBarY, barWidth, bufferBarHeight);

                // Buffer fill (remaining)
                ctx.fillStyle = "rgba(255, 105, 180, 0.9)";
                ctx.fillRect(barX, bufferBarY, bufferWidth, bufferBarHeight);
            }
        }

        // Health text
        ctx.font = "bold 18px Arial";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
            `${character.health}/${character.maxHealth}`,
            character.pixelX,
            barY + barHeight / 2,
        );

        ctx.restore();
    }
}
