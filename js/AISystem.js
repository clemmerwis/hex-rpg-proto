export class AISystem {
    constructor(hexGrid, getCharacterAtHex) {
        this.hexGrid = hexGrid;
        this.getCharacterAtHex = getCharacterAtHex;
    }

    // Main method to get AI decision for a character
    getAIAction(character, targetCharacter, allCharacters) {
        // For now, just move toward target
        return this.getMoveTowardAction(character, targetCharacter, allCharacters);
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