import { SPRITE_SETS } from './const.js';

export class AssetManager {
	constructor() {
		this.assets = {
			background: null,
			sprites: {} // sprites[setName][direction][animation]
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
		this.loadingState.totalAssets = 0;

		const directions = ['dir1', 'dir2', 'dir3', 'dir4', 'dir5', 'dir6', 'dir7', 'dir8'];
		const spriteSetNames = Object.keys(SPRITE_SETS);

		// Calculate total assets: each set has directions * animations sprites
		for (const setName of spriteSetNames) {
			const animationCount = Object.keys(SPRITE_SETS[setName].animations).length;
			this.loadingState.totalAssets += directions.length * animationCount;
		}

		// Load all sprite sets (backgrounds are loaded by AreaManager)
		for (const setName of spriteSetNames) {
			await this.loadSpriteSet(setName, directions);
		}

		this.loadingState.isLoading = false;
		return this.assets;
	}

	async loadSpriteSet(setName, directions) {
		const setConfig = SPRITE_SETS[setName];
		const animations = Object.keys(setConfig.animations);
		const loadPromises = [];

		// Initialize the sprite set structure
		this.assets.sprites[setName] = {};

		directions.forEach(dir => {
			this.assets.sprites[setName][dir] = {};

			animations.forEach(anim => {
				const promise = this.loadSprite(setName, dir, anim);
				loadPromises.push(promise);
			});
		});

		await Promise.all(loadPromises);
	}

	async loadSprite(setName, direction, animation) {
		return new Promise((resolve) => {
			const setConfig = SPRITE_SETS[setName];
			const animConfig = setConfig.animations[animation];
			const sprite = new Image();

			// animationName is required - explicit is better than implicit
			const animName = animConfig.animationName;

			// Use folder override if specified, otherwise use the set's default folder
			const folder = setConfig.folderOverrides[animation] || setConfig.folder;
			const prefix = setConfig.prefix;

			sprite.onload = () => {
				this.assets.sprites[setName][direction][animation] = sprite;
				this.incrementProgress();
				resolve();
			};

			sprite.onerror = () => {
				this.assets.sprites[setName][direction][animation] = null;
				this.incrementProgress();
				if (this.onError) {
					this.onError(`Failed to load ${prefix}_${animName}_${direction}.png`);
				}
				resolve();
			};

			sprite.src = `sprites/${folder}/${animName}/${prefix}_${animName}_${direction}.png`;
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
