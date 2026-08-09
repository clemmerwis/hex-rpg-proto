import { GAME_CONSTANTS } from './const.js';

function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
}

/**
 * Owns camera position and scroll physics.
 *
 * Input systems report a desired scroll velocity in pixels per second and this
 * class integrates it against delta time, so scrolling feels identical on a
 * 60Hz or a 144Hz display. Position stays fractional for sub-pixel smoothness;
 * only the debug readout rounds it.
 */
export class CameraController {
    /**
     * @param {object} config - Game config. Held by reference and read live, so
     *                          area transitions that resize the world are picked
     *                          up without re-wiring the camera.
     */
    constructor(config) {
        this.config = config;

        this.x = 0;
        this.y = 0;

        // Pixels per second
        this.velocityX = 0;
        this.velocityY = 0;

        this.onMove = null;
    }

    get zoom() {
        return this.config.zoom;
    }

    get maxX() {
        return Math.max(0, this.config.world.width * this.config.zoom - this.config.viewport.width);
    }

    get maxY() {
        return Math.max(0, this.config.world.height * this.config.zoom - this.config.viewport.height);
    }

    /**
     * @param {number} deltaTime - milliseconds since the previous frame
     * @param {{x: number, y: number, kick: number}} intent - desired velocity in
     *        pixels per second, plus an optional instant speed to jump to when
     *        starting from rest (see below)
     */
    update(deltaTime, intent) {
        const dt = deltaTime / 1000;
        if (dt <= 0) return;

        const targetX = intent?.x || 0;
        const targetY = intent?.y || 0;
        const kick = intent?.kick || 0;
        const targetSpeed = Math.hypot(targetX, targetY);

        // A keypress should move the camera on the very first frame instead of
        // easing up from a standstill. Applied along the direction of travel and
        // only from near-rest, so it never interrupts a scroll already up to pace.
        if (kick > 0 && targetSpeed > 0 && Math.hypot(this.velocityX, this.velocityY) < kick) {
            const kickSpeed = Math.min(kick, targetSpeed);
            this.velocityX = (targetX / targetSpeed) * kickSpeed;
            this.velocityY = (targetY / targetSpeed) * kickSpeed;
        }

        const startX = this.velocityX;
        const startY = this.velocityY;

        // Ramp the velocity vector toward the target, capping the change by its
        // magnitude rather than per-axis - otherwise a diagonal would accelerate
        // sqrt(2) times faster than a cardinal, the same way an un-normalized
        // direction would travel sqrt(2) times faster.
        const rate = (targetSpeed > 0 ? GAME_CONSTANTS.SCROLL_ACCEL : GAME_CONSTANTS.SCROLL_DECEL) * dt;
        const gapX = targetX - this.velocityX;
        const gapY = targetY - this.velocityY;
        const gap = Math.hypot(gapX, gapY);

        if (gap <= rate) {
            this.velocityX = targetX;
            this.velocityY = targetY;
        } else {
            this.velocityX += (gapX / gap) * rate;
            this.velocityY += (gapY / gap) * rate;
        }

        if (startX === 0 && startY === 0 && this.velocityX === 0 && this.velocityY === 0) return;

        // Average the frame's start and end velocity. Integrating with the end
        // velocity alone overshoots on long frames, which would make a ramping
        // scroll cover more ground at 30fps than at 144fps.
        this.moveBy((startX + this.velocityX) / 2 * dt, (startY + this.velocityY) / 2 * dt);
    }

    moveBy(dx, dy) {
        const previousX = this.x;
        const previousY = this.y;

        this.x = clamp(this.x + dx, 0, this.maxX);
        this.y = clamp(this.y + dy, 0, this.maxY);

        // Reaching a world edge drops momentum on that axis, so scrolling back
        // the other way responds immediately instead of first unwinding speed
        // that produced no visible movement.
        if (dx !== 0 && this.x === previousX) this.velocityX = 0;
        if (dy !== 0 && this.y === previousY) this.velocityY = 0;

        if (this.x !== previousX || this.y !== previousY) {
            this.onMove?.(this.x, this.y);
        }
    }

    /** Snaps the camera, dropping any momentum (used on spawn and area entry). */
    centerOn(worldX, worldY) {
        this.velocityX = 0;
        this.velocityY = 0;

        this.x = clamp((worldX * this.config.zoom) - this.config.viewport.width / 2, 0, this.maxX);
        this.y = clamp((worldY * this.config.zoom) - this.config.viewport.height / 2, 0, this.maxY);

        this.onMove?.(this.x, this.y);
    }
}
