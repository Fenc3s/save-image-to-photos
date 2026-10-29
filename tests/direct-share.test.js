import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const png = Uint8Array.from([137,80,78,71,13,10,26,10,0,0]);
const source = (await readFile(new URL("../extension/direct-share.js", import.meta.url), "utf8")).replace("export async function", "async function");

function setup({ shareError, fetchError, fetchHook } = {}) {
  const calls = [];
  const nodes = [];
  const documentListeners = new Map();
  const pagehideListeners = new Set();
  function element(tag) {
    const node = { tag, children: [], style: {}, textContent: "", append(...items) { this.children.push(...items); }, setAttribute() {}, addEventListener(type, handler) { this[type] = handler; }, remove() { this.removed = true; }, attachShadow() { return element("shadow"); } };
    nodes.push(node);
    return node;
  }
  const context = vm.createContext({
    File, Uint8Array, String, Error, TypeError, AbortController, URL, atob, Date, console,
    document: { createElement: element, documentElement: element("html"), addEventListener(type, handler) { documentListeners.set(type, handler); }, removeEventListener(type, handler) { if (documentListeners.get(type) === handler) documentListeners.delete(type); } },
    window: { addEventListener(type, handler) { if (type === "pagehide") pagehideListeners.add(handler); }, removeEventListener(type, handler) { pagehideListeners.delete(handler); } },
    navigator: { canShare: () => true, share: async data => { calls.push(data); if (shareError) throw shareError; } },
    fetch: async (url, options) => { calls.push({ url, options }); if (fetchError) throw fetchError; await fetchHook?.(url); return new Response(png); },
    setTimeout: () => 1, clearTimeout() {}
  });
  vm.runInContext(source, context);
  return { context, calls, nodes, documentListeners, pagehideListeners, run: (url = "https://images.example/photo.png") => context.shareImageInPage(url) };
}

function rightClick(mock, url, isTrusted = true) {
  mock.documentListeners.get("contextmenu")?.({ isTrusted, composedPath: () => [{ tagName: "IMG", currentSrc: url }] });
}

test("a ready HTTPS image reaches navigator.share without another button or tab", async () => {
  const mock = setup();
  const result = await mock.run();
  assert.equal(result.state, "shared");
  assert.equal(mock.calls[0].options.credentials, "omit");
  assert.equal(mock.calls[0].options.redirect, "error");
  assert.equal(mock.calls[0].options.cache, "force-cache");
  assert.equal(mock.calls[1].files[0].type, "image/png");
  assert.equal(mock.nodes.some(node => node.textContent === "Open Share Sheet"), false);
});

test("cancelled system sharing cleans up without claiming an import", async () => {
  const mock = setup({ shareError: new DOMException("Cancelled", "AbortError") });
  assert.equal((await mock.run()).state, "cancelled");
  assert.equal(mock.context.__saveImageToPhotosController, undefined);
  assert.equal(mock.nodes.some(node => node.textContent?.includes("Sharing completed")), false);
});

test("expired activation keeps the prepared image behind one in-page retry button", async () => {
  const mock = setup({ shareError: new DOMException("Gesture expired", "NotAllowedError") });
  assert.equal((await mock.run()).state, "needs-click");
  assert.equal(mock.nodes.some(node => node.textContent === "Open Share Sheet"), true);
});

test("CORS failure returns control to the extension without creating UI or sharing a URL", async () => {
  const mock = setup({ fetchError: new TypeError("Failed to fetch") });
  assert.equal((await mock.run()).state, "fetch-failed");
  assert.equal(mock.calls.length, 1);
  assert.equal(mock.nodes.some(node => node.tag === "section"), false);
});

test("unsupported URLs display an in-page error and do not access the network", async () => {
  const mock = setup();
  assert.equal((await mock.run("file:///private/image.png")).state, "error");
  assert.equal(mock.calls.length, 0);
  assert.equal(mock.nodes.some(node => node.tag === "section"), true);
});

test("repeating the same selected image reuses its prepared File without fetching again", async () => {
  const mock = setup({ shareError: new DOMException("Cancelled", "AbortError") });
  assert.equal((await mock.run()).state, "cancelled");
  assert.equal((await mock.run()).state, "cancelled");
  assert.equal(mock.calls.filter(call => call.url).length, 1);
  const shared = mock.calls.filter(call => call.files);
  assert.equal(shared.length, 2);
  assert.equal(shared[0].files[0], shared[1].files[0]);
});

test("an authorized extension-route probe does not start a page fetch", async () => {
  const mock = setup();
  const result = await mock.context.shareImageInPage("https://images.example/photo.png", null, { probeOnly: true });
  assert.equal(result.state, "fetch-failed");
  assert.equal(result.reason, "extension-route");
  assert.equal(mock.calls.length, 0);
});

test("a different image cannot reuse a previous image's prepared File", async () => {
  const mock = setup({ shareError: new DOMException("Cancelled", "AbortError") });
  await mock.run("https://images.example/first.png");
  await mock.run("https://images.example/second.png");
  assert.equal(mock.calls.filter(call => call.url).length, 2);
});


test("an expired prepared-file cache does not suppress a new image request", async () => {
  const mock = setup({ shareError: new DOMException("Cancelled", "AbortError") });
  await mock.run();
  mock.context.__saveImageToPhotosPreparedFile.expiresAt = Date.now() - 1;
  await mock.run();
  assert.equal(mock.calls.filter(call => call.url).length, 2);
});

test("right-click preparation stays in the activated document and never shares by itself", async () => {
  const mock = setup();
  assert.equal(mock.documentListeners.size, 0);
  await mock.run();
  rightClick(mock, "https://images.example/next.png");
  await mock.context.__saveImageToPhotosWarmup.pending;
  assert.equal(mock.calls.filter(call => call.files).length, 1);
  assert.equal(mock.calls.filter(call => call.url).length, 2);
  await mock.run("https://images.example/next.png");
  assert.equal(mock.calls.filter(call => call.url).length, 2);
  assert.equal(mock.calls.filter(call => call.files).length, 2);
});

test("untrusted events and unsupported URLs cannot trigger preparation", async () => {
  const mock = setup();
  await mock.run();
  rightClick(mock, "https://images.example/next.png", false);
  rightClick(mock, "http://images.example/next.png");
  rightClick(mock, "https://name:secret@images.example/next.png");
  assert.equal(mock.calls.filter(call => call.url).length, 1);
  assert.equal(mock.context.__saveImageToPhotosWarmup.pending, null);
});

test("selecting the command joins a pending right-click fetch without a duplicate request", async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const mock = setup({ fetchHook: url => url.endsWith("next.png") ? gate : undefined });
  await mock.run();
  rightClick(mock, "https://images.example/next.png");
  const selected = mock.run("https://images.example/next.png");
  assert.equal(mock.calls.filter(call => call.url).length, 2);
  release();
  assert.equal((await selected).state, "shared");
  assert.equal(mock.calls.filter(call => call.url).length, 2);
});

test("a failed right-click fetch hands off to the worker without another page request or permission UI", async () => {
  const mock = setup({ fetchHook: url => { if (url.endsWith("next.png")) throw new TypeError("CORS"); } });
  await mock.run();
  rightClick(mock, "https://images.example/next.png");
  await mock.context.__saveImageToPhotosWarmup.pending;
  assert.equal((await mock.run("https://images.example/next.png")).state, "fetch-failed");
  assert.equal(mock.calls.filter(call => call.url).length, 2);
  assert.equal(mock.nodes.some(node => node.textContent === "Allow site & share"), false);
});

test("leaving the document removes the right-click listener", async () => {
  const mock = setup();
  await mock.run();
  for (const listener of [...mock.pagehideListeners]) listener();
  assert.equal(mock.documentListeners.has("contextmenu"), false);
  assert.equal(mock.context.__saveImageToPhotosWarmup, undefined);
  rightClick(mock, "https://images.example/next.png");
  assert.equal(mock.calls.filter(call => call.url).length, 1);
});

test("authorized worker bytes bypass a failed page warmup", async () => {
  const mock = setup({ fetchHook: url => { if (url.endsWith("next.png")) throw new TypeError("CORS"); } });
  await mock.run();
  rightClick(mock, "https://images.example/next.png");
  await mock.context.__saveImageToPhotosWarmup.pending;
  const data = Buffer.from(png).toString("base64");
  const result = await mock.context.shareImageInPage("https://images.example/next.png", data);
  assert.equal(result.state, "shared");
  assert.equal(mock.calls.filter(call => call.url).length, 2);
  assert.equal(mock.calls.filter(call => call.files).length, 2);
});
