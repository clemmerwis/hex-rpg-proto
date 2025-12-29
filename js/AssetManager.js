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

        // Get animations from config
        const directions = ['dir1', 'dir2', 'dir3', 'dir4', 'dir5', 'dir6', 'dir7', 'dir8'];
        const animations = Object.keys(ANIMATION_CONFIGS);
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
            const animKey = animation.toLowerCase();
            const folder = ANIMATION_CONFIGS[animKey]?.folder ?? 'KnightBasic';
            // Capitalize first letter for folder/file naming
            const animName = animation.charAt(0).toUpperCase() + animation.slice(1).toLowerCase();

            sprite.onload = () => {
                this.assets.baseKnightSprites[direction][animKey] = sprite;
                this.incrementProgress();
                resolve();
            };

            sprite.onerror = () => {
                this.assets.baseKnightSprites[direction][animKey] = null;
                this.incrementProgress();
                if (this.onError) {
                    this.onError(`Failed to load Knight_${animName}_${direction}.png`);
                }
                resolve();
            };

            sprite.src = `sprites/${folder}/${animName}/Knight_${animName}_${direction}.png`;
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