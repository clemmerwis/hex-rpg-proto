import { GAME_CONSTANTS, FACTIONS } from './const.js';
import { GAME_STATES } from './GameStateManager.js';

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
        this.inputHandler = null;
        this.areaManager = null;
        this.pathfinding = null;

        // Cache for connected blocked hexes (flood-fill)
        this._cachedConnectedBlockedHexes = null;
        this._cachedHoveredBlockedKey = null;
    }

    setDependencies(deps) {
        this.game = deps.game;
        this.hexGrid = deps.hexGrid;
        this.gameStateManager = deps.gameStateManager;
        this.getCharacterAtHex = deps.getCharacterAtHex;
        this.animationConfig = deps.animationConfig;
        this.inputHandler = deps.inputHandler;
        this.areaManager = deps.areaManager;
        this.pathfinding = deps.pathfinding;
    }

    // Get faction display data (companions use different color than hero)
    getFactionData(character) {
        if (character === this.game.pc) {
            return FACTIONS.pc;
        }
        if (character.faction === 'pc') {
            return FACTIONS.pc_ally;
        }
        return FACTIONS[character.faction] || FACTIONS.guard;
    }

    // Find all blocked hexes connected to the starting hex (flood-fill)
    getConnectedBlockedHexes(startQ, startR) {
        const connected = new Set();
        const queue = [{q: startQ, r: startR}];

        while (queue.length > 0) {
            const current = queue.shift();
            const key = `${current.q},${current.r}`;

            if (connected.has(key)) continue;
            if (!this.pathfinding?.blockedHexes?.has(key)) continue;

            connected.add(key);

            // Add all neighbors to queue
            const neighbors = this.hexGrid.getNeighbors(current);
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.q},${neighbor.r}`;
                if (!connected.has(neighborKey)) {
                    queue.push(neighbor);
                }
            }
        }

        return connected;
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
        // Try to get background from AreaManager first, fallback to assets
        const background = this.areaManager?.getBackground() || this.game.assets.background;

        if (background) {
            this.ctx.drawImage(background, 0, 0, this.worldWidth, this.worldHeight);
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

        // Draw dark overlay for blocked hexes (only when hovering blocked terrain)
        const isBlocked = this.pathfinding?.blockedHexes?.has(`${q},${r}`);
        if (isBlocked) {
            const hoveredHex = this.inputHandler?.hoveredHex;
            if (hoveredHex) {
                const hoveredKey = `${hoveredHex.q},${hoveredHex.r}`;
                const isHoveredBlocked = this.pathfinding?.blockedHexes?.has(hoveredKey);

                if (isHoveredBlocked) {
                    // Use cached connected set, or compute if hovered hex changed
                    if (this._cachedHoveredBlockedKey !== hoveredKey) {
                        this._cachedConnectedBlockedHexes = this.getConnectedBlockedHexes(hoveredHex.q, hoveredHex.r);
                        this._cachedHoveredBlockedKey = hoveredKey;
                    }

                    if (this._cachedConnectedBlockedHexes?.has(`${q},${r}`)) {
                        this.ctx.beginPath();
                        hexPoints.forEach((point, i) => {
                            if (i === 0) {
                                this.ctx.moveTo(point.x, point.y);
                            } else {
                                this.ctx.lineTo(point.x, point.y);
                            }
                        });
                        this.ctx.closePath();
                        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.20)';
                        this.ctx.fill();
                    }
                }
            }
        }

        // Draw faction borders if character present
        if (characterHere) {
            this.drawFactionBorders(hexPoints, q, r, characterHere);
        }

        // Draw hover highlight for valid adjacent hexes during combat input
        if (this.gameStateManager.currentState === GAME_STATES.COMBAT_INPUT &&
            !this.gameStateManager.characterActions.has(this.game.pc)) {
            const hoveredHex = this.inputHandler?.hoveredHex;
            if (hoveredHex && hoveredHex.q === q && hoveredHex.r === r) {
                // Check if this is a valid adjacent hex (distance 1 from player, unoccupied, not blocked)
                const pcHex = { q: this.game.pc.hexQ, r: this.game.pc.hexR };
                const distance = this.hexGrid.hexDistance(pcHex, { q, r });
                const isOccupied = this.getCharacterAtHex(q, r);
                const isBlocked = this.pathfinding?.blockedHexes?.has(`${q},${r}`);

                if (distance === 1 && !isOccupied && !isBlocked) {
                    this.drawHoverHex(hexPoints);
                }
            }
        }

        // Draw player selected move target (but not if character already there)
        if (this.gameStateManager.playerSelectedHex &&
            this.gameStateManager.playerSelectedHex.q === q &&
            this.gameStateManager.playerSelectedHex.r === r &&
            !characterHere) {
            this.drawSelectedHex(hexPoints);
        }

        // Draw marked hexes (for map editing)
        if (this.inputHandler?.markedHexes?.has(`${q},${r}`)) {
            this.drawMarkedHex(hexPoints);
        }
    }

    drawFactionBorders(hexPoints, q, r, character) {
        const factionData = this.getFactionData(character);

        // Fill hex with very transparent faction color
        this.ctx.beginPath();
        hexPoints.forEach((point, i) => {
            if (i === 0) {
                this.ctx.moveTo(point.x, point.y);
            } else {
                this.ctx.lineTo(point.x, point.y);
            }
        });
        this.ctx.closePath();
        this.ctx.fillStyle = factionData.tintColor + '25';  // Very transparent (15% opacity)
        this.ctx.fill();

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
            const adjFactionData = this.getFactionData(adjCharacter);

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

    drawHoverHex(hexPoints) {
        this.ctx.beginPath();
        hexPoints.forEach((point, i) => {
            if (i === 0) {
                this.ctx.moveTo(point.x, point.y);
            } else {
                this.ctx.lineTo(point.x, point.y);
            }
        });
        this.ctx.closePath();
        this.ctx.fillStyle = 'rgba(33, 150, 243, 0.25)';  // Blue fill
        this.ctx.fill();
        this.ctx.strokeStyle = 'rgba(33, 150, 243, 0.7)';  // Blue stroke
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
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

    drawMarkedHex(hexPoints) {
        this.ctx.beginPath();
        hexPoints.forEach((point, i) => {
            if (i === 0) {
                this.ctx.moveTo(point.x, point.y);
            } else {
                this.ctx.lineTo(point.x, point.y);
            }
        });
        this.ctx.closePath();
        this.ctx.fillStyle = 'rgba(255, 165, 0, 0.5)';  // Orange with 50% opacity
        this.ctx.fill();
        this.ctx.strokeStyle = '#FF8C00';  // Dark orange border
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
            const factionData = this.getFactionData(character);
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

        // Check if executing (but don't highlight PC faction - they stay green)
        const isExecutingCharacter = character.faction !== 'pc' &&
            this.gameStateManager.isExecutingCharacter(character);

        // Background
        this.ctx.fillStyle = isExecutingCharacter ? 'rgba(255, 255, 0, 0.3)' : 'rgba(0, 0, 0, 0.6)';
        this.ctx.fillRect(nameplateX, nameplateBackgroundY, nameplateWidth, nameplateHeight);

        // Border
        const factionData = this.getFactionData(character);
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