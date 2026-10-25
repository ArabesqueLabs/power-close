// Screenshots of the popup and the settings page, for the website and the
// README: src/ served as it is, the extension's API stood in for by a few
// made-up tabs, and each photographed by headless Chrome in light and dark,
// at 2x.
//
//   node scripts/screenshots.mjs        (or `make screenshots`)
//
// Writes website/screenshots/*.png, and demo-*.gif (the popup in use, slowly:
// it opens, github.com is typed, the count follows, Enter closes them),
// replacing them. And the stores' screenshots, a few of the shots each with
// a claim beside it (scripts/store.html), to dist/screenshots/chrome/
// (1280x800, the Chrome Web Store's size, five at most) and
// dist/screenshots/firefox/ (2400x1800, the most addons.mozilla.org takes). Needs Node 22+ (for its WebSocket), Chrome or Chromium
// (CHROME= to say where), and ffmpeg for the GIFs. No packages.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";

const SRC = "src";
const OUT = "website/screenshots";
const STORE_OUT = "dist/screenshots";
const PORT = 9348;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function chrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (existsSync(mac)) return mac;
  for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    if (spawnSync("which", [name]).status === 0) return name;
  }
  throw new Error("no Chrome or Chromium found: set CHROME to one");
}

// ---- the tabs ------------------------------------------------------------------------------

/** The browser the popup is opened in: twelve tabs, four of them GitHub's. */
const TABS = [
  "https://github.com/ArabesqueLabs/power-close",
  "https://github.com/ArabesqueLabs/power-close/issues",
  "https://github.com/notifications",
  "https://gist.github.com/",
  "https://news.ycombinator.com/",
  "https://www.bbc.co.uk/news",
  "https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions",
  "https://en.wikipedia.org/wiki/Tab_(interface)",
  "https://mail.google.com/mail/u/0/#inbox",
  "https://www.youtube.com/watch?v=e-AJi_SRvCk",
  "https://calendar.google.com/calendar/r",
  "https://www.power-close.com/",
];

/** The part of the extension API the popup and the settings page use, over TABS, with the settings as they start. */
const STUB = `
  let tabs = ${JSON.stringify(TABS)}.map((url, i) => ({ id: i + 1, url }));
  const later = (done, ...args) => setTimeout(() => done && done(...args));
  window.chrome = {
    runtime: { openOptionsPage: () => {} },
    tabs: {
      query: (_, done) => later(done, tabs.slice()),
      remove: (ids, done) => { tabs = tabs.filter((t) => !ids.includes(t.id)); later(done); },
      create: () => {},
    },
    storage: {
      sync: { get: (defaults, done) => later(done, { ...defaults }), set: (_, done) => later(done) },
      onChanged: { addListener: () => {} },
    },
    permissions: { contains: (_, done) => later(done, false) },
    contextMenus: { ContextType: {} },
    commands: { getAll: (done) => later(done, [{ name: "_execute_action", shortcut: "Alt+Shift+P" }]) },
  };
  window.close = () => {};
`;

// ---- the shots -----------------------------------------------------------------------------

/** Typing into the popup's field, as a person would. */
const type = (text) => `const k = document.getElementById("keyword"); k.value = ${JSON.stringify(text)};
  k.dispatchEvent(new Event("input")); await new Promise((r) => setTimeout(r, 50));`;

/** Each shot: a file name, and what to do in the popup first. */
const SHOTS = [
  { name: "popup", act: type("github.com") },
  { name: "no-match", act: type("reddit.com") },
  { name: "closed", act: `${type("github.com")} document.getElementById("close").click(); await new Promise((r) => setTimeout(r, 50));` },
  { name: "suggest", act: type("g") },
  { name: "settings", page: "options/options.html", width: 640, act: "" },
];

/** The stores' screenshots, in order: a shot, its scheme, and what's said beside it. */
const STORE = [
  { shot: "popup", scheme: "light", title: "Close every tab that matches, at once.",
    lede: "Type a site or a keyword, see how many tabs match, in every window, and press Enter." },
  { shot: "suggest", scheme: "light", title: "It knows the sites you have open.",
    lede: "Start typing and the domains of your open tabs are suggested, each with how many tabs it has." },
  { shot: "closed", scheme: "light", title: "Gone, and counted.",
    lede: "Four GitHub tabs closed in one keystroke, and the popup says so." },
  { shot: "settings", scheme: "light", title: "Match titles, page text or a regular expression.",
    lede: "Keep pinned tabs, close a site from the right-click menu, and pick your shortcut." },
  { shot: "popup", scheme: "dark", title: "Light or dark, as your browser is.",
    lede: "Free and open source, for Chrome and Firefox. Nothing you type leaves your browser." },
];

/** Each store's size, as a window and the scale it's taken at. */
const STORES = { chrome: { width: 1280, height: 800, scale: 1 }, firefox: { width: 1200, height: 900, scale: 2 } };

/** The demo: what's typed, a key at a time, and how long each frame stays (ms). */
const DEMO = { typed: "github.com", opened: 1800, key: 380, typedHold: 2800, closedHold: 3600 };

// ---- the repository, served ---------------------------------------------------------------

const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };

/** The repository's root, and the shots the store pages are made from under /shots/. */
function serve(shots) {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
    try {
      const body = readFileSync(path.startsWith("/shots/") ? join(shots, path.slice(7)) : join(".", path));
      res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r(server)));
}

// ---- a tiny Chrome DevTools Protocol driver ------------------------------------------------

async function browser() {
  const profile = mkdtempSync(join(tmpdir(), "power-close-shots-"));
  const proc = spawn(chrome(), ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`, "--no-first-run", "--force-color-profile=srgb", "about:blank"], { stdio: "ignore" });
  let page;
  for (let i = 0; i < 50 && !page; i++) {
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page"); } catch { /* starting */ }
    if (!page) await sleep(200);
  }
  if (!page) throw new Error("Chrome didn't start");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0;
  const waiting = new Map();
  const errors = [];
  ws.addEventListener("message", (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); }
    if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: STUB });
  const evaluate = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
    return r.result.result.value;
  };
  return {
    errors,
    // A toolbar popup is as tall as its document: the window is made so.
    size: (width, height, scale = 2) => send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: false }),
    scheme: (value) => send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value }] }),
    go: async (url) => { await send("Page.navigate", { url }); await sleep(500); await evaluate("await document.fonts.ready"); },
    eval: evaluate,
    shot: async (path) => {
      const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      writeFileSync(path, Buffer.from(r.result.data, "base64"));
    },
    // Chrome writes its profile as it quits: it's removed once it has.
    close: async () => {
      ws.close();
      const exited = new Promise((r) => proc.once("exit", r));
      proc.kill();
      await exited;
      rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
    },
  };
}

/**
 * The popup in use, as frames, made into a GIF by ffmpeg. The window is as
 * tall as the popup gets (once it says what it closed), so the frames are
 * one size; the page's ground fills under the shorter ones, as it does in
 * the browser. It plays three times and stops on what was closed.
 */
async function demo(b, scheme) {
  await b.size(320, 600);
  await b.go(url);
  await b.eval(SHOTS.find((s) => s.name === "closed").act);
  const height = await b.eval("return Math.ceil(document.documentElement.getBoundingClientRect().height)");
  await b.size(320, height);
  await b.go(url);
  await b.eval(`document.getElementById("keyword").style.caretColor = "transparent"`);

  const frames = mkdtempSync(join(tmpdir(), "power-close-demo-"));
  const list = [];
  const frame = async (ms) => {
    await sleep(80);
    const file = join(frames, `${String(list.length).padStart(3, "0")}.png`);
    await b.shot(file);
    list.push(`file '${file}'`, `duration ${ms / 1000}`);
  };
  await frame(DEMO.opened);
  for (let i = 1; i <= DEMO.typed.length; i++) {
    await b.eval(type(DEMO.typed.slice(0, i)));
    await frame(i === DEMO.typed.length ? DEMO.typedHold : DEMO.key);
  }
  await b.eval(`document.getElementById("keyword").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await new Promise((r) => setTimeout(r, 50));`);
  await frame(DEMO.closedHold);
  // The concat demuxer takes the last frame's duration only if it's listed again.
  list.push(list.at(-2));
  writeFileSync(join(frames, "list.txt"), list.join("\n") + "\n");

  const out = join(OUT, `demo-${scheme}.gif`);
  const ff = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(frames, "list.txt"),
    "-vf", "split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=none", "-fps_mode", "vfr", "-loop", "2", out],
    { stdio: "inherit" });
  rmSync(frames, { recursive: true, force: true });
  if (ff.error || ff.status !== 0) throw new Error(`ffmpeg couldn't make ${out}${ff.error ? `: ${ff.error.message}` : ""}`);
  return out;
}

// ---- making them ---------------------------------------------------------------------------

// The store pages' shots, at 4x, so they're sharp at Firefox's size.
const shots = mkdtempSync(join(tmpdir(), "power-close-store-"));
const server = await serve(shots);
const site = `http://127.0.0.1:${server.address().port}`;
const url = `${site}/${SRC}/popup/popup.html`;
const b = await browser();
mkdirSync(OUT, { recursive: true });
try {
  for (const scheme of ["light", "dark"]) {
    await b.scheme(scheme);
    for (const shot of SHOTS) {
      await b.size(shot.width || 320, 600);
      await b.go(shot.page ? `${site}/${SRC}/${shot.page}` : url);
      // The field has focus, as when the popup opens; its caret would blink
      // in and out of the pictures.
      await b.eval(`const f = document.getElementById("keyword"); if (f) f.style.caretColor = "transparent"; ${shot.act}`);
      const width = await b.eval("return Math.ceil(document.documentElement.getBoundingClientRect().width)");
      const height = await b.eval("return Math.ceil(document.documentElement.getBoundingClientRect().height)");
      await b.size(width, height);
      await sleep(100);
      const file = join(OUT, `${shot.name}-${scheme}.png`);
      await b.shot(file);
      console.log(file);
      if (STORE.some((s) => s.shot === shot.name && s.scheme === scheme)) {
        await b.size(width, height, 4);
        await sleep(100);
        await b.shot(join(shots, `${shot.name}-${scheme}.png`));
      }
    }
  }
  await b.scheme("light");
  for (const [store, { width, height, scale }] of Object.entries(STORES)) {
    mkdirSync(join(STORE_OUT, store), { recursive: true });
    await b.size(width, height, scale);
    for (const [i, s] of STORE.entries()) {
      const query = new URLSearchParams({ shot: `${s.shot}-${s.scheme}`, scheme: s.scheme, title: s.title, lede: s.lede });
      await b.go(`${site}/scripts/store.html?${query}`);
      await b.eval(`while (!("ready" in document.body.dataset)) await new Promise((r) => setTimeout(r, 50));`);
      await sleep(200);
      const file = join(STORE_OUT, store, `${i + 1}-${s.shot}-${s.scheme}.png`);
      await b.shot(file);
      console.log(file);
    }
  }
  for (const scheme of ["light", "dark"]) {
    await b.scheme(scheme);
    console.log(await demo(b, scheme));
  }
  if (b.errors.length) throw new Error(`the popup threw:\n${b.errors.join("\n")}`);
} finally {
  await b.close();
  server.close();
  rmSync(shots, { recursive: true, force: true });
}
