import { ANIMATION_CONFIGS } from './const.js';

export class AssetManager {
    constructor() {
        this.assets = {
            background: null,
            baseKnightSprites: {}
        };

        this.loadingState = {
            assetsLoaded: 0,
            totalAssets: 0,
            isLoading: false,
            loadPercent: 0
        };

        // Callbacks
        this.onProgress = null;
        this.onComplete = null;
        this.onError = null;
    }

    async loadAssets() {
        this.loadingState.isLoading = true;
        this.loadingState.assetsLoaded = 0;
        this.loadingState.totalAssets = 1; // Start with background

        // Count total assets (8 directions × 6 animations)
        const directions = ['dir1', 'dir2', 'dir3', 'dir4', 'dir5', 'dir6', 'dir7', 'dir8'];
        const animations = ['Idle', 'Walk', 'Run', 'Attack', 'Jump', 'Die'];
        this.loadingState.totalAssets += directions.length * animations.length;

        // Load background
        await this.loadBackground();

        // Load knight sprites
        await this.loadKnightSprites(directions, animations);

        this.loadingState.isLoading = false;
        return this.assets;
    }

    async loadBackground() {
        return new Promise((resolve) => {
            this.assets.background = new Image();

            this.assets.background.onload = () => {
                this.incrementProgress();
                resolve();
            };

            this.assets.background.onerror = () => {
                this.assets.background = null;
                this.incrementProgress();
                if (this.onError) {
                    this.onError('Background failed to load');
                }
                resolve();
            };

            this.assets.background.src = 'IsometricBridge.jpg';
        });
    }

    async loadKnightSprites(directions, animations) {
        const loadPromises = [];

        directions.forEach(dir => {
            this.assets.baseKnightSprites[dir] = {};

            animations.forEach(anim => {
                const promise = this.loadSprite(dir, anim);
                loadPromises.push(promise);
            });
        });

        await Promise.all(loadPromises);
    }

    async loadSprite(direction, animation) {
        return new Promise((resolve) => {
            const sprite = new Image();

            sprite.onload = () => {
                this.assets.baseKnightSprites[direction][animation.toLowerCase()] = sprite;
                this.incrementProgress();
                resolve();
            };

            sprite.onerror = () => {
                this.assets.baseKnightSprites[direction][animation.toLowerCase()] = null;
                this.incrementProgress();
                if (this.onError) {
                    this.onError(`Failed to load Knight_${animation}_${direction}.png`);
                }
                resolve();
            };

            sprite.src = `sprites/KnightBasic/${animation}/Knight_${animation}_${direction}.png`;
        });
    }

    incrementProgress() {
        this.loadingState.assetsLoaded++;
        this.loadingState.loadPercent = Math.round(
            (this.loadingState.assetsLoaded / this.loadingState.totalAssets) * 100
        );

        if (this.onProgress) {
            this.onProgress(this.loadingState.loadPercent);
        }

        if (this.loadingState.assetsLoaded === this.loadingState.totalAssets) {
            if (this.onComplete) {
                this.onComplete();
            }
        }
    }

    getAssets() {
        return this.assets;
    }

    isLoaded() {
        return this.loadingState.assetsLoaded === this.loadingState.totalAssets;
    }

    getLoadingProgress() {
        return this.loadingState.loadPercent;
    }
}