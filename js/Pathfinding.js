import { GAME_CONSTANTS } from './const.js';


export class Pathfinding {
    constructor(hexGrid) {
        this.hexGrid = hexGrid;
        this.maxDistance = GAME_CONSTANTS.PATHFINDING_MAX_DISTANCE;
        this.maxIterations = GAME_CONSTANTS.PATHFINDING_MAX_ITERATIONS;
        this.maxOpenSetSize = GAME_CONSTANTS.PATHFINDING_MAX_OPEN_SET;
        this.blockedHexes = new Set(); // Persistent blocked hexes from area definition
    }

    findPath(start, goal, obstacles = []) {
        // Quick distance check - if too far, don't even try
        const distance = this.hexGrid.hexDistance(start, goal);
        if (distance > this.maxDistance) {
            return [];
        }

        // Convert obstacles to a Set for faster lookups
        const obstacleSet = new Set(obstacles.map(obs => `${obs.q},${obs.r}`));

        // A* algorithm implementation
        const openSet = [start];
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        const startKey = `${start.q},${start.r}`;
        gScore.set(startKey, 0);
        fScore.set(startKey, this.hexGrid.hexDistance(start, goal));

        let iterations = 0;

        while (openSet.length > 0 && iterations < this.maxIterations) {
            iterations++;

            // Safety check - if openSet gets too big, abort
            if (openSet.length > this.maxOpenSetSize) {
                return [];
            }

            // Find node with lowest fScore
            const current = this.getLowestFScore(openSet, fScore);
            const currentIndex = openSet.indexOf(current);

            // Remove current from openSet
            openSet.splice(currentIndex, 1);
            const currentKey = `${current.q},${current.r}`;
            closedSet.add(currentKey);

            // Check if we reached the goal
            if (current.q === goal.q && current.r === goal.r) {
                return this.reconstructPath(cameFrom, current, iterations);
            }

            // Check all neighbors
            this.processNeighbors(current, goal, openSet, closedSet, cameFrom, gScore, fScore, obstacleSet);
        }

        return [];
    }

    getLowestFScore(openSet, fScore) {
        let lowest = openSet[0];
        let lowestScore = fScore.get(`${lowest.q},${lowest.r}`) || Infinity;

        for (let i = 1; i < openSet.length; i++) {
            const node = openSet[i];
            const score = fScore.get(`${node.q},${node.r}`) || Infinity;
            if (score < lowestScore) {
                lowest = node;
                lowestScore = score;
            }
        }

        return lowest;
    }

    processNeighbors(current, goal, openSet, closedSet, cameFrom, gScore, fScore, obstacleSet) {
        const neighbors = this.hexGrid.getNeighbors(current);
        const currentKey = `${current.q},${current.r}`;
        const currentGScore = gScore.get(currentKey);

        for (const neighbor of neighbors) {
            const neighborKey = `${neighbor.q},${neighbor.r}`;

            // Skip if already processed, blocked by obstacle, or blocked by terrain
            if (closedSet.has(neighborKey) || obstacleSet.has(neighborKey) || this.blockedHexes.has(neighborKey)) {
                continue;
            }

            const tentativeGScore = currentGScore + 1;
            const existingGScore = gScore.get(neighborKey) || Infinity;

            if (tentativeGScore < existingGScore) {
                // This path to neighbor is better
                cameFrom.set(neighborKey, current);
                gScore.set(neighborKey, tentativeGScore);
                fScore.set(neighborKey, tentativeGScore + this.hexGrid.hexDistance(neighbor, goal));

                // Add to openSet if not already there
                if (!this.isInOpenSet(openSet, neighbor)) {
                    openSet.push(neighbor);
                }
            }
        }
    }

    isInOpenSet(openSet, hex) {
        return openSet.some(node => node.q === hex.q && node.r === hex.r);
    }

    reconstructPath(cameFrom, current, iterations) {
        const path = [];
        let temp = current;

        while (temp) {
            path.unshift(temp);
            const tempKey = `${temp.q},${temp.r}`;
            temp = cameFrom.get(tempKey);
        }

        return path.slice(1); // Remove start position
    }

    // Configuration methods
    setMaxDistance(distance) {
        this.maxDistance = distance;
    }

    setMaxIterations(iterations) {
        this.maxIterations = iterations;
    }

    setBlockedHexes(hexes) {
        this.blockedHexes = new Set(hexes.map(h => `${h.q},${h.r}`));
    }
}