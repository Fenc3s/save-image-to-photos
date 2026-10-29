# Frame timing and version 0.2.3 validation

## Outcome

Version 0.2.3 adds preparation during subsequent image context menus in the document where the extension has already been used. It uses exactly the same manifest permissions as 0.2.2. It was reloaded in Chrome and the X warmup route was exercised successfully. No store upload or submission was performed. Sharing tests were cancelled without selecting a destination.

## Measurement method

The user authorized a short local recording using macOS `screencapture`. The first main-display recording did not contain Chrome and was excluded. Chrome was on display 3; a new 25-second recording on that display contains both complete X tests. Native AVFoundation decoded the captured presentation timestamps. Relevant frames are approximately 16.7 ms apart; some requested extraction times return the previous actual frame, so the actual timestamp printed by the decoder is authoritative. The figures use those actual timestamps.

Time zero is the first video frame in which the selected Save Image to Photos context menu begins visibly fading after activation. The endpoint is the first visually detectable appearance of the system share popover. This measures the visible transition, including the remaining context-menu dismissal animation, without accessibility-tree reading overhead. It is not an instrumented mouse-release or native API-entry timestamp. Each visual boundary has roughly one to two frames of uncertainty; two warm trials cannot establish a population average or a cold-start guarantee.

## Measured warm X trials, version 0.2.2 baseline

| Trial | Context menu begins fading | Share first visible | Visible transition | Expanded menu visible by |
| --- | ---: | ---: | ---: | ---: |
| 1 | 11.433 s | 12.067 s | About 0.63 s | 12.233 s, about 0.80 s after transition starts |
| 2 | 18.417 s | About 18.833 s | About 0.42 s | 19.100 s, about 0.68 s after transition starts |

The second onset is extremely faint; it becomes obvious over the following two frames. Values are rounded and should not be presented as exact millisecond-level native latency. The console logs for those same selections reached `navigator.share` in 8 ms and 12 ms. The two warm transitions did not reproduce a 2–3-second visible wait. Earlier 2.37–2.39-second accessibility observations must not be treated as native menu-opening times.

A later clean-page test of version 0.2.3 took 993 ms to prepare and invoke sharing. The earlier 0.2.2 cold test took 1,238 ms. These are separate runs under different cache/network conditions, not a controlled before/after performance comparison. They show that image preparation can still add approximately a second before the native transition. Do not claim the cold experience is fixed or that a slow network can never cause a 2–3-second total wait.

## New optimization and its limits

The first explicit command installs a context-menu listener only in that document. Later trusted right-clicks on image elements can start preparing their HTTPS currentSrc while the native image menu is open. The original page's CORS restrictions still apply. There is no network activity on page load or hover, no new host grant, and no all-sites listener. Preparation may fetch and convert an image even if the menu is dismissed or another menu action is selected. This behavior is disclosed in the packaged help and privacy policy.

A selected command joins matching in-flight preparation or reuses the prepared File, avoiding another page request. Background permission requests and native sharing remain behind the explicit command. The existing size, format, credential, redirect, one-file cache, and timeout restrictions remain. Navigation removes the listener and clears the cache. A right-click on another image aborts the previous preparation.

Live X evidence at 08:54 UTC:

- Trusted right-click started preparation at 08:54:12.294 UTC.
- Image bytes were ready after 62 ms and the File after 63 ms, while the image context menu was still open.
- Selecting Save Image to Photos at 08:54:25.728 UTC joined that preparation, reused the File, and called Web Share after 10 ms.
- The native share sheet was visibly present, including Add to Photos; it was then cancelled.

This establishes the implemented route, not a matched end-to-end speedup percentage. The selection delay in this automated trial was longer than a typical human menu choice. With a faster choice the command waits only for the unfinished part of preparation. The first command on a newly loaded document receives no warmup benefit. CORS-blocked image hosts still need the existing explicit-command fallback. No claim of constant or instantaneous OS menu presentation is made.

## Validation and artifacts

All 24 Node tests passed, including in-flight request joining, absence of automatic sharing, trusted-event and URL restrictions, quiet CORS handoff, authorized worker-byte fallback after warmup failure, and navigation cleanup. Comparing manifests confirmed identical required and optional permissions and no content_scripts entry. The native UI confirmed version 0.2.3 enabled.

- `diagnostic-logs-0.2.3.json`: local console stage evidence.
- `../../share-frame-timing.png`: cropped, timestamped recording frames.
- `../../share-diagnostic-0.2.3.png`: live native share-sheet screenshot.
- The original local recording and frame-analysis source are retained in the workspace work directory. Nothing was uploaded.

The packaged policy describes the new right-click behavior. The live privacy site and Chrome Web Store submission still describe the previously submitted version; they must be updated together before submitting this version.
