# Save Image to Photos

A dependency-free Manifest V3 Chrome extension for macOS. Right-click a supported web image, choose **Save Image to Photos**, then choose **Add to Photos** in the native macOS share sheet. No companion app or preparation tab is required.

Version **0.2.3** was submitted to the Chrome Web Store on October 29, 2026. Its verified status is **Pending review**, with automatic publication after approval. Repository publication does not imply store approval. See [the submission record](store/submission-0.2.3.md).

## Use

1. Right-click a public HTTPS image on a normal web page.
2. Choose **Save Image to Photos**.
3. Choose **Add to Photos** if macOS offers it.

Chrome cannot select Photos automatically, inspect the chosen destination, or verify an import. The toolbar icon opens help.

Some cross-origin image hosts need an optional site grant after you invoke the command. A slow transfer or permission approval can consume the user gesture; the original page then offers **Open Share Sheet** for a fresh click.

## Faster preparation after the first use

After the first command on a document, later trusted image right-clicks in that same document may prepare the right-clicked image while its menu is open. This can fetch and convert an image even if you close the menu or choose another action. It does not open sharing or request site permissions by itself. Selecting the command joins that preparation instead of starting a duplicate page request.

The extension keeps at most one prepared File of up to 20 MiB for 30 seconds. Leaving the document removes the listener and releases the cache. Visiting a page or hovering an image never triggers preparation. This behavior does not accelerate the first command on a newly loaded document or bypass Chrome/macOS share-menu presentation.

## Compatibility

- Current Chrome on macOS, minimum Chrome 128, in a normal window.
- Public HTTPS JPEG, PNG, GIF, and WebP images up to 20 MiB.
- WebP is converted locally to a still PNG; animation and some metadata may be lost. JPEG, PNG, and GIF retain their bytes.
- Site sharing policies, cross-origin frames, enterprise settings, and restricted browser pages can block sharing. Opening the image in its own HTTPS tab may help.
- HTTP images, local files, blob/data URLs, redirects, login-only images, SVG, AVIF, and HEIC are unsupported in this version.

## Permissions and privacy

- `contextMenus`: add the image-only command.
- `activeTab`: temporarily access the selected page after the explicit command.
- `scripting`: run packaged preparation and sharing code in the selected image frame.
- Optional HTTPS host access: retrieve an explicitly selected image when page CORS blocks it and you approve its host.

No storage permission, persistent all-sites content script, native messaging, helper application, analytics, advertising, account, or developer server is used. Image requests omit credentials and referrers and reject redirects. Images are processed locally and requested from their original image hosts. Local diagnostic console messages contain elapsed stages, not image URLs or bytes.

Read the [privacy policy and support page](https://fenc3s.github.io/save-image-to-photos/) for right-click preparation, short-lived memory caches, optional grants, and system-managed sharing files.

## Install for local testing

1. Open `chrome://extensions` on a Mac.
2. Enable Developer mode and choose **Load unpacked**.
3. Select the `extension` directory.
4. Use **Reload** to apply later changes to the unpacked installation.

## Development

Node.js 22+ and Python 3 are used for tests and packaging; neither is required to run the extension.

```sh
npm test
npm run package
```

The packager writes the extension ZIP, a source ZIP, and SHA-256 checksums in the parent directory. The `docs` directory is published with GitHub Pages. Policy, store listing, permission explanations, screenshots, and reviewer instructions must stay consistent with each release.

## Links

- [Source code](https://github.com/Fenc3s/save-image-to-photos)
- [Privacy and support](https://fenc3s.github.io/save-image-to-photos/)
- [Contact support](mailto:homer.curious@gmail.com)
- [Web Share specification](https://www.w3.org/TR/web-share/)
- [Chrome activeTab permission](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- [Chrome scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting)
