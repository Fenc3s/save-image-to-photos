# Save Image to Photos

A dependency-free Manifest V3 Chrome extension for macOS. Right-click an image, choose **Save Image to Photos**, and select **Add to Photos** in the native macOS share sheet. No preparation page or companion application is required.

**Local version: 0.2.3.** The local development extension was loaded and tested on October 29, 2026. Version 0.2.3 is the current release candidate. Store approval and public availability are separate from repository publication. See the store submission record for verified review status.

## Use

1. Right-click a public HTTPS image on a normal web page.
2. Choose **Save Image to Photos**.
3. In the system share sheet, choose **Add to Photos** if macOS offers it.

The extension prepares the image automatically and attempts sharing directly in the original page. It does not open another tab. On a cross-origin image host that blocks page access, a small panel requests permission for that image host. The first permission approval may consume the user gesture, requiring one click on **Open Share Sheet** on the original page. Subsequent use of the tested authorized host opened sharing directly.

Chrome cannot automatically select Photos, click the system share menu, or verify an import. A successful sharing promise only means the sharing operation completed. Safari's built-in Photos integration is not exposed to Chrome extensions.

## Install for local testing

1. Open `chrome://extensions` in Chrome on a Mac.
2. Enable Developer mode and choose **Load unpacked**.
3. Select this project's `extension` folder.
4. To update an existing unpacked installation, click its **Reload** button.

The toolbar icon opens help only. Code is initially injected into the selected image frame after the user invokes the image command. On that document only, a temporary listener can prepare images on later trusted image right-clicks before the command is selected. Leaving the page removes it. No listener is installed across all websites.

## Compatibility and limits

- Current Chrome on macOS; minimum Chrome version 128. Feature availability is checked at runtime.
- Public HTTPS JPEG, PNG, GIF, and WebP source files up to 20 MiB.
- WebP is converted locally to a still PNG; animation and some metadata can be lost. Other accepted formats retain their bytes.
- A slow image transfer can outlast Chrome's transient user activation. A small in-page Open Share Sheet button then supplies the required fresh click.
- Page Permissions Policy, restricted pages, cross-origin frames, enterprise policies, and macOS share destination availability can prevent sharing. Open the image itself in a normal HTTPS tab when a site blocks sharing.
- No login cookies or referrer are sent. HTTP, data, blob, local files, redirects, authentication-only images, SVG, AVIF, and HEIC are unsupported in this version.
- No native helper, Daydream dependency, AppleScript, background agent, analytics, developer server, or remote code.
- No claim of support on all websites or of a verified Photos import from the sharing result.

## Permissions and privacy

- `contextMenus`: add the image-only Save Image to Photos command.
- `activeTab`: temporarily access the selected page after the explicit menu action.
- `scripting`: execute packaged image preparation and sharing code in that page's isolated extension world.
- Optional HTTPS host access: retrieve an explicitly selected image if page CORS blocks it and the user approves its host.

No storage permission or persistent content script is used. Pending cross-origin selections are held briefly in the extension service worker's memory, bound to the originating tab and document, and expire after one minute. Prepared image data lives in the injected script until dismissed, replaced, or the page is left. The packaged policy describes the current direct-sharing flow, including later right-click preparation. The public policy is available through GitHub Pages.

## Development

Requirements: Node.js 22+ and Python 3, used only for development and packaging.

```sh
npm test
npm run package
```

The package script produces `../save-image-to-photos-0.2.3.zip` with manifest.json at the root, a separate source ZIP, and SHA-256 checksums. The extension runs without Node.js or Python installed.

Before a store update, revise the live privacy policy, store description, permission justifications, reviewer instructions, and product screenshots for the new flow. The screenshots in `store/assets` show the previous submitted version and are retained as historical assets.

## References

- [Web Share specification](https://www.w3.org/TR/web-share/)
- [Chrome activeTab permission](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- [Chrome scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting)
- [Chrome 128: Web Share on macOS](https://developer.chrome.com/release-notes/128)


## Performance in version 0.2.1

Image requests prefer Chrome's existing HTTP cache rather than bypassing it with no-store. The original page's cache partition remains the first choice, including for CORS-enabled CDN images. Origin pairs that actually fail cross-origin access are remembered briefly in worker memory, avoiding a known failing page request on subsequent selections.

The most recently selected prepared File is reused for 30 seconds on the same page. This cache holds at most one File of up to 20 MiB, uses no extension storage, expires automatically, and is tied to that page's script context. Repeating the same image avoids another fetch and WebP conversion. Version 0.2.3 adds the right-click preparation behavior described below; visiting a page alone never fetches an image through this extension.

These optimizations are generic and contain no X-specific URL or DOM rules. They reduce extension preparation work; Chrome/macOS still controls native file checks and share-sheet presentation. Browser and OS presentation latency has not been quantified after the final change; do not claim a measured end-to-end speedup.

## Diagnosing native menu latency

Version 0.2.2 writes elapsed preparation times to the selected page’s local developer console, prefixed with `[Save Image to Photos]`. Stages cover injection, image bytes, file preparation or reuse, and the call to `navigator.share`. Logs contain no image URLs, page contents, or image bytes and are not uploaded or stored by the extension. Timing starts when the context-menu event reaches the service worker, so it excludes any earlier worker startup delay.

The final stage measures when the extension calls Chrome, not when the system menu becomes visible. Web Share provides no menu-open event; its promise completes after the sharing operation or cancellation. Do not interpret promise duration as menu-opening latency. Chromium’s macOS implementation prepares directories and writes shared files before presenting the native picker. This build adds measurement only and makes no new speed claim. See `store/latency-0.2.2.md` for the measured results and observation limits.

## Right-click preparation in version 0.2.3

After the first command invocation on a document, later trusted right-clicks on image elements in that same document may prepare the image while its context menu is open. This can fetch and convert an image even if the user ultimately chooses another menu action or closes the menu. It does not open sharing or request site permissions until the user chooses the extension command. It never fetches images merely because a page loads or an image is hovered.

Preparation uses the existing page CORS path, omits credentials and referrers, rejects redirects, enforces the existing HTTPS and 20 MiB limits, and reuses the one-file 30-second memory cache. Selecting the command joins an in-flight preparation instead of starting a duplicate page request. Failures remain quiet until the command is selected. A new right-click replaces the pending preparation. Leaving the document removes the listener and releases the cache.

This does not accelerate the first command on a newly loaded page, bypass cross-origin restrictions, or remove Chrome/macOS share presentation time. No manifest permissions were added. The shipped privacy page and the GitHub Pages policy describe this behavior.

## Project links

- Source: https://github.com/Fenc3s/save-image-to-photos
- Privacy policy and support: https://fenc3s.github.io/save-image-to-photos/
- Contact: homer.curious@gmail.com
