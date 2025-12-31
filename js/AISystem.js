// Dev logging toggle - matches GameStateManager
const DEV_LOG = true;

function devLog(...args) {
    if (DEV_LOG) {
        console.log('[COMBAT DEV]', ...args);
    }
}

export class AISystem {
    constructor(hexGrid, getCharacterAtHex, pathfinding) {
        this.hexGrid = hexGrid;
        this.getCharacterAtHex = getCharacterAtHex;
        this.pathfinding = pathfinding;
    }

    /**
     * Main AI decision method - uses mode-based logic
     * @param {Object} character - The character making a decision
     * @param {Array} allCharacters - All living characters in combat
     */
    getAIAction(character, allCharacters) {
        const livingChars = allCharacters.filter(c => !c.isDefeated && c !== character);

        // Get enemies shared across faction
        const enemies = this.getEffectiveEnemies(character, allCharacters);
        const enemyNames = enemies.length > 0 ? enemies.map(e => e.name).join(',') : 'none';

        // Debug: show raw enemies set vs effective enemies
        if (character.enemies && character.enemies.size > 0) {
            const rawEnemyNames = [...character.enemies].map(e => e.name).join(',');
            devLog(`[AI] ${character.name} raw enemies=[${rawEnemyNames}], effective enemies=[${enemyNames}]`);
        }

        // Set mode based on enemy presence
        character.mode = enemies.length > 0 ? 'aggressive' : 'neutral';

        if (character.mode === 'aggressive') {
            // AGGRESSIVE: attack adjacent enemy or pursue closest
            const adjacentEnemy = this.findAdjacentEnemy(character, enemies);
            if (adjacentEnemy) {
                devLog(`[AI] ${character.name} (aggressive) enemies=[${enemyNames}] - adjacent to ${adjacentEnemy.name}, attacking!`);
                return { action: 'attack', target: { q: adjacentEnemy.hexQ, r: adjacentEnemy.hexR } };
            }

            const target = this.findClosestEnemy(character, enemies);
            if (target) {
                devLog(`[AI] ${character.name} (aggressive) enemies=[${enemyNames}] - moving toward ${target.name}`);
                return this.getMoveTowardAction(character, target, allCharacters);
            }
        }

        // NEUTRAL: cluster with faction allies or wait
        const clusterTarget = this.findClusterTarget(character, livingChars);
        if (clusterTarget) {
            const dist = this.hexGrid.hexDistance(
                { q: character.hexQ, r: character.hexR },
                { q: clusterTarget.hexQ, r: clusterTarget.hexR }
            );
            if (dist > 1) {
                devLog(`[AI] ${character.name} (neutral) - clustering toward ${clusterTarget.name}`);
                return this.getMoveTowardAction(character, clusterTarget, allCharacters);
            } else {
                devLog(`[AI] ${character.name} (neutral) - adjacent to ally ${clusterTarget.name}, waiting`);
            }
        }

        devLog(`[AI] ${character.name} (${character.mode}) - waiting`);
        return { action: 'wait', target: null };
    }

    /**
     * Get all enemies for this character (shared across faction)
     */
    getEffectiveEnemies(character, allCharacters) {
        const livingChars = allCharacters.filter(c => !c.isDefeated && c !== character);

        // Collect enemies from all same-faction characters
        const allEnemies = new Set();

        // Add own enemies
        if (character.enemies) {
            character.enemies.forEach(e => allEnemies.add(e));
        }

        // Add faction allies' enemies (shared disposition)
        allCharacters.forEach(ally => {
            if (ally.faction === character.faction && ally !== character && ally.enemies) {
                ally.enemies.forEach(e => allEnemies.add(e));
            }
        });

        // Filter to living enemies only
        return livingChars.filter(c => allEnemies.has(c));
    }

    /**
     * Find cluster target based on faction
     */
    findClusterTarget(character, livingChars) {
        // Cluster toward nearest same-faction ally
        return this.findNearestSameFaction(character, livingChars);
    }

    /**
     * Find nearest character of same faction
     */
    findNearestSameFaction(character, livingChars) {
        let nearest = null;
        let minDist = Infinity;

        for (const other of livingChars) {
            if (other.faction !== character.faction) continue;

            const dist = this.hexGrid.hexDistance(
                { q: character.hexQ, r: character.hexR },
                { q: other.hexQ, r: other.hexR }
            );
            if (dist < minDist) {
                minDist = dist;
                nearest = other;
            }
        }
        return nearest;
    }

    /**
     * Find an adjacent enemy from the provided list
     */
    findAdjacentEnemy(character, enemies) {
        const neighbors = this.hexGrid.getNeighbors({ q: character.hexQ, r: character.hexR });
        for (const hex of neighbors) {
            const occupant = this.getCharacterAtHex(hex.q, hex.r);
            if (occupant && enemies.includes(occupant) && !occupant.isDefeated) {
                return occupant;
            }
        }
        return null;
    }

    /**
     * Find closest enemy, preferring lastAttackedBy for ties
     */
    findClosestEnemy(character, enemies) {
        let closest = null;
        let minDist = Infinity;

        for (const enemy of enemies) {
            if (enemy.isDefeated) continue;  // Skip defeated enemies

            const dist = this.hexGrid.hexDistance(
                { q: character.hexQ, r: character.hexR },
                { q: enemy.hexQ, r: enemy.hexR }
            );
            if (dist < minDist || (dist === minDist && enemy === character.lastAttackedBy)) {
                minDist = dist;
                closest = enemy;
            }
        }
        return closest;
    }

    /**
     * Find nearest living character
     */
    findNearestCharacter(character, livingChars) {
        let nearest = null;
        let minDist = Infinity;

        for (const other of livingChars) {
            const dist = this.hexGrid.hexDistance(
                { q: character.hexQ, r: character.hexR },
                { q: other.hexQ, r: other.hexR }
            );
            if (dist < minDist) {
                minDist = dist;
                nearest = other;
            }
        }
        return nearest;
    }

    getMoveTowardAction(character, target, allCharacters) {
        // Get all adjacent hexes
        const neighbors = this.hexGrid.getNeighbors({
            q: character.hexQ,
            r: character.hexR
        });

        // Find the neighbor that gets us closest to target
        let bestMove = null;
        let bestDistance = Infinity;

        for (const neighbor of neighbors) {
            // Check if hex is occupied
            const occupied = this.getCharacterAtHex(neighbor.q, neighbor.r);
            if (occupied) continue;

            // Check if hex is blocked terrain
            if (this.pathfinding?.blockedHexes?.has(`${neighbor.q},${neighbor.r}`)) continue;

            // Calculate distance from this neighbor to target
            const distance = this.hexGrid.hexDistance(neighbor, {
                q: target.hexQ,
                r: target.hexR
            });

            if (distance < bestDistance) {
                bestDistance = distance;
                bestMove = neighbor;
            }
        }

        // Return move action or wait if no valid moves
        if (bestMove) {
            return {
                action: 'move',
                target: bestMove
            };
        } else {
            return {
                action: 'wait',
                target: null
            };
        }
    }
}