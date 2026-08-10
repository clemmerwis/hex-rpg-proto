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
        // First, drop engagements that no longer hold
        const freed = this.clearStaleEngagements(character);

        // Then, establish new engagements with adjacent enemies
        this.establishAdjacentEngagements(character);

        // A departure also frees a slot on whoever was left behind, and those
        // characters may have neighbours that were locked out at max capacity.
        // Nothing else re-offers it — updateEngagement only runs for the mover —
        // so engagedBy under-reports who is actually engaged until they move.
        // canEngageBack()'s capacity test masks that for flanking, but the set
        // is still wrong for anything reading membership. The defeated case in
        // clearStaleEngagements() is the one that leaks flanking outright.
        for (const other of freed) {
            if (other.isDefeated) continue;
            this.establishAdjacentEngagements(other);
        }
    }

    /**
     * Offer engagement between a character and every adjacent enemy
     */
    establishAdjacentEngagements(character) {
        const charHex = { q: character.hexQ, r: character.hexR };

        for (const neighbor of this.hexGrid.getNeighbors(charHex)) {
            const occupant = this.getCharacterAtHex(neighbor.q, neighbor.r);
            if (!occupant || occupant.isDefeated) continue;
            if (occupant.faction === character.faction) continue;  // Same faction - no engagement

            // Try to establish mutual engagement
            this.tryEstablishEngagement(character, occupant);
        }
    }

    /**
     * Clear engagements that no longer hold - the other party has moved out of
     * reach, or has been defeated. A corpse left holding a slot blocks a living
     * attacker from being engaged, which reads as flanking.
     * Returns the characters whose own slot was freed, so callers can re-offer.
     */
    clearStaleEngagements(character) {
        // Guard: skip if not initialized yet
        if (!character.engagedBy) {
            return [];
        }

        const charHex = { q: character.hexQ, r: character.hexR };
        const freed = [];

        // Check all characters this one is engaging
        for (const engaged of [...character.engagedBy]) {
            const dist = this.hexGrid.hexDistance(charHex, { q: engaged.hexQ, r: engaged.hexR });
            const stale = dist > 1 || engaged.isDefeated;
            if (!stale) continue;

            character.engagedBy.delete(engaged);
            engaged.engagedBy?.delete(character);
            freed.push(engaged);
            const why = engaged.isDefeated ? "defeated" : "non-adjacent";
            this.logger.debug(`[ENGAGEMENT] ${character.name} and ${engaged.name} disengaged (${why})`);
        }

        return freed;
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
