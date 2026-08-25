import { GAME_CONSTANTS, FACTIONS, ENGAGEMENT_BORDER, hexKey } from "./const.js";
import { areHostile } from "./utils.js";
import { GAME_STATES, COMBAT_ACTIONS } from "./GameStateManager.js";

export class HexGridRenderer {
    constructor(hexGrid, hexSize) {
        this.hexGrid = hexGrid;
        this.hexSize = hexSize;

        // Dependencies (injected via setDependencies)
        this.world = null;
        this.getCharacterAtHex = null;
        this.gameStateManager = null;
        this.inputHandler = null;
        this.combatInputHandler = null;
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
        // combatInputHandler is deliberately NOT required — it only feeds the
        // cosmetic invalid-target X. Hard-failing on it turns a stale browser
        // cache into a dead app instead of a missing cue.
        const required = ["game", "getCharacterAtHex", "gameStateManager", "inputHandler", "pathfinding", "engagementManager"];
        for (const dep of required) {
            if (!deps[dep]) throw new Error(`HexGridRenderer: missing required dependency '${dep}'`);
        }
        this.world = deps.world;
        this.getCharacterAtHex = deps.getCharacterAtHex;
        this.gameStateManager = deps.gameStateManager;
        this.inputHandler = deps.inputHandler;
        this.combatInputHandler = deps.combatInputHandler;
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
        if (character === this.world.pc) {
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
            if (inCombatInput && characterHere === this.world.pc) {
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

        // Draw hover highlight for valid adjacent hexes during combat input.
        // The cue follows the mode: attack mode gets the red dashed outline, so
        // the hover matches the Enter-repeat preview and the blue never implies
        // a move the click will not make.
        if (
            this.gameStateManager.currentState === GAME_STATES.COMBAT_INPUT &&
            !this.gameStateManager.characterActions.has(this.world.pc)
        ) {
            const hoveredHex = this.inputHandler?.hoveredHex;
            if (hoveredHex && hoveredHex.q === q && hoveredHex.r === r) {
                const pcHex = { q: this.world.pc.hexQ, r: this.world.pc.hexR };
                const distance = this.hexGrid.hexDistance(pcHex, { q, r });
                const occupant = this.getCharacterAtHex(q, r);
                const isBlocked = this.pathfinding?.blockedHexes?.has(
                    hexKey(q, r),
                );

                if (this.combatInputHandler?.attackModeActive) {
                    // Mirrors selectPlayerAttackTarget: adjacent, and not a body.
                    // An empty hex stays valid — that is a lead. Corpses get the
                    // orange X from drawCombatOverlays() instead.
                    if (distance === 1 && !occupant?.isDefeated) {
                        this.drawAttackTargetHex(ctx, hexPoints);
                    }
                } else if (distance === 1 && !occupant && !isBlocked) {
                    this.drawHoverHex(ctx, hexPoints);
                }
            }
        }

        // Draw repeat-attack preview (Enter target) during combat input.
        // Drawn even when occupied — seeing who you would swing at is the point.
        if (this.gameStateManager.canRepeatLastAttack()) {
            const repeatTarget = this.gameStateManager.playerLastAttackAction.target;
            if (repeatTarget.q === q && repeatTarget.r === r) {
                this.drawAttackTargetHex(ctx, hexPoints);
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

        // Only hostile neighbours get a shared edge. A different faction is not
        // enough — a guard at your shoulder must look exactly like your companion
        // there, because neither is a threat. Corpses are excluded for the same
        // reason: a body cannot swing at you.
        const roster = this._roster();
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
            if (adjCharacter && !adjCharacter.isDefeated
                && areHostile(character, adjCharacter, roster)) {
                sharedEdges.push(edgeIndex);
            }
        });

        // Draw main faction border
        this._drawHexPath(ctx, hexPoints, null, factionData.tintColor + "99", 2);

        // Draw shared borders — each edge reports who holds the flanking advantage
        sharedEdges.forEach((edgeIndex) => {
            const [dq, dr] = adjacentDirs[edgeIndex];
            const adjCharacter = this.getCharacterAtHex(q + dq, r + dr);
            const adjFactionData = this.getFactionData(adjCharacter);

            // Both hexes paint this same edge, in opposite winding order. Anchor
            // to world geometry so the two passes agree instead of overwriting
            // each other with mirrored output.
            const a = hexPoints[edgeIndex];
            const b = hexPoints[(edgeIndex + 1) % 6];
            const flip = b.x < a.x || (b.x === a.x && b.y < a.y);
            const startPoint = flip ? b : a;
            const endPoint = flip ? a : b;

            // Hostility is already established — sharedEdges only holds enemies
            const iHoldAdvantage = this.holdsFlankAdvantage(character, adjCharacter);
            const theyHoldAdvantage = this.holdsFlankAdvantage(adjCharacter, character);

            // Same canonical anchor for the colour pair, for the same reason
            const selfFirst = (character.hexQ - adjCharacter.hexQ) || (character.hexR - adjCharacter.hexR);
            const nearColor = selfFirst < 0 ? factionData.tintColor : adjFactionData.tintColor;
            const farColor = selfFirst < 0 ? adjFactionData.tintColor : factionData.tintColor;

            if (iHoldAdvantage && theyHoldAdvantage) {
                // Both exposed to each other — the deadliest pairing on the board
                this._drawMutualFlankEdge(ctx, startPoint, endPoint, nearColor, farColor);
                return;
            }

            let strokeStyle;
            if (theyHoldAdvantage || iHoldAdvantage) {
                strokeStyle = ENGAGEMENT_BORDER.FLANK_COLOR;
            } else {
                // Neither exposed: locked in, colours blend
                const gradient = ctx.createLinearGradient(
                    startPoint.x, startPoint.y,
                    endPoint.x, endPoint.y
                );
                gradient.addColorStop(0, nearColor);
                gradient.addColorStop(1, farColor);
                strokeStyle = gradient;
            }

            ctx.beginPath();
            ctx.moveTo(startPoint.x, startPoint.y);
            ctx.lineTo(endPoint.x, endPoint.y);
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = ENGAGEMENT_BORDER.EDGE_WIDTH;
            ctx.stroke();
        });
    }

    /**
     * Every character on the board, living and dead. Corpses are included on
     * purpose: a grudge lives on the body that earned it (see AISystem).
     */
    _roster() {
        return [this.world.pc, ...(this.world.npcs || [])].filter(Boolean);
    }

    /**
     * Does `attacker` hold the flanking advantage over `defender`?
     * Delegates to EngagementManager.determineFlanking — the same call
     * CombatSystem spends on THC, so the border never lies about it.
     */
    holdsFlankAdvantage(attacker, defender) {
        return this.engagementManager.determineFlanking(attacker, defender).flanking;
    }

    /**
     * Mutual flank edge: both sides hold the advantage over each other. Carries
     * all three hues — each faction colour plus the violet core — so it reads as
     * "flanking is live" while still showing who the two parties are.
     */
    _drawMutualFlankEdge(ctx, startPoint, endPoint, nearColor, farColor) {
        const gradient = ctx.createLinearGradient(
            startPoint.x, startPoint.y,
            endPoint.x, endPoint.y
        );
        gradient.addColorStop(0, nearColor);
        gradient.addColorStop(0.5, ENGAGEMENT_BORDER.FLANK_COLOR);
        gradient.addColorStop(1, farColor);

        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(endPoint.x, endPoint.y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = ENGAGEMENT_BORDER.EDGE_WIDTH;
        ctx.stroke();
    }

    drawHoverHex(ctx, hexPoints) {
        this._drawHexPath(ctx, hexPoints, "rgba(33, 150, 243, 0.25)", "rgba(33, 150, 243, 0.7)", 2);
    }

    drawSelectedHex(ctx, hexPoints) {
        this._drawHexPath(ctx, hexPoints, "rgba(173, 216, 230, 0.4)", "#87CEEB", 3);
    }

    /**
     * Combat cues that must paint on top of character sprites.
     * Called by Renderer after drawCharacters(), inside the same camera
     * transform — anything drawn from drawHex() lands underneath the sprites
     * and would be hidden by a body occupying the hex.
     */
    drawCombatOverlays(ctx) {
        if (this.gameStateManager.currentState !== GAME_STATES.COMBAT_INPUT) return;
        if (!this.combatInputHandler?.attackModeActive) return;
        if (this.gameStateManager.characterActions.has(this.world.pc)) return;

        const hoveredHex = this.inputHandler?.hoveredHex;
        if (!hoveredHex) return;

        // Only adjacent hexes are selectable in the first place
        const pcHex = { q: this.world.pc.hexQ, r: this.world.pc.hexR };
        if (this.hexGrid.hexDistance(pcHex, hoveredHex) !== 1) return;

        // A body on the hex is the rejection selectPlayerAttackTarget() makes
        const occupant = this.getCharacterAtHex(hoveredHex.q, hoveredHex.r);
        if (!occupant?.isDefeated) return;

        this.drawInvalidTargetX(ctx, this.hexGrid.hexToPixel(hoveredHex.q, hoveredHex.r));
    }

    /**
     * Orange X marking a hex that cannot be attacked (holds a defeated body).
     * Vertically compressed to sit in the isometric hex plane, and stroked
     * twice so it stays readable against light sprite pixels.
     */
    drawInvalidTargetX(ctx, center) {
        const arm = this.hexSize * 0.4;
        const armY = arm * this.hexGrid.isoRatio;

        ctx.save();
        ctx.lineCap = "round";

        ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
        ctx.lineWidth = 9;
        this._strokeX(ctx, center, arm, armY);

        ctx.strokeStyle = "#FF8C00";
        ctx.lineWidth = 5;
        this._strokeX(ctx, center, arm, armY);

        ctx.restore();
    }

    _strokeX(ctx, center, arm, armY) {
        ctx.beginPath();
        ctx.moveTo(center.x - arm, center.y - armY);
        ctx.lineTo(center.x + arm, center.y + armY);
        ctx.moveTo(center.x + arm, center.y - armY);
        ctx.lineTo(center.x - arm, center.y + armY);
        ctx.stroke();
    }

    /**
     * Preview of a hex an attack would land on — both the Enter-repeat target
     * and the hovered hex while attack mode is armed.
     * Dashed so it reads as "available" rather than the solid outline of a
     * committed selection, and red to distinguish it from move-target blues.
     * Outline only — no fill, so the hex keeps whatever faction tint it owns.
     */
    drawAttackTargetHex(ctx, hexPoints) {
        ctx.save();
        ctx.setLineDash([6, 5]);
        this._drawHexPath(ctx, hexPoints, null, "rgba(211, 47, 47, 0.8)", 2);
        ctx.restore();
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
