import { GAME_CONSTANTS, FACTIONS } from './const.js';

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
        this.animationConfig = null;
    }

    setDependencies(deps) {
        this.game = deps.game;
        this.hexGrid = deps.hexGrid;
        this.gameStateManager = deps.gameStateManager;
        this.getCharacterAtHex = deps.getCharacterAtHex;
        this.animationConfig = deps.animationConfig;
    }

    render(cameraX, cameraY, showGrid) {
        // Clear canvas
        this.ctx.fillStyle = '#2a2a2a';
        this.ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);

        this.ctx.save();
        this.ctx.scale(this.zoomLevel, this.zoomLevel);
        this.ctx.translate(-cameraX / this.zoomLevel, -cameraY / this.zoomLevel);

        // Draw layers
        this.drawBackground();
        if (showGrid) {
            this.drawHexGrid(cameraX, cameraY);
        }
        this.drawCharacters();

        this.ctx.restore();
    }

    drawBackground() {
        if (this.game.assets.background) {
            this.ctx.drawImage(this.game.assets.background, 0, 0, this.worldWidth, this.worldHeight);
        } else {
            // Placeholder background
            this.ctx.fillStyle = '#1a3a1a';
            this.ctx.fillRect(0, 0, this.worldWidth, this.worldHeight);

            this.ctx.strokeStyle = '#0a2a0a';
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

    drawHexGrid(cameraX, cameraY) {
        const margin = this.hexSize * 2;
        const startX = (cameraX / this.zoomLevel) - margin;
        const startY = (cameraY / this.zoomLevel) - margin;
        const endX = ((cameraX + this.viewportWidth) / this.zoomLevel) + margin;
        const endY = ((cameraY + this.viewportHeight) / this.zoomLevel) + margin;

        const startHex = this.hexGrid.pixelToHex(startX, startY);
        const endHex = this.hexGrid.pixelToHex(endX, endY);

        for (let q = startHex.q - 5; q <= endHex.q + 5; q++) {
            for (let r = startHex.r - 5; r <= endHex.r + 5; r++) {
                const pos = this.hexGrid.hexToPixel(q, r);
                if (pos.x >= -this.hexSize && pos.x <= this.worldWidth + this.hexSize &&
                    pos.y >= -this.hexSize && pos.y <= this.worldHeight + this.hexSize) {
                    this.drawHex(q, r);
                }
            }
        }
    }

    drawHex(q, r) {
        const center = this.hexGrid.hexToPixel(q, r);
        const characterHere = this.getCharacterAtHex(q, r);

        // Calculate hex corner points
        const hexPoints = [];
        for (let i = 0; i < 6; i++) {
            const angle = 2 * Math.PI / 6 * i - Math.PI / 6;
            const x = center.x + this.hexSize * Math.cos(angle);
            const y = center.y + this.hexSize * Math.sin(angle);
            hexPoints.push({ x, y });
        }

        // Draw default grid
        this.ctx.beginPath();
        hexPoints.forEach((point, i) => {
            if (i === 0) {
                this.ctx.moveTo(point.x, point.y);
            } else {
                this.ctx.lineTo(point.x, point.y);
            }
        });
        this.ctx.closePath();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        // Draw faction borders if character present
        if (characterHere) {
            this.drawFactionBorders(hexPoints, q, r, characterHere);
        }

        // Draw player selected move target
        if (this.gameStateManager.playerSelectedHex &&
            this.gameStateManager.playerSelectedHex.q === q &&
            this.gameStateManager.playerSelectedHex.r === r) {
            this.drawSelectedHex(hexPoints);
        }
    }

    drawFactionBorders(hexPoints, q, r, character) {
        const factionData = FACTIONS[character.faction] || FACTIONS.neutral;

        // Check for adjacent different factions
        const adjacentDirs = [
            [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]
        ];

        const sharedEdges = [];
        adjacentDirs.forEach((dir, edgeIndex) => {
            const [dq, dr] = dir;
            const adjCharacter = this.getCharacterAtHex(q + dq, r + dr);
            if (adjCharacter && adjCharacter.faction !== character.faction) {
                sharedEdges.push(edgeIndex);
            }
        });

        // Draw main faction border
        this.ctx.beginPath();
        hexPoints.forEach((point, i) => {
            if (i === 0) {
                this.ctx.moveTo(point.x, point.y);
            } else {
                this.ctx.lineTo(point.x, point.y);
            }
        });
        this.ctx.closePath();
        this.ctx.strokeStyle = factionData.tintColor + '99';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw shared borders
        sharedEdges.forEach(edgeIndex => {
            const [dq, dr] = adjacentDirs[edgeIndex];
            const adjCharacter = this.getCharacterAtHex(q + dq, r + dr);
            const adjFactionData = FACTIONS[adjCharacter.faction] || FACTIONS.neutral;

            const startPoint = hexPoints[edgeIndex];
            const endPoint = hexPoints[(edgeIndex + 1) % 6];

            // Create gradient
            const gradient = this.ctx.createLinearGradient(
                startPoint.x, startPoint.y,
                endPoint.x, endPoint.y
            );
            gradient.addColorStop(0, factionData.tintColor);
            gradient.addColorStop(1, adjFactionData.tintColor);

            this.ctx.beginPath();
            this.ctx.moveTo(startPoint.x, startPoint.y);
            this.ctx.lineTo(endPoint.x, endPoint.y);
            this.ctx.strokeStyle = gradient;
            this.ctx.lineWidth = 15;
            this.ctx.stroke();
        });
    }

    drawSelectedHex(hexPoints) {
        this.ctx.beginPath();
        hexPoints.forEach((point, i) => {
            if (i === 0) {
                this.ctx.moveTo(point.x, point.y);
            } else {
                this.ctx.lineTo(point.x, point.y);
            }
        });
        this.ctx.closePath();
        this.ctx.fillStyle = 'rgba(173, 216, 230, 0.4)';
        this.ctx.fill();
        this.ctx.strokeStyle = '#87CEEB';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
    }

    drawCharacters() {
        // Draw PC
        this.drawCharacter(this.game.pc);
        this.drawNameplate(this.game.pc, true);

        // Draw NPCs
        this.game.npcs.forEach(npc => {
            this.drawCharacter(npc);
            this.drawNameplate(npc, false);
        });
    }

    drawCharacter(character) {
        const sprite = this.game.assets.baseKnightSprites[character.facing] &&
            this.game.assets.baseKnightSprites[character.facing][character.currentAnimation];

        if (sprite && sprite.complete) {
            const frameSize = GAME_CONSTANTS.SPRITE_FRAME_SIZE;
            const animConfig = this.animationConfig[character.currentAnimation];
            const framesPerRow = animConfig ? animConfig.cols : Math.floor(sprite.width / frameSize);

            const col = character.animationFrame % framesPerRow;
            const row = Math.floor(character.animationFrame / framesPerRow);

            const frameX = col * frameSize;
            const frameY = row * frameSize;

            // Draw the sprite frame
            if (frameX + frameSize <= sprite.width && frameY + frameSize <= sprite.height) {
                this.ctx.drawImage(
                    sprite,
                    frameX, frameY, frameSize, frameSize,
                    character.pixelX - frameSize / 2, character.pixelY - frameSize / 2, frameSize, frameSize
                );
            } else {
                // Fallback to first frame
                this.ctx.drawImage(
                    sprite,
                    0, 0, frameSize, frameSize,
                    character.pixelX - frameSize / 2, character.pixelY - frameSize / 2, frameSize, frameSize
                );
            }
        } else {
            // Placeholder
            const factionData = FACTIONS[character.faction] || FACTIONS.neutral;
            this.ctx.fillStyle = factionData.tintColor;
            this.ctx.beginPath();
            this.ctx.arc(character.pixelX, character.pixelY, 30, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
        }
    }

    drawNameplate(character, isPC = false) {
        const actualSpriteSize = 256 * this.zoomLevel;
        const nameplateY = character.pixelY - actualSpriteSize / 2 - 45;

        const barWidth = GAME_CONSTANTS.NAMEPLATE_WIDTH;
        const barHeight = 22;
        const nameplatePadding = 8;
        const nameplateWidth = Math.max(barWidth, 120) + (nameplatePadding * 2);
        const nameplateHeight = 65;
        const nameplateX = character.pixelX - nameplateWidth / 2;
        const nameplateBackgroundY = nameplateY - 40;

        this.ctx.save();

        // Check if executing
        const isExecutingCharacter = this.gameStateManager.isExecutingCharacter(character);

        // Background
        this.ctx.fillStyle = isExecutingCharacter ? 'rgba(255, 255, 0, 0.3)' : 'rgba(0, 0, 0, 0.6)';
        this.ctx.fillRect(nameplateX, nameplateBackgroundY, nameplateWidth, nameplateHeight);

        // Border
        const factionData = FACTIONS[character.faction] || FACTIONS.neutral;
        this.ctx.strokeStyle = isExecutingCharacter ? '#ffff00' : factionData.nameplateColor;
        this.ctx.lineWidth = isExecutingCharacter ? 3 : 2;
        this.ctx.strokeRect(nameplateX, nameplateBackgroundY, nameplateWidth, nameplateHeight);

        // Name
        this.ctx.font = 'bold 28px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'bottom';

        // Shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        this.ctx.fillText(character.name, character.pixelX + 2, nameplateY + 2);

        // Text
        this.ctx.fillStyle = isExecutingCharacter ? '#ffff00' : factionData.nameplateColor;
        this.ctx.fillText(character.name, character.pixelX, nameplateY);

        // Health bar
        const barX = character.pixelX - barWidth / 2;
        const barY = nameplateY + 8;

        // Background
        this.ctx.fillStyle = 'rgba(150, 0, 0, 0.9)';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        // Health fill
        const healthPercent = character.health / character.maxHealth;
        const healthWidth = barWidth * healthPercent;
        this.ctx.fillStyle = 'rgba(0, 200, 0, 0.9)';
        this.ctx.fillRect(barX, barY, healthWidth, barHeight);

        // Border
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(barX, barY, barWidth, barHeight);

        // Health text
        this.ctx.font = 'bold 18px Arial';
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(`${character.health}/${character.maxHealth}`, character.pixelX, barY + barHeight / 2);

        this.ctx.restore();
    }
}