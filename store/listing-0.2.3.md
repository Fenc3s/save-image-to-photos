# Chrome Web Store listing — 0.2.3

## Summary

Send an image to the macOS share sheet, then choose Add to Photos. No companion app required.

## Detailed description

Save web images to Apple Photos through the macOS share sheet.

HOW TO USE
1. Right-click a supported web image.
2. Choose Save Image to Photos.
3. Choose Add to Photos in the macOS share sheet, if offered by your Mac.

The share sheet opens on the original page. No preparation tab or companion application is required. You choose the receiving app; the extension cannot automatically select Photos or confirm an import.

After the first use on a page, later image right-clicks on that page can prepare the image while the context menu is open. This may load the right-clicked image even if you close the menu or select another action. Leaving the page stops this preparation.

COMPATIBILITY
Use current Chrome on macOS. Supports public HTTPS JPEG, PNG, GIF, and WebP images up to 20 MiB. WebP is converted locally to a still PNG. Browser pages, site sharing policies, cross-origin frames, redirects, and login-only images can prevent sharing.

Some image hosts need an optional site permission before the selected image can be retrieved. A slow download or permission approval may require an extra click on Open Share Sheet in a small panel on the original page.

PRIVACY
No account, analytics, advertising, native helper, or developer server. Images are prepared locally and requested from their original image hosts. The extension does not upload images to a developer service. Short-lived memory caches and later right-click preparation are explained in the privacy policy.

Privacy and support: https://fenc3s.github.io/save-image-to-photos/
Source code: https://github.com/Fenc3s/save-image-to-photos
Support: homer.curious@gmail.com

## Single purpose

Send a user-selected web image to macOS sharing so the user can choose Add to Photos.

## Permission justifications

- contextMenus: Provide the image-only Save Image to Photos command.
- activeTab: Temporarily access the selected page after the explicit image command. The permission is also used for later image right-click preparation in that same document; no script is installed across all websites.
- scripting: Inject packaged code into the selected image frame to retrieve and validate the image, convert WebP when necessary, invoke native sharing, and prepare later right-clicked images in that document. No remote script is executed.
- Optional HTTPS host access: Retrieve an explicitly selected image from its original host only when page CORS prevents access and the user grants that host. Arbitrary image/CDN origins require the optional HTTPS pattern; access is not granted to all sites at installation.

## Reviewer instructions

Test with current Chrome on macOS in a normal window. No account or companion software is required. Open https://dummyimage.com/640x400/286344/ffffff.png&text=Photos+Extension+Test, right-click the image, choose Save Image to Photos, and inspect the native share sheet. If macOS offers Add to Photos, the user can choose it. The extension cannot force that destination or verify an import. Cancel the menu to avoid importing a test image.

Repeat on the same document to exercise right-click preparation: opening the image context menu may fetch and prepare its image before the extension command is selected, but never opens sharing or requests a site grant by itself. Leaving the document removes the listener. No new all-sites installation permission is used.

For a host that blocks page CORS, the first command may show Allow site & share. Approving optional host access can consume the user gesture; then click Open Share Sheet. Slow networks, restricted pages, cross-origin frames, and macOS destination availability can limit this flow. WebP conversion produces a still PNG. Maximum input is 20 MiB.

Version 0.2.3 replaces the preparation-tab workflow in the earlier submission. Required permissions changed from contextMenus/storage to contextMenus/activeTab/scripting; storage was removed. It adds one-file 30-second memory reuse and document-scoped preparation on later trusted image right-clicks. The public policy and screenshots describe the new behavior.
