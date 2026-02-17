# Playwright CLI Reference

Standalone global install — no npm/npx in the project, no `node_modules`, no `package.json` needed.

## One-time setup

```bash
npm install -g playwright
playwright install chromium
```

After this, `playwright` is just a CLI tool on the machine. No `npx`, no project-level anything.

## Commands

### Screenshot a page

```bash
playwright screenshot http://localhost:8080 screenshot.png

# Full page capture
playwright screenshot --full-page http://localhost:8080 screenshot.png

# Wait for content to load before capturing
playwright screenshot --wait-for-timeout=2000 http://localhost:8080 screenshot.png
```

Primary use case with Claude Code: take a screenshot, have Claude view the image, and iterate on UI code.

### Open in inspect mode

```bash
playwright open http://localhost:8080
```

Opens a Chromium window with Playwright's inspector panel. Useful for debugging selectors and checking what Playwright "sees" on the page.

### Record actions as code

```bash
playwright codegen http://localhost:8080
```

Opens a browser in recording mode. Every click, scroll, and input gets converted to Playwright test code in real-time. Useful for generating e2e tests without writing them by hand.

## Usage with Claude Code

Instead of MCP tools, just run bash commands:

```
"Take a screenshot with: playwright screenshot http://localhost:8080 /tmp/current.png, then view the image and compare it to the reference design"
```

Claude Code can view the screenshot image and iterate on component code — bash calls instead of MCP tool calls.
