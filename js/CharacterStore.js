/**
 * CharacterStore.js - Character build persistence
 *
 * A "build" is the editable part of a character: { name, stats, skills, equipment }.
 * Game identity (faction, spriteSet, mode, facing, position) is NOT stored here -
 * that stays in NPC_TEMPLATES and area.json.
 *
 * Backed by JSON files under /characters/, served and written by nginx's WebDAV
 * module (see nginx-dev.conf). This stands in for the eventual MySQL-backed API.
 *
 * Migration path: only the four fetch() calls below change. Swap
 *   /characters/{slug}.json  ->  /api/characters/{id}
 * and every caller stays as-is.
 *
 * Loading is async, but CharacterFactory.createCharacter() is synchronous, so
 * builds are fetched once into an in-memory cache at startup (loadAll) and read
 * back synchronously (get). Call loadAll() before creating any character.
 */

const BASE_PATH = '/characters/';

export class CharacterStore {
	/** slug -> build, populated by loadAll() */
	static cache = new Map();
	static loaded = false;

	/**
	 * Filename-safe key for a character name.
	 * 'Bandit Brute' -> 'bandit_brute'
	 */
	static slug(name) {
		return String(name).trim().toLowerCase()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '');
	}

	/**
	 * List available build files via nginx's JSON autoindex.
	 * @returns {Promise<Array<string>>} Slugs, sorted
	 */
	static async list() {
		try {
			const res = await fetch(BASE_PATH, { headers: { Accept: 'application/json' } });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);

			const entries = await res.json();
			return entries
				.filter(e => e.type === 'file' && e.name.endsWith('.json'))
				.map(e => e.name.replace(/\.json$/, ''))
				.sort();
		} catch (e) {
			console.warn('[CharacterStore] Could not list builds:', e.message);
			return [];
		}
	}

	/**
	 * Fetch a single build by slug.
	 * @returns {Promise<Object|null>}
	 */
	static async fetchBuild(slug) {
		try {
			const res = await fetch(`${BASE_PATH}${slug}.json`);
			if (!res.ok) return null;
			return await res.json();
		} catch (e) {
			console.warn(`[CharacterStore] Could not read build "${slug}":`, e.message);
			return null;
		}
	}

	/**
	 * Load every build into the sync-readable cache.
	 * Must be awaited before CharacterFactory.createCharacter() is called.
	 */
	static async loadAll() {
		this.cache.clear();

		const slugs = await this.list();
		const builds = await Promise.all(slugs.map(s => this.fetchBuild(s)));

		slugs.forEach((slug, i) => {
			if (builds[i]) this.cache.set(slug, builds[i]);
		});

		this.loaded = true;
		console.info(`[CharacterStore] Loaded ${this.cache.size} character build(s): ${[...this.cache.keys()].join(', ') || 'none'}`);
		return this.cache;
	}

	/**
	 * Synchronous cache read. Used at spawn time.
	 * Accepts a build id/slug ('bandit_brute') or a character name ('Bandit Brute').
	 * Taking an explicit id is what lets several placements share one build while
	 * carrying their own display names.
	 * @returns {Object|null}
	 */
	static get(idOrName) {
		if (!this.loaded) {
			console.warn('[CharacterStore] get() called before loadAll() - no builds available');
		}
		return this.cache.get(this.slug(idOrName)) || null;
	}

	/** Build ids available to spawn, sorted */
	static ids() {
		return [...this.cache.keys()].sort();
	}

	/**
	 * Write a build. Creates or overwrites characters/{slug}.json.
	 * @returns {Promise<boolean>} Success
	 */
	static async save(build) {
		const slug = this.slug(build.name);
		if (!slug) {
			console.warn('[CharacterStore] Cannot save a build with an empty name');
			return false;
		}

		try {
			const res = await fetch(`${BASE_PATH}${slug}.json`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(build, null, '\t') + '\n',
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);

			this.cache.set(slug, build);
			return true;
		} catch (e) {
			console.error(`[CharacterStore] Failed to save "${build.name}":`, e.message);
			return false;
		}
	}

	/**
	 * Delete a build file.
	 * @returns {Promise<boolean>} Success
	 */
	static async remove(name) {
		try {
			const res = await fetch(`${BASE_PATH}${this.slug(name)}.json`, { method: 'DELETE' });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);

			this.cache.delete(this.slug(name));
			return true;
		} catch (e) {
			console.error(`[CharacterStore] Failed to delete "${name}":`, e.message);
			return false;
		}
	}
}
