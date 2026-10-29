# Privacy Policy — Save Image to Photos 0.2.3

Effective date: October 29, 2026

This policy describes Save Image to Photos version 0.2.3. No developer server, analytics, advertising, or account is used.

## Selected images

When you choose Save Image to Photos in an image context menu, the extension uses Chrome's temporary activeTab access and scripting API to prepare and share that specific image from the selected page. The packaged code executes in Chrome's isolated extension world. It does not inspect unrelated page text, form fields, or browsing history, and does not run persistently across websites.

The selected image URL and bytes are processed in memory. Image requests omit credentials and referrer information and reject redirects. The original image host receives a network request, including your network address, under its own policies. A browser or operating system may retain network caches outside the extension's control.

If page cross-origin restrictions prevent access, the extension tries fetching the selected image from its own context using existing access. If access is missing, a small panel on the original page lets you request an optional permission for that image host. Chrome may retain a grant until you revoke it in extension settings or uninstall the extension. Optional site access is requested only after you choose the extension command. After the first use on a document, the right-click preparation described below can request a right-clicked image before that command is selected.

Pending permission requests are bound to the selected tab and document using a random one-use token. They are held in service worker memory and expire after one minute; expired entries are removed on the next such request or when Chrome stops the worker. No photo history or selection URLs are written to extension storage.

Prepared file data is held in the original page's injected script until the panel is dismissed, another image replaces it, or you leave the page. Successful sharing displays a short completion message and then releases the script's file references. Cancellation clears them. A slow transfer may require an additional in-page click to open sharing.

## Preparation on later image right-clicks

After the first command invocation in a document, a temporary listener in that same document may read the URL of a subsequently right-clicked image and prepare it while the context menu is open. It may fetch and convert that image even if you close the menu or choose another action. This preparation does not open sharing or request optional site permissions. It uses page cross-origin access rules, omits credentials and referrers, rejects redirects, and enforces the same size and format limits. Untrusted synthetic events do not trigger it. No listener is installed on other pages, on page load, or on image hover. Leaving the document removes the listener and releases its cache.

## Short-lived performance caches

Version 0.2.3 prefers Chrome's HTTP cache for the selected image. Chrome may store cached image responses according to its caching behavior. The extension also keeps at most one right-clicked or selected prepared image File, up to 20 MiB, in the original page's isolated script context for 30 seconds, even after cancelling sharing. It expires automatically and is not written to extension storage. Leaving the page destroys that page's script context. Known cross-origin failures are held as at most 100 origin pairs in service worker memory for up to two minutes to avoid repeated unsuccessful requests; they are not a page-visit history.

## System sharing

Clicking the image context-menu command attempts to open the macOS share sheet automatically. Chrome and macOS may create temporary files as part of sharing and manage their cleanup. You select the receiving app. The extension cannot choose Photos for you, see the destination selected, or verify a Photos import.

If you choose Add to Photos, Apple Photos manages the imported copy. iCloud Photos may synchronize it according to your settings. Other destinations receive the image under their own policies. Uninstalling the extension does not remove files from receiving apps or Photos.

## Permissions

- contextMenus: provide the image-only command.
- activeTab: temporarily access the selected page after the menu action.
- scripting: execute the packaged image-sharing code in that page.
- Optional HTTPS host access: retrieve the selected image from a host you approve when page restrictions block it.

There is no storage, cookies, history, downloads, native messaging, or persistent content-script permission. No personal data is sold, used for unrelated purposes, advertising, creditworthiness, or lending.

## Contact and deletion

Contact Homer Gui at homer.curious@gmail.com for support or privacy questions. Dismiss the in-page panel to release its operation references. Leave the page to stop right-click preparation and release its memory cache; the cache also expires automatically after 30 seconds. Remove site grants in Chrome extension settings. Delete imported photos using Apple Photos. 

## Local diagnostic logs

Version 0.2.3 writes elapsed preparation stages to the selected page’s local developer console. The logs contain no image URLs, page contents, or image bytes, and are not uploaded or written to extension storage. Chrome manages developer-console retention.
