export class EngagementManager {
    constructor(hexGrid, getCharacterAtHex, logger) {
        const params = { hexGrid, getCharacterAtHex, logger };
        for (const [name, param] of Object.entries(params)) {
            if (!param) throw new Error(`EngagementManager: missing required '${name}'`);
        }
        this.hexGrid = hexGrid;
        this.getCharacterAtHex = getCharacterAtHex;
        this.logger = logger;
    }

    /**
     * Update engagement relationships after a character moves
     * Called after movement completes in executeNextMove()
     */
    updateEngagement(character) {
        const charHex = { q: character.hexQ, r: character.hexR };
        const neighbors = this.hexGrid.getNeighbors(charHex);

        // First, clear any non-adjacent engagements
        this.clearNonAdjacentEngagements(character);

        // Then, establish new engagements with adjacent enemies
        for (const neighbor of neighbors) {
            const occupant = this.getCharacterAtHex(neighbor.q, neighbor.r);
            if (!occupant || occupant.isDefeated) continue;
            if (occupant.faction === character.faction) continue;  // Same faction - no engagement

            // Try to establish mutual engagement
            this.tryEstablishEngagement(character, occupant);
        }
    }

    /**
     * Clear engagements for characters that are no longer adjacent
     */
    clearNonAdjacentEngagements(character) {
        // Guard: skip if not initialized yet
        if (!character.engagedBy) {
            return;
        }

        const charHex = { q: character.hexQ, r: character.hexR };

        // Check all characters this one is engaging
        for (const engaged of [...character.engagedBy]) {
            const dist = this.hexGrid.hexDistance(charHex, { q: engaged.hexQ, r: engaged.hexR });
            if (dist > 1) {
                // No longer adjacent - clear mutual engagement
                character.engagedBy.delete(engaged);
                engaged.engagedBy.delete(character);
                this.logger.debug(`[ENGAGEMENT] ${character.name} and ${engaged.name} disengaged (non-adjacent)`);
            }
        }
    }

    /**
     * Try to establish engagement between two adjacent characters
     * First-come-first-serve up to engagedMax
     */
    tryEstablishEngagement(charA, charB) {
        // Guard: skip if not initialized yet
        if (!charA.engagedBy || !charB.engagedBy) {
            return;
        }

        // A tries to engage B (if A has capacity)
        if (!charA.engagedBy.has(charB) && charA.engagedBy.size < charA.engagedMax) {
            charA.engagedBy.add(charB);
            this.logger.debug(`[ENGAGEMENT] ${charA.name} now engaging ${charB.name} (${charA.engagedBy.size}/${charA.engagedMax})`);
        }

        // B tries to engage A (if B has capacity)
        if (!charB.engagedBy.has(charA) && charB.engagedBy.size < charB.engagedMax) {
            charB.engagedBy.add(charA);
            this.logger.debug(`[ENGAGEMENT] ${charB.name} now engaging ${charA.name} (${charB.engagedBy.size}/${charB.engagedMax})`);
        }
    }

    /**
     * Check if defender can engage attacker back
     * Returns false if defender's engagedBy is at max AND doesn't include attacker
     */
    canEngageBack(defender, attacker) {
        // Guard: if engagedBy not initialized, assume can engage
        if (!defender.engagedBy) {
            return true;
        }
        // If already engaging attacker, can engage back
        if (defender.engagedBy.has(attacker)) {
            return true;
        }
        // If has capacity, could engage back
        if (defender.engagedBy.size < defender.engagedMax) {
            return true;
        }
        // At max capacity and attacker not in list - cannot engage back
        return false;
    }

    /**
     * Clear all engagement tracking for all characters (called on combat exit)
     */
    clearAllEngagements(pc, npcs) {
        if (pc.engagedBy) {
            pc.engagedBy.clear();
        }
        npcs.forEach(npc => {
            if (npc.engagedBy) {
                npc.engagedBy.clear();
            }
        });
    }
}
