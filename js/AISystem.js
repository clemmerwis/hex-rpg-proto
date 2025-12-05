// Dev logging toggle - matches GameStateManager
const DEV_LOG = true;

function devLog(...args) {
    if (DEV_LOG) {
        console.log('[COMBAT DEV]', ...args);
    }
}

export class AISystem {
    constructor(hexGrid, getCharacterAtHex) {
        this.hexGrid = hexGrid;
        this.getCharacterAtHex = getCharacterAtHex;
    }

    /**
     * Main AI decision method - uses mode-based logic
     * @param {Object} character - The character making a decision
     * @param {Array} allCharacters - All living characters in combat
     */
    getAIAction(character, allCharacters) {
        const livingChars = allCharacters.filter(c => !c.isDefeated && c !== character);

        // Helper to format enemies for logging
        const enemyNames = character.enemies?.size > 0
            ? Array.from(character.enemies).map(e => e.name).join(',')
            : 'none';

        if (character.mode === 'aggressive' && character.enemies?.size > 0) {
            // AGGRESSIVE: Find closest enemy from personal enemies Set
            const livingEnemies = livingChars.filter(c => character.enemies.has(c));

            if (livingEnemies.length > 0) {
                // Check for adjacent enemy first
                const adjacentEnemy = this.findAdjacentEnemy(character, livingEnemies);
                if (adjacentEnemy) {
                    devLog(`[AI] ${character.name} (aggressive) enemies=[${enemyNames}] - adjacent to ${adjacentEnemy.name}, attacking!`);
                    return { action: 'attack', target: { q: adjacentEnemy.hexQ, r: adjacentEnemy.hexR } };
                }

                // Move toward closest enemy (prefer lastAttackedBy for ties)
                const target = this.findClosestEnemy(character, livingEnemies);
                devLog(`[AI] ${character.name} (aggressive) enemies=[${enemyNames}] - moving toward ${target.name}`);
                return this.getMoveTowardAction(character, target, allCharacters);
            }
        }

        // NEUTRAL (or aggressive with no living enemies): Move toward nearest character
        const nearest = this.findNearestCharacter(character, livingChars);
        if (nearest) {
            const dist = this.hexGrid.hexDistance(
                { q: character.hexQ, r: character.hexR },
                { q: nearest.hexQ, r: nearest.hexR }
            );
            if (dist > 1) {
                devLog(`[AI] ${character.name} (${character.mode}) - moving toward nearest: ${nearest.name}`);
                return this.getMoveTowardAction(character, nearest, allCharacters);
            } else {
                devLog(`[AI] ${character.name} (${character.mode}) - adjacent to ${nearest.name}, waiting`);
            }
        }

        // Already adjacent or no one to approach: wait
        return { action: 'wait', target: null };
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