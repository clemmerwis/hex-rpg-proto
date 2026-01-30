import { GAME_CONSTANTS } from "./const.js";

export class HexGrid {
    constructor(hexSize, worldWidth, worldHeight) {
        this.hexSize = hexSize;
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.isoRatio = GAME_CONSTANTS.ISO_RATIO;
        this.hexWidth = Math.sqrt(3) * hexSize;
        this.hexHeight = 2 * hexSize * this.isoRatio; // Compressed for isometric
    }

    hexToPixel(q, r) {
        const x = this.hexSize * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r) + this.worldWidth / 2;
        // Scale only the hex-relative Y, not the world center offset
        const y = this.hexSize * (3 / 2 * r) * this.isoRatio + this.worldHeight / 2;
        return { x, y };
    }

    pixelToHex(x, y) {
        x -= this.worldWidth / 2;
        y -= this.worldHeight / 2;
        // Un-scale Y before hex calculation
        y /= this.isoRatio;

        const q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / this.hexSize;
        const r = (2 / 3 * y) / this.hexSize;

        return this.roundHex(q, r);
    }

    roundHex(q, r) {
        const s = -q - r;
        let rq = Math.round(q);
        let rr = Math.round(r);
        let rs = Math.round(s);

        const q_diff = Math.abs(rq - q);
        const r_diff = Math.abs(rr - r);
        const s_diff = Math.abs(rs - s);

        if (q_diff > r_diff && q_diff > s_diff) {
            rq = -rr - rs;
        } else if (r_diff > s_diff) {
            rr = -rq - rs;
        }

        return { q: rq, r: rr };
    }

    hexDistance(hex1, hex2) {
        return (Math.abs(hex1.q - hex2.q) +
            Math.abs(hex1.q + hex1.r - hex2.q - hex2.r) +
            Math.abs(hex1.r - hex2.r)) / 2;
    }

    getNeighbors(hex) {
        const directions = [
            [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]
        ];
        return directions.map(([dq, dr]) => ({
            q: hex.q + dq,
            r: hex.r + dr
        }));
    }

    resize(width, height) {
        this.worldWidth = width;
        this.worldHeight = height;
    }
}