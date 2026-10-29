import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { isCrossOriginImage } from "../extension/routing.js";
import { sourcePermission } from "../extension/image.js";

async function worker(executeScript) {
  const listeners = {};
  const menus = [];
  const tabs = [];
  const event = name => ({ addListener: fn => { listeners[name] = fn; } });
  const chrome = {
    runtime: { id: "test-extension", onInstalled: event("install"), onMessage: event("message"), getURL: value => `chrome-extension://test/${value}` },
    contextMenus: { onClicked: event("click"), removeAll: async () => {}, create: value => menus.push(value) },
    scripting: { executeScript },
    tabs: { create: async value => tabs.push(value) },
    action: { onClicked: event("action"), setBadgeText: async () => {}, setTitle: async () => {} }
  };
  const code = (await readFile(new URL("../extension/background.js", import.meta.url), "utf8")).replace(/^import .*;\n/gm, "");
  vm.runInNewContext(code, { chrome, shareImageInPage() {}, sourcePermission, isCrossOriginImage, crypto, console, Date, URL, AbortSignal, fetch });
  return { listeners, menus, tabs };
}

test("context-menu click injects sharing immediately into the selected frame without creating a preparation tab", async () => {
  const calls = [];
  const { listeners, menus, tabs } = await worker(async request => {
    calls.push(request);
    return [{ documentId: "document-1", result: { state: "shared" } }];
  });
  await listeners.install();
  assert.equal(menus[0].title, "Save Image to Photos");
  assert.equal(menus[0].contexts[0], "image");
  listeners.click({ menuItemId: "other", srcUrl: "https://ignored.test" }, { id: 7 });
  assert.equal(calls.length, 0);
  listeners.click({ menuItemId: "save-image-to-photos", srcUrl: "https://example.com/photo.png?secret=token", frameId: 3 }, { id: 7 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].target.tabId, 7);
  assert.equal(calls[0].target.frameIds[0], 3);
  assert.equal(calls[0].args[0], "https://example.com/photo.png?secret=token");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(tabs.length, 0);
});

test("untrusted or expired requests cannot ask for a site grant or fetch an arbitrary URL", async () => {
  const { listeners } = await worker(async () => []);
  let response;
  assert.equal(listeners.message({ type: "fetch-selected-image", token: "forged", source: "https://private.test" }, { id: "other", tab: { id: 7 } }, value => { response = value; }), false);
  assert.equal(response.ok, false);
  assert.match(response.error, /expired/);
});


test("CORS-enabled CDN images stay in the page cache even when their origin differs", async () => {
  const calls = [];
  const { listeners } = await worker(async request => {
    calls.push(request);
    return [{ documentId: "cdn-document", result: { state: "shared" } }];
  });
  listeners.click({ menuItemId: "save-image-to-photos", srcUrl: "https://cdn.example/image.png" }, { id: 7, url: "https://site.example/page" });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args[2].probeOnly, false);
});
