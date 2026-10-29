// Initially injected after the image command; subsequent right-clicks can warm
// the selected image in that same document without requesting more permissions.
// Keep it self-contained because chrome.scripting serializes the function body.
export async function shareImageInPage(source, suppliedBytes = null, options = {}) {
  const startedAt = options.startedAt ?? Date.now();
  const trace = stage => {
    if (options.trace) console.info(`[Save Image to Photos] ${stage}: ${Date.now() - startedAt} ms (${options.route ?? "page"})`);
  };
  trace("page code started");
  const cacheKey = "__saveImageToPhotosPreparedFile";
  const key = options.warmOnly ? "__saveImageToPhotosWarmController" : "__saveImageToPhotosController";
  const warmupKey = "__saveImageToPhotosWarmup";
  globalThis[key]?.dispose();
  let file;
  let host;
  let disposed = false;
  let sharing = false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  const dispose = () => {
    disposed = true;
    controller.abort();
    clearTimeout(timer);
    host?.remove();
    file = undefined;
    window.removeEventListener("pagehide", dispose);
    if (globalThis[key]?.dispose === dispose) delete globalThis[key];
  };
  globalThis[key] = { dispose };
  window.addEventListener("pagehide", dispose, { once: true });

  function installWarmup() {
    if (globalThis[warmupKey]) return;
    const warmup = { source: null, pending: null, expiresAt: 0 };
    const onContextMenu = event => {
      if (!event.isTrusted) return;
      const image = event.composedPath().find(node => node.tagName === "IMG");
      const candidate = image?.currentSrc || image?.src;
      if (!candidate) return;
      try {
        const url = new URL(candidate);
        if (url.protocol !== "https:" || url.username || url.password) return;
      } catch { return; }
      warmup.source = candidate;
      warmup.expiresAt = Date.now() + 30000;
      warmup.pending = shareImageInPage(candidate, null, { warmOnly: true, trace: options.trace, route: "right-click-warmup" });
    };
    const stop = () => {
      document.removeEventListener("contextmenu", onContextMenu, true);
      globalThis.__saveImageToPhotosWarmController?.dispose();
      const cached = globalThis[cacheKey];
      if (cached) clearTimeout(cached.timer);
      delete globalThis[cacheKey];
      if (globalThis[warmupKey] === warmup) delete globalThis[warmupKey];
    };
    document.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener("pagehide", stop, { once: true });
    globalThis[warmupKey] = warmup;
  }

  function show(message, retry = false, requestAccess = false) {
    host?.remove();
    host = document.createElement("div");
    host.style.cssText = "all:initial;position:fixed;right:20px;bottom:20px;z-index:2147483647;display:block";
    const shadow = host.attachShadow({ mode: "closed" });
    const panel = document.createElement("section");
    panel.setAttribute("role", "status");
    panel.style.cssText = "box-sizing:border-box;width:340px;padding:18px;border:1px solid #ccdacd;border-radius:14px;background:#fff;color:#203329;box-shadow:0 8px 32px #0002;font:14px/1.5 system-ui,sans-serif";
    const title = document.createElement("strong");
    title.textContent = "Save Image to Photos";
    const text = document.createElement("p");
    text.textContent = message;
    panel.append(title, text);
    function button(label, action) {
      const button = document.createElement("button");
      button.textContent = label;
      button.style.cssText = "font:600 14px system-ui;padding:9px 12px;margin-right:8px;border:0;border-radius:8px;background:#286344;color:white;cursor:pointer";
      button.addEventListener("click", action);
      panel.append(button);
    }
    if (retry) button("Open Share Sheet", () => { void share(); });
    if (requestAccess) button("Allow site & share", async () => {
      try {
        const responsePromise = chrome.runtime.sendMessage({ type: "fetch-selected-image", token: options.token });
        host?.remove();
        const response = await responsePromise;
        if (disposed) return;
        if (!response?.ok) throw new Error(response?.error || "The image could not be loaded.");
        await prepare(Uint8Array.from(atob(response.data), value => value.charCodeAt(0)));
      } catch (error) {
        if (!disposed) show(error.message);
      }
    });
    button("Dismiss", dispose);
    shadow.append(panel);
    document.documentElement.append(host);
  }

  async function share() {
    if (sharing || disposed || !file) return;
    try {
      trace("calling navigator.share; native menu timing starts here");
      const operation = navigator.share({ files: [file] });
      sharing = true;
      host?.remove();
      await operation;
      if (!disposed) {
        show("Sharing completed. Check Photos to confirm the import.");
        setTimeout(dispose, 5000);
      }
      return { state: "shared" };
    } catch (error) {
      if (disposed) return { state: "dismissed" };
      if (error.name === "AbortError") {
        dispose();
        return { state: "cancelled" };
      }
      if (error.name === "NotAllowedError") {
        show("Chrome needs a fresh click to open sharing. Your image is ready.", true);
        return { state: "needs-click" };
      }
      show(`Sharing could not complete: ${error.message}`, true);
      return { state: "error", reason: error.name };
    } finally {
      sharing = false;
    }
  }

  async function prepare(bytes) {
    trace("image bytes ready");
    const ascii = (start, end) => String.fromCharCode(...bytes.slice(start, end));
    let mime;
    let extension;
    if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) [mime, extension] = ["image/jpeg", "jpg"];
    else if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((v, i) => bytes[i] === v)) [mime, extension] = ["image/png", "png"];
    else if (["GIF87a", "GIF89a"].includes(ascii(0, 6))) [mime, extension] = ["image/gif", "gif"];
    else if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") [mime, extension] = ["image/webp", "webp"];
    else throw new Error("Use a JPEG, PNG, GIF, or WebP image.");
    file = new File([bytes], `image.${extension}`, { type: mime });
    if (mime === "image/webp") {
      const bitmap = await createImageBitmap(file);
      try {
        if (bitmap.width * bitmap.height > 40000000) throw new Error("This WebP is too large to convert safely.");
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        canvas.getContext("2d").drawImage(bitmap, 0, 0);
        file = new File([await canvas.convertToBlob({ type: "image/png" })], "image.png", { type: "image/png" });
      } finally { bitmap.close(); }
    }
    if (file.size <= 20 * 1024 * 1024) {
      const previous = globalThis[cacheKey];
      if (previous) clearTimeout(previous.timer);
      const cached = { source, file, expiresAt: Date.now() + 30000 };
      cached.timer = setTimeout(() => {
        if (globalThis[cacheKey] === cached) delete globalThis[cacheKey];
      }, 30000);
      globalThis[cacheKey] = cached;
    }
    trace("share file prepared");
    if (!navigator.canShare({ files: [file] })) throw new Error("Chrome cannot share this image format on this page.");
    if (disposed) return { state: "dismissed" };
    if (options.warmOnly) {
      dispose();
      return { state: "prepared" };
    }
    return await share();
  }

  try {
    if (options.notice) {
      clearTimeout(timer);
      show(options.notice);
      return { state: "error" };
    }
    if (options.requestAccess) {
      clearTimeout(timer);
      show("This image host blocks access from the page. Allow this image site to prepare and share the selected image.", false, true);
      return { state: "needs-permission" };
    }
    if (!navigator.share || !navigator.canShare) throw new Error("File sharing is unavailable on this page. Use current Chrome on macOS and a normal HTTPS page.");
    if (!options.warmOnly) {
      installWarmup();
      const warmup = globalThis[warmupKey];
      if (!suppliedBytes && warmup?.source === source && warmup.expiresAt > Date.now() && warmup.pending) {
        const result = await warmup.pending;
        if (disposed) return { state: "dismissed" };
        trace("right-click preparation joined");
        if (result?.state === "fetch-failed") {
          dispose();
          return result;
        }
      }
    }
    const cached = globalThis[cacheKey];
    if (cached?.source === source && cached.expiresAt > Date.now()) {
      clearTimeout(timer);
      file = cached.file;
      trace("prepared file reused");
      if (options.warmOnly) {
        dispose();
        return { state: "prepared" };
      }
      return await share();
    }
    if (options.probeOnly) {
      dispose();
      return { state: "fetch-failed", reason: "extension-route" };
    }
    let bytes;
    if (suppliedBytes) {
      bytes = Uint8Array.from(atob(suppliedBytes), value => value.charCodeAt(0));
    } else {
      const url = new URL(source);
      if (url.protocol !== "https:" || url.username || url.password) throw new Error("Choose a public HTTPS image. Local files, blob URLs, and HTTP images are not supported.");
      const response = await fetch(source, { credentials: "omit", referrerPolicy: "no-referrer", redirect: "error", cache: "force-cache", signal: controller.signal });
      if (!response.ok) throw new Error(`The image server returned HTTP ${response.status}.`);
      if (Number(response.headers.get("content-length")) > 20 * 1024 * 1024) throw new Error("Images must be 20 MB or smaller.");
      const reader = response.body.getReader();
      const chunks = [];
      let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 20 * 1024 * 1024) throw new Error("Images must be 20 MB or smaller.");
          chunks.push(value);
        }
      } catch (error) {
        await reader.cancel().catch(() => {});
        throw error;
      } finally {
        reader.releaseLock();
      }
      bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    }
    clearTimeout(timer);
    if (disposed) return { state: "dismissed" };
    return await prepare(bytes);
  } catch (error) {
    clearTimeout(timer);
    if (disposed) return { state: "dismissed" };
    if (options.warmOnly) {
      dispose();
      return { state: "fetch-failed", reason: error.name };
    }
    if (!suppliedBytes && (error instanceof TypeError || error.name === "AbortError")) {
      dispose();
      return { state: "fetch-failed", reason: error.name };
    }
    show(error.message);
    return { state: "error", reason: error.name };
  }
}
