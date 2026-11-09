"use strict";
// Vorssaint Keep Awake — OpenDeck / Stream Deck plugin.
// Toggle: sends Vorssaint's global Keep Awake shortcut via System Events.
// State:  Vorssaint holds the IOPM assertion "Vorssaint: keep the Mac awake" while active.

const { execFile } = require("node:child_process");
const WebSocket = require("ws");

const ASSERTION = "Vorssaint: keep the Mac awake";
const POLL_MS = 2000;
const DEFAULT_SETTINGS = { key: "K", control: true, option: true, command: true, shift: false, symbol: "saturn" };

// Key images per symbol: [off, on]. Paths are relative to the plugin folder.
const SYMBOLS = {
	saturn: ["imgs/off", "imgs/on"],
	coffee: ["imgs/coffee-off", "imgs/coffee-on"],
};

// ANSI virtual key codes (layout independent, same as Vorssaint's kVK_ANSI_*).
const KEY_CODES = {
	A: 0, S: 1, D: 2, F: 3, H: 4, G: 5, Z: 6, X: 7, C: 8, V: 9, B: 11, Q: 12, W: 13, E: 14, R: 15,
	Y: 16, T: 17, "1": 18, "2": 19, "3": 20, "4": 21, "6": 22, "5": 23, "9": 25, "7": 26, "8": 28,
	"0": 29, O: 31, U: 32, I: 34, P: 35, L: 37, J: 38, K: 40, N: 45, M: 46,
};

function arg(name) {
	const i = process.argv.indexOf(name);
	return i >= 0 ? process.argv[i + 1] : undefined;
}

const port = arg("-port");
const pluginUUID = arg("-pluginUUID");
const registerEvent = arg("-registerEvent");
if (!port || !pluginUUID || !registerEvent) {
	console.error("Missing launch arguments", process.argv.slice(2));
	process.exit(1);
}

const contexts = new Set();
let settings = { ...DEFAULT_SETTINGS };
let lastState = null;
let pollTimer = null;

const ws = new WebSocket(`ws://127.0.0.1:${port}`);
const send = (msg) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg));

function run(cmd, args) {
	return new Promise((resolve) => {
		execFile(cmd, args, { timeout: 5000 }, (error, stdout, stderr) => resolve({ error, stdout: stdout || "", stderr: stderr || "" }));
	});
}

async function isRunning() {
	const { error } = await run("/usr/bin/pgrep", ["-x", "Vorssaint"]);
	return !error;
}

async function isKeepAwakeActive() {
	const { stdout } = await run("/usr/bin/pmset", ["-g", "assertions"]);
	return stdout.includes(ASSERTION);
}

function applySymbol(context) {
	const images = SYMBOLS[settings.symbol] || SYMBOLS.saturn;
	images.forEach((image, state) => send({ event: "setImage", context, payload: { image, state } }));
}

function applyState(state, force = false) {
	if (!force && state === lastState) return;
	lastState = state;
	console.log(`state -> ${state} (${contexts.size} key(s))`);
	for (const context of contexts) send({ event: "setState", context, payload: { state } });
}

async function refresh(force = false) {
	if (contexts.size === 0) return;
	applyState((await isKeepAwakeActive()) ? 1 : 0, force);
}

function startPolling() {
	if (pollTimer) return;
	pollTimer = setInterval(() => refresh(), POLL_MS);
}

function stopPollingIfIdle() {
	if (contexts.size === 0 && pollTimer) {
		clearInterval(pollTimer);
		pollTimer = null;
		lastState = null;
	}
}

function shortcutScript(s) {
	const code = KEY_CODES[String(s.key || "").toUpperCase()];
	if (code === undefined) return null;
	const mods = [];
	if (s.control) mods.push("control down");
	if (s.option) mods.push("option down");
	if (s.command) mods.push("command down");
	if (s.shift) mods.push("shift down");
	const using = mods.length ? ` using {${mods.join(", ")}}` : "";
	return `tell application "System Events" to key code ${code}${using}`;
}

async function toggle(context) {
	if (!(await isRunning())) {
		console.error("Vorssaint is not running");
		return send({ event: "showAlert", context });
	}
	const script = shortcutScript(settings);
	if (!script) {
		console.error("Invalid shortcut key", settings.key);
		return send({ event: "showAlert", context });
	}
	const { error, stderr } = await run("/usr/bin/osascript", ["-e", script]);
	if (error) {
		console.error("osascript failed (Accessibility permission for OpenDeck needed?):", stderr.trim() || error.message);
		return send({ event: "showAlert", context });
	}
	// Vorssaint toggles asynchronously; check twice so the icon flips quickly.
	for (const delay of [300, 900]) {
		await new Promise((r) => setTimeout(r, delay));
		await refresh();
	}
}

ws.on("open", () => {
	send({ event: registerEvent, uuid: pluginUUID });
	send({ event: "getGlobalSettings", context: pluginUUID });
});

ws.on("message", async (raw) => {
	let msg;
	try {
		msg = JSON.parse(raw.toString());
	} catch {
		return;
	}
	switch (msg.event) {
		case "willAppear":
			console.log("willAppear", msg.context);
			contexts.add(msg.context);
			applySymbol(msg.context);
			startPolling();
			await refresh(true);
			break;
		case "willDisappear":
			contexts.delete(msg.context);
			stopPollingIfIdle();
			break;
		case "keyDown":
			await toggle(msg.context);
			break;
		case "didReceiveGlobalSettings":
			settings = { ...DEFAULT_SETTINGS, ...(msg.payload && msg.payload.settings) };
			for (const context of contexts) applySymbol(context);
			break;
	}
});

ws.on("close", () => process.exit(0));
ws.on("error", (e) => console.error("WebSocket error", e.message));
