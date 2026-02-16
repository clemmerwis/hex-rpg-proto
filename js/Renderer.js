export class Renderer {
    constructor(canvas, ctx, config) {
        this.canvas = canvas;
        this.ctx = ctx;

        // Configuration
        this.viewportWidth = config.viewportWidth;
        this.viewportHeight = config.viewportHeight;
        this.worldWidth = config.worldWidth;
        this.worldHeight = config.worldHeight;
        this.zoomLevel = config.zoomLevel;

        // Dependencies (injected)
        this.game = null;
        this.areaManager = null;
        this.hexGridRenderer = null;
        this.characterRenderer = null;
    }

    setDependencies(deps) {
        const required = ["game", "hexGridRenderer", "characterRenderer"];
        for (const dep of required) {
            if (!deps[dep]) throw new Error(`Renderer: missing required dependency '${dep}'`);
        }
        this.game = deps.game;
        this.areaManager = deps.areaManager;
        this.hexGridRenderer = deps.hexGridRenderer;
        this.characterRenderer = deps.characterRenderer;
    }

    render(cameraX, cameraY, showGrid) {
        // Clear canvas
        this.ctx.fillStyle = "#2a2a2a";
        this.ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);

        this.ctx.save();
        this.ctx.scale(this.zoomLevel, this.zoomLevel);
        this.ctx.translate(
            -cameraX / this.zoomLevel,
            -cameraY / this.zoomLevel,
        );

        // Draw layers
        this.drawBackground();
        if (showGrid) {
            this.hexGridRenderer.drawHexGrid(this.ctx, cameraX, cameraY);
        }
        this.characterRenderer.drawCharacters(this.ctx);

        this.ctx.restore();
    }

    drawBackground() {
        // Try to get background from AreaManager first, fallback to assets
        const background =
            this.areaManager?.getBackground() || this.game.assets.background;

        if (background) {
            this.ctx.drawImage(
                background,
                0,
                0,
                this.worldWidth,
                this.worldHeight,
            );
        } else {
            // Placeholder background
            this.ctx.fillStyle = "#1a3a1a";
            this.ctx.fillRect(0, 0, this.worldWidth, this.worldHeight);

            this.ctx.strokeStyle = "#0a2a0a";
            this.ctx.lineWidth = 1;
            for (let x = 0; x < this.worldWidth; x += 100) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, 0);
                this.ctx.lineTo(x, this.worldHeight);
                this.ctx.stroke();
            }
            for (let y = 0; y < this.worldWidth; y += 100) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(this.worldWidth, y);
                this.ctx.stroke();
            }
        }
    }
}
