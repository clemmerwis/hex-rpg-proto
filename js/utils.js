/**
 * Establish mutual enemy relationship between two characters
 */
export function makeEnemies(a, b) {
    if (!a.enemies) a.enemies = new Set();
    if (!b.enemies) b.enemies = new Set();
    a.enemies.add(b);
    b.enemies.add(a);
}

/**
 * Are these two characters actually hostile to each other?
 *
 * A different faction is NOT hostility. Guards and the PC share no faction but
 * are not enemies until somebody swings, and the Companion is a separate faction
 * from the PC entirely. Hostility is a grudge: either a direct one, or one held
 * by a faction-mate of either side, since disposition is shared across a faction.
 *
 * Mirrors AISystem.getEffectiveEnemies() as a pairwise test — keep the two in
 * step. Corpses still count as grudge holders, matching the FRAGILITY note there.
 *
 * @param {Object} a
 * @param {Object} b
 * @param {Array} roster - all characters, living and dead
 */
export function areHostile(a, b, roster) {
    if (!a || !b || a === b) return false;
    if (a.enemies?.has(b) || b.enemies?.has(a)) return true;

    for (const other of roster) {
        if (other === a || other === b || !other.enemies?.size) continue;
        if (other.faction === a.faction && other.enemies.has(b)) return true;
        if (other.faction === b.faction && other.enemies.has(a)) return true;
    }
    return false;
}
