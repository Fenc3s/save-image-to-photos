import { shareImageInPage } from "./direct-share.js";
import { sourcePermission, readImage } from "./image.js";
import { isCrossOriginImage } from "./routing.js";

const MENU_ID = "save-image-to-photos";
const jobs = new Map();
const blockedOrigins = new Map();

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({ id: MENU_ID, title: "Save Image to Photos", contexts: ["image"] });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.srcUrl || !Number.isInteger(tab?.id)) return;
  // Inject immediately so the context-menu gesture reaches the selected page.
  void shareSelectedImage(info, tab);
});

async function encodedImage(source) {
  const file = await readImage(await fetch(source, {
    credentials: "omit", referrerPolicy: "no-referrer", redirect: "error",
    cache: "force-cache", signal: AbortSignal.timeout(15000)
  }));
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 32768) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
  }
  return btoa(binary);
}

async function shareSelectedImage(info, tab) {
  const target = { tabId: tab.id, frameIds: [info.frameId ?? 0] };
  const timing = { startedAt: Date.now(), trace: true, route: "page-cache" };
  try {
    const crossOrigin = isCrossOriginImage(info.srcUrl, info.frameUrl ?? tab.url);
    const pageURL = info.frameUrl ?? tab.url;
    const routeKey = crossOrigin ? `${new URL(pageURL).origin}|${new URL(info.srcUrl).origin}` : "";
    const blockedAt = blockedOrigins.get(routeKey);
    const knownBlocked = !!blockedAt && Date.now() - blockedAt < 120000;
    // Keep X and other CORS-enabled images in the page's own cache partition.
    // Skip page fetching only after this origin pair has actually failed CORS.
    const results = await chrome.scripting.executeScript({
      target, func: shareImageInPage,
      args: [info.srcUrl, null, { ...timing, probeOnly: knownBlocked }]
    });
    const result = results[0];
    if (result?.result?.state !== "fetch-failed") return;
    sourcePermission(info.srcUrl);
    if (crossOrigin && result.result.reason === "TypeError") {
      if (blockedOrigins.size >= 100) blockedOrigins.delete(blockedOrigins.keys().next().value);
      blockedOrigins.set(routeKey, Date.now());
    }
    const granted = crossOrigin && await chrome.permissions.contains({ origins: [sourcePermission(info.srcUrl)] });
    // Pin follow-up work to the document that received the user's selection.
    const documentTarget = { tabId: tab.id, documentIds: [result.documentId] };
    try {
      if (crossOrigin && !granted) throw new Error("Image site access is required.");
      const data = await encodedImage(info.srcUrl);
      await chrome.scripting.executeScript({ target: documentTarget, func: shareImageInPage, args: [info.srcUrl, data, { ...timing, route: "extension-cache" }] });
    } catch {
      const token = crypto.randomUUID();
      for (const [key, job] of jobs) {
        if (Date.now() - job.createdAt > 60000) jobs.delete(key);
      }
      jobs.set(token, { source: info.srcUrl, tabId: tab.id, documentId: result.documentId, createdAt: Date.now() });
      await chrome.scripting.executeScript({ target: documentTarget, func: shareImageInPage, args: [info.srcUrl, null, { requestAccess: true, token }] });
    }
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [0] }, func: shareImageInPage,
        args: ["", null, { notice: "Chrome could not access this image frame. Open the image in its own HTTPS tab and try again. Browser settings pages and other extensions cannot be modified." }]
      });
    } catch {
      await chrome.action.setBadgeText({ tabId: tab.id, text: "!" });
      await chrome.action.setTitle({ tabId: tab.id, title: "This page cannot run image sharing. Open the image in its own HTTPS tab and try again." });
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== "fetch-selected-image") return false;
  const job = jobs.get(message.token);
  if (!job || sender.id !== chrome.runtime.id || sender.tab?.id !== job.tabId || sender.documentId !== job.documentId || Date.now() - job.createdAt > 60000) {
    respond({ ok: false, error: "This selection expired. Right-click the image again." });
    return false;
  }
  jobs.delete(message.token);
  // Request synchronously inside the click-triggered message handler.
  const permissionRequest = chrome.permissions.request({ origins: [sourcePermission(job.source)] });
  void permissionRequest.then(async granted => {
    if (!granted) throw new Error("Image site access was not granted. Right-click the image to retry.");
    respond({ ok: true, data: await encodedImage(job.source) });
  }).catch(error => respond({ ok: false, error: error.message }));
  return true;
});

chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: chrome.runtime.getURL("help.html") }));
