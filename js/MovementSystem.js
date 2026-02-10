import { GAME_CONSTANTS, getAnimationConfig, getFacingFromDelta } from './const.js';


export class MovementSystem {
    constructor(config) {
        this.hexGrid = config.hexGrid;
        this.game = config.game;
        this.gameStateManager = config.gameStateManager;

        // Callbacks
        this.onAnimationChange = null;
        this.onDirectionChange = null;

        // Movement completion callback registry
        this.movementCompleteCallbacks = new Map(); // character -> callback
    }

    // Get the animation config for a character (uses centralized helper)
    getAnimConfigForCharacter(character, animName) {
        return getAnimationConfig(character.spriteSet, animName);
    }

    // Update all movement for all characters
    updateMovement(deltaTime) {
        // Get all characters (PC + NPCs)
        const allCharacters = [this.game.pc, ...this.game.npcs];

        allCharacters.forEach(character => {
            if (!character.isMoving || character.movementQueue.length === 0) {
                return;
            }

            // Call the existing method
            this.updateCharacterMovement(character, deltaTime);
        });
    }

    updateCharacterMovement(character, deltaTime) {
        character.currentMoveTimer += deltaTime;
        // Get current target
        const target = character.movementQueue[0];
        const targetPos = this.hexGrid.hexToPixel(target.q, target.r);

        // Calculate movement progress (0 to 1)
        const progress = Math.min(character.currentMoveTimer / character.moveSpeed, 1);

        // Track the starting hex for interpolation
        if (character.previousHexQ === undefined) {
            character.previousHexQ = character.hexQ;
            character.previousHexR = character.hexR;
        }

        // Update hex position at halfway point (claim target hex as character crosses into it)
        if (progress >= 0.5 && (character.hexQ !== target.q || character.hexR !== target.r)) {
            character.hexQ = target.q;
            character.hexR = target.r;
        }

        // Interpolate pixel position from previous hex to target
        const startPos = this.hexGrid.hexToPixel(character.previousHexQ, character.previousHexR);
        character.pixelX = startPos.x + (targetPos.x - startPos.x) * progress;
        character.pixelY = startPos.y + (targetPos.y - startPos.y) * progress;

        // Update facing direction while moving
        this.updateFacing(character, targetPos.x - startPos.x, targetPos.y - startPos.y);  // Add 'this.'

        // Set walking animation
        if (character.currentAnimation === 'idle') {
            character.currentAnimation = 'walk';
            if (this.onAnimationChange && character === this.game.pc) {
                this.onAnimationChange(character.currentAnimation);
            }
        }

        // Check if we've reached the current target
        if (progress >= 1) {
            this.completeMovementStep(character, target, targetPos);
        }
    }

    completeMovementStep(character, target, targetPos) {
        // Finalize hex position (already set in updateCharacterMovement, but ensure it's correct)
        character.hexQ = target.q;
        character.hexR = target.r;
        character.pixelX = targetPos.x;
        character.pixelY = targetPos.y;

        // Clear previous hex tracking
        character.previousHexQ = undefined;
        character.previousHexR = undefined;

        // Remove completed target
        character.movementQueue.shift();
        character.currentMoveTimer = 0;

        // Check if movement is complete
        if (character.movementQueue.length === 0) {
            character.isMoving = false;
            character.currentAnimation = 'idle';
            if (this.onAnimationChange) {
                this.onAnimationChange(character.currentAnimation);
            }

            // Fire movement complete callback if registered
            if (this.movementCompleteCallbacks.has(character)) {
                const callback = this.movementCompleteCallbacks.get(character);
                this.movementCompleteCallbacks.delete(character); // One-time callback

                // Call asynchronously to avoid blocking movement update
                setTimeout(() => {
                    try {
                        callback(true); // true = success
                    } catch (error) {
                        console.error('MovementSystem: Callback error', error);
                    }
                }, 0);
            }
        }
    }

    // Update character facing direction
    updateFacing(character, dx, dy) {
        if (dx === 0 && dy === 0) return;

        const oldFacing = character.facing;
        character.facing = getFacingFromDelta(dx, dy);

        if (oldFacing !== character.facing && this.onDirectionChange) {
            this.onDirectionChange(character.facing);
        }
    }

    // Update all animations
    updateAnimations(deltaTime) {
        // Update PC animation
        this.updateCharacterAnimation(this.game.pc, deltaTime);

        // Update NPC animations
        this.game.npcs.forEach(npc => {
            this.updateCharacterAnimation(npc, deltaTime);
        });
    }

    // Update animation for a specific character
    updateCharacterAnimation(character, deltaTime) {
        // Hold death animation on final frame
        if (character.isDefeated && character.currentAnimation === 'die') {
            const dieConfig = this.getAnimConfigForCharacter(character, 'die');
            if (dieConfig) {
                character.animationFrame = dieConfig.frameCount - 1; // Hold on last frame
            }
            return; // Don't advance animation
        }

        character.animationTimer += deltaTime;

        const animConfig = this.getAnimConfigForCharacter(character, character.currentAnimation);
        const frameSpeed = animConfig?.speed ?? GAME_CONSTANTS.ANIMATION_SPEED;

        if (character.animationTimer >= frameSpeed) {
            character.animationTimer = 0;
            const frameCount = animConfig ? animConfig.frameCount : 6;
            const nextFrame = character.animationFrame + 1;

            // Handle oneShot animations - return to idle after last frame
            if (animConfig?.oneShot && nextFrame >= frameCount) {
                character.currentAnimation = 'idle';
                character.animationFrame = 0;
            } else if (nextFrame >= frameCount) {
                // Animation loop completed
                character.animationFrame = 0;

                // Combat idle variation: occasionally play idle2
                if (character.currentAnimation === 'idle' && this.gameStateManager.isInCombat()) {
                    // Lazy init idle loop tracking
                    if (character.idleLoopCount === undefined) {
                        character.idleLoopCount = 0;
                        character.idleLoopThreshold = Math.floor(Math.random() * 5) + 4;
                    }

                    character.idleLoopCount++;
                    if (character.idleLoopCount >= character.idleLoopThreshold) {
                        character.currentAnimation = 'idle2';
                        character.animationFrame = 0;
                        character.idleLoopCount = 0;
                        character.idleLoopThreshold = Math.floor(Math.random() * 5) + 4;
                    }
                }
            } else {
                character.animationFrame = nextFrame;
            }
        }
    }

    // Start movement for a character
    startMovement(character, path) {
        if (path && path.length > 0) {
            character.movementQueue = path;
            character.isMoving = true;
            character.currentMoveTimer = 0;
        }
    }

    // Stop all movement for a character
    stopMovement(character) {
        character.isMoving = false;
        character.movementQueue = [];
        character.currentAnimation = 'idle';
        if (this.onAnimationChange) {
            this.onAnimationChange(character.currentAnimation);
        }
    }

    /**
     * Register a callback to fire when character completes movement
     * @param {Object} character - Character to watch
     * @param {Function} callback - Function to call on completion (receives success boolean)
     */
    onMovementComplete(character, callback) {
        if (!character) {
            console.error('MovementSystem.onMovementComplete: Invalid character');
            return;
        }

        if (this.movementCompleteCallbacks.has(character)) {
            console.warn('MovementSystem.onMovementComplete: Overwriting existing callback');
        }

        this.movementCompleteCallbacks.set(character, callback);
    }

    /**
     * Remove movement complete callback for character
     * @param {Object} character - Character to stop watching
     */
    removeMovementCallback(character) {
        this.movementCompleteCallbacks.delete(character);
    }

    /**
     * Clear all movement callbacks (call when exiting combat, etc.)
     */
    clearAllCallbacks() {
        this.movementCompleteCallbacks.clear();
    }
}