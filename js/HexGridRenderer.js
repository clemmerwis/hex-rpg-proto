import { GAME_CONSTANTS, FACTIONS, hexKey } from "./const.js";
import { GAME_STATES, COMBAT_ACTIONS } from "./GameStateManager.js";

export class HexGridRenderer {
    constructor(hexGrid, hexSize) {
        this.hexGrid = hexGrid;
        this.hexSize = hexSize;

        // Dependencies (injected via setDependencies)
        this.game = null;
        this.getCharacterAtHex = null;
        this.gameStateManager = null;
        this.inputHandler = null;
        this.pathfinding = null;
        this.engagementManager = null;

        // Pre-computed blocked regions (hexKey -> Set of hexKeys in same region)
        this._blockedRegionByHex = null;

        // Cache for visible hexes (avoids recalculating every frame)
        this._cachedVisibleHexes = null;
        this._cachedWorldWidth = null;
        this._cachedWorldHeight = null;
    }

    setDependencies(deps) {
        const required = ["game", "getCharacterAtHex", "gameStateManager", "inputHandler", "pathfinding", "engagementManager"];
        for (const dep of required) {
            if (!deps[dep]) throw new Error(`HexGridRenderer: missing required dependency '${dep}'`);
        }
        this.game = deps.game;
        this.getCharacterAtHex = deps.getCharacterAtHex;
        this.gameStateManager = deps.gameStateManager;
        this.inputHandler = deps.inputHandler;
        this.pathfinding = deps.pathfinding;
        this.engagementManager = deps.engagementManager;
    }

    /**
     * Get the list of visible hexes for the given world dimensions.
     * Results are cached and only recalculated when world dimensions change.
     * @param {number} worldWidth - Current world width in pixels
     * @param {number} worldHeight - Current world height in pixels
     * @returns {Array<{q: number, r: number}>} Array of visible hex coordinates
     */
    getVisibleHexes(worldWidth, worldHeight) {
        // Return cached result if world dimensions haven't changed
        if (this._cachedVisibleHexes &&
            this._cachedWorldWidth === worldWidth &&
            this._cachedWorldHeight === worldHeight) {
            return this._cachedVisibleHexes;
        }

        // Calculate hex range that covers the entire world
        const corners = [
            this.hexGrid.pixelToHex(0, 0),
            this.hexGrid.pixelToHex(worldWidth, 0),
            this.hexGrid.pixelToHex(0, worldHeight),
            this.hexGrid.pixelToHex(worldWidth, worldHeight)
        ];

        const minQ = Math.min(...corners.map(c => c.q)) - 2;
        const maxQ = Math.max(...corners.map(c => c.q)) + 2;
        const minR = Math.min(...corners.map(c => c.r)) - 2;
        const maxR = Math.max(...corners.map(c => c.r)) + 2;

        const visibleHexes = [];
        for (let q = minQ; q <= maxQ; q++) {
            for (let r = minR; r <= maxR; r++) {
                const pos = this.hexGrid.hexToPixel(q, r);
                if (
                    pos.x >= -this.hexSize &&
                    pos.x <= worldWidth + this.hexSize &&
                    pos.y >= -this.hexSize &&
                    pos.y <= worldHeight + this.hexSize
                ) {
                    visibleHexes.push({ q, r });
                }
            }
        }

        // Cache the result
        this._cachedVisibleHexes = visibleHexes;
        this._cachedWorldWidth = worldWidth;
        this._cachedWorldHeight = worldHeight;

        return visibleHexes;
    }

    /**
     * Invalidate the visible hex cache (e.g., on area transitions).
     */
    invalidateCache() {
        this._cachedVisibleHexes = null;
    }

    /**
     * Pre-compute all connected blocked regions from a set of blocked hexes.
     * Each region is a Set of hex keys that are connected via adjacency.
     * Stores a lookup: hexKey -> regionSet for O(1) region retrieval on hover.
     * @param {Set<string>} blockedHexes - Set of blocked hex keys (from pathfinding)
     */
    precomputeBlockedRegions(blockedHexes) {
        this._blockedRegionByHex = new Map();
        const visited = new Set();

        for (const key of blockedHexes) {
            if (visited.has(key)) continue;

            // Flood-fill from this hex to find its connected region
            const region = new Set();
            const [startQ, startR] = key.split(",").map(Number);
            const queue = [{ q: startQ, r: startR }];

            while (queue.length > 0) {
                const current = queue.shift();
                const currentKey = hexKey(current.q, current.r);

                if (region.has(currentKey)) continue;
                if (!blockedHexes.has(currentKey)) continue;

                region.add(currentKey);
                visited.add(currentKey);

                const neighbors = this.hexGrid.getNeighbors(current);
                for (const neighbor of neighbors) {
                    const nKey = hexKey(neighbor.q, neighbor.r);
                    if (!region.has(nKey)) queue.push(neighbor);
                }
            }

            // Map every hex in this region to the same region Set
            for (const hexKeyInRegion of region) {
                this._blockedRegionByHex.set(hexKeyInRegion, region);
            }
        }
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

    /**
     * Get all blocked hexes connected to the starting hex.
     * Uses pre-computed regions for O(1) lookup when available,
     * falls back to flood-fill if precomputeBlockedRegions was not called.
     * @param {number} startQ - Starting hex Q coordinate
     * @param {number} startR - Starting hex R coordinate
     * @returns {Set<string>} Set of connected blocked hex keys
     */
    getConnectedBlockedHexes(startQ, startR) {
        const key = hexKey(startQ, startR);

        // Use pre-computed region if available (O(1) lookup)
        if (this._blockedRegionByHex?.has(key)) {
            return this._blockedRegionByHex.get(key);
        }

        // Fallback: compute on the fly (shouldn't happen if precompute was called)
        const connected = new Set();
        const queue = [{ q: startQ, r: startR }];

        while (queue.length > 0) {
            const current = queue.shift();
            const currentKey = hexKey(current.q, current.r);

            if (connected.has(currentKey)) continue;
            if (!this.pathfinding?.blockedHexes?.has(currentKey)) continue;

            connected.add(currentKey);

            const neighbors = this.hexGrid.getNeighbors(current);
            for (const neighbor of neighbors) {
                const neighborKey = hexKey(neighbor.q, neighbor.r);
                if (!connected.has(neighborKey)) {
                    queue.push(neighbor);
                }
            }
        }

        return connected;
    }

    drawHexGrid(ctx, cameraX, cameraY) {
        const worldWidth = this.hexGrid.worldWidth;
        const worldHeight = this.hexGrid.worldHeight;

        // Use cached visible hexes (recalculates only when world dimensions change)
        const visibleHexes = this.getVisibleHexes(worldWidth, worldHeight);

        // Pass 1: Grid lines (base layer)
        const isoRatio = this.hexGrid.isoRatio;
        for (const { q, r } of visibleHexes) {
            const center = this.hexGrid.hexToPixel(q, r);
            const hexPoints = [];
            for (let i = 0; i < 6; i++) {
                const angle = ((2 * Math.PI) / 6) * i - Math.PI / 6;
                hexPoints.push({
                    x: center.x + this.hexSize * Math.cos(angle),
                    y: center.y + this.hexSize * Math.sin(angle) * isoRatio
                });
            }
            this._drawHexPath(ctx, hexPoints, null, "rgba(255, 255, 255, 1)", 1);
        }

        // Pass 2: Hex content (fills, borders, highlights on top of grid)
        for (const { q, r } of visibleHexes) {
            this.drawHex(ctx, q, r);
        }
    }

    /**
     * Helper method to draw a hex path with optional fill and stroke
     * Eliminates duplication of the hex path drawing pattern (8 instances)
     * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
     * @param {Array} hexPoints - Array of {x, y} points for hex corners
     * @param {string|null} fillStyle - Fill color (null to skip fill)
     * @param {string|null} strokeStyle - Stroke color (null to skip stroke)
     * @param {number} lineWidth - Line width for stroke (default: 1)
     */
    _drawHexPath(ctx, hexPoints, fillStyle = null, strokeStyle = null, lineWidth = 1) {
        ctx.beginPath();
        hexPoints.forEach((point, i) => {
            if (i === 0) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        });
        ctx.closePath();

        if (fillStyle) {
            ctx.fillStyle = fillStyle;
            ctx.fill();
        }

        if (strokeStyle) {
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        }
    }

    drawHex(ctx, q, r) {
        const center = this.hexGrid.hexToPixel(q, r);
        const characterHere = this.getCharacterAtHex(q, r);

        // Calculate hex corner points (with isometric Y compression)
        const isoRatio = this.hexGrid.isoRatio;
        const hexPoints = [];
        for (let i = 0; i < 6; i++) {
            const angle = ((2 * Math.PI) / 6) * i - Math.PI / 6;
            const x = center.x + this.hexSize * Math.cos(angle);
            const y = center.y + this.hexSize * Math.sin(angle) * isoRatio;
            hexPoints.push({ x, y });
        }

        // Draw dark overlay for blocked hexes (only during combat when hovering blocked terrain)
        const isBlocked = this.pathfinding?.blockedHexes?.has(hexKey(q, r));
        const inCombat =
            this.gameStateManager?.currentState !== GAME_STATES.EXPLORATION;
        if (isBlocked && inCombat) {
            const hoveredHex = this.inputHandler?.hoveredHex;
            if (hoveredHex) {
                const hoveredKey = hexKey(hoveredHex.q, hoveredHex.r);
                const isHoveredBlocked =
                    this.pathfinding?.blockedHexes?.has(hoveredKey);

                if (isHoveredBlocked) {
                    // O(1) lookup using pre-computed blocked regions
                    const connectedRegion = this.getConnectedBlockedHexes(
                        hoveredHex.q, hoveredHex.r
                    );
                    if (connectedRegion.has(hexKey(q, r))) {
                        this._drawHexPath(ctx, hexPoints, "rgba(0, 0, 0, 0.20)");
                    }
                }
            }
        }

        // Draw active character hex glow (before faction borders so gradient appears on top)
        if (characterHere) {
            const inCombatInput = this.gameStateManager?.isInCombatInput();
            const inCombatExecution =
                this.gameStateManager?.isInCombatExecution();

            // During combat input: highlight PC's hex
            if (inCombatInput && characterHere === this.game.pc) {
                this.drawActiveHexGlow(ctx, hexPoints, center, characterHere);
            }
            // During combat execution: highlight executing character's hex
            // but NOT if they've arrived at their move destination
            if (
                inCombatExecution &&
                this.gameStateManager.isExecutingCharacter(characterHere)
            ) {
                const action = this.gameStateManager.characterActions.get(characterHere);
                const isAtMoveDestination = action?.action === COMBAT_ACTIONS.MOVE &&
                    action.target.q === q && action.target.r === r;

                if (!isAtMoveDestination) {
                    this.drawActiveHexGlow(ctx, hexPoints, center, characterHere);
                }
            }
        }

        // Draw faction borders if character present
        if (characterHere) {
            this.drawFactionBorders(ctx, hexPoints, q, r, characterHere);
        }

        // Draw hover highlight for valid adjacent hexes during combat input
        if (
            this.gameStateManager.currentState === GAME_STATES.COMBAT_INPUT &&
            !this.gameStateManager.characterActions.has(this.game.pc)
        ) {
            const hoveredHex = this.inputHandler?.hoveredHex;
            if (hoveredHex && hoveredHex.q === q && hoveredHex.r === r) {
                // Check if this is a valid adjacent hex (distance 1 from player, unoccupied, not blocked)
                const pcHex = { q: this.game.pc.hexQ, r: this.game.pc.hexR };
                const distance = this.hexGrid.hexDistance(pcHex, { q, r });
                const isOccupied = this.getCharacterAtHex(q, r);
                const isBlocked = this.pathfinding?.blockedHexes?.has(
                    hexKey(q, r),
                );

                if (distance === 1 && !isOccupied && !isBlocked) {
                    this.drawHoverHex(ctx, hexPoints);
                }
            }
        }

        // Draw player selected move target (but not if character already there)
        if (
            this.gameStateManager.playerSelectedHex &&
            this.gameStateManager.playerSelectedHex.q === q &&
            this.gameStateManager.playerSelectedHex.r === r &&
            !characterHere
        ) {
            this.drawSelectedHex(ctx, hexPoints);
        }

        // Draw marked hexes (for map editing)
        if (this.inputHandler?.markedHexes?.has(hexKey(q, r))) {
            this.drawMarkedHex(ctx, hexPoints);
        }
    }

    drawFactionBorders(ctx, hexPoints, q, r, character) {
        const factionData = this.getFactionData(character);

        // Fill hex with very transparent faction color
        this._drawHexPath(ctx, hexPoints, factionData.tintColor + "25");

        // Check for adjacent different factions
        const adjacentDirs = [
            [1, 0],
            [0, 1],
            [-1, 1],
            [-1, 0],
            [0, -1],
            [1, -1],
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
        this._drawHexPath(ctx, hexPoints, null, factionData.tintColor + "99", 2);

        // Draw shared borders with engagement-aware gradients
        sharedEdges.forEach((edgeIndex) => {
            const [dq, dr] = adjacentDirs[edgeIndex];
            const adjCharacter = this.getCharacterAtHex(q + dq, r + dr);
            const adjFactionData = this.getFactionData(adjCharacter);

            const startPoint = hexPoints[edgeIndex];
            const endPoint = hexPoints[(edgeIndex + 1) % 6];

            // Check engagement status for visual indicator
            const thisCanEngageAdj = this.engagementManager?.canEngageBack(character, adjCharacter) ?? true;
            const adjCanEngageThis = this.engagementManager?.canEngageBack(adjCharacter, character) ?? true;

            let strokeStyle;
            if (thisCanEngageAdj && adjCanEngageThis) {
                // Mutual engagement: 50/50 gradient
                const gradient = ctx.createLinearGradient(
                    startPoint.x, startPoint.y,
                    endPoint.x, endPoint.y
                );
                gradient.addColorStop(0, factionData.tintColor);
                gradient.addColorStop(1, adjFactionData.tintColor);
                strokeStyle = gradient;
            } else if (!thisCanEngageAdj && adjCanEngageThis) {
                // This character cannot engage adjacent back: adjacent's color dominates (they have advantage)
                strokeStyle = adjFactionData.tintColor;
            } else if (thisCanEngageAdj && !adjCanEngageThis) {
                // Adjacent cannot engage this character back: this character's color dominates
                strokeStyle = factionData.tintColor;
            } else {
                // Neither can engage the other: neutral gradient
                const gradient = ctx.createLinearGradient(
                    startPoint.x, startPoint.y,
                    endPoint.x, endPoint.y
                );
                gradient.addColorStop(0, factionData.tintColor);
                gradient.addColorStop(1, adjFactionData.tintColor);
                strokeStyle = gradient;
            }

            ctx.beginPath();
            ctx.moveTo(startPoint.x, startPoint.y);
            ctx.lineTo(endPoint.x, endPoint.y);
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = 15;
            ctx.stroke();
        });
    }

    drawHoverHex(ctx, hexPoints) {
        this._drawHexPath(ctx, hexPoints, "rgba(33, 150, 243, 0.25)", "rgba(33, 150, 243, 0.7)", 2);
    }

    drawSelectedHex(ctx, hexPoints) {
        this._drawHexPath(ctx, hexPoints, "rgba(173, 216, 230, 0.4)", "#87CEEB", 3);
    }

    drawMarkedHex(ctx, hexPoints) {
        this._drawHexPath(ctx, hexPoints, "rgba(255, 165, 0, 0.5)", "#FF8C00", 3);
    }

    drawActiveHexGlow(ctx, hexPoints, center, character) {
        // Glowing effect using character's faction color
        const factionData = this.getFactionData(character);
        const hexColor = factionData.tintColor;

        // Convert hex to RGB for rgba usage
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);

        ctx.save();

        // Outer soft glow using faction color
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
        ctx.shadowBlur = 20;
        this._drawHexPath(ctx, hexPoints, null, `rgba(${r}, ${g}, ${b}, 0.6)`, 4);

        ctx.restore();
    }
}
