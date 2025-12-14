/**
 * Establish mutual enemy relationship between two characters
 */
export function makeEnemies(a, b) {
    if (!a.enemies) a.enemies = new Set();
    if (!b.enemies) b.enemies = new Set();
    a.enemies.add(b);
    b.enemies.add(a);
}
