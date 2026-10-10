# Roja Popup Blocker

A small Chrome extension for RojaDirecta and the streaming pages linked from it. It blocks the click-triggered popups, pop-unders, ad scripts, and fullscreen overlays that otherwise appear when you try to use a player.

The extension is deliberately narrower than a general-purpose ad blocker: it activates its DOM and popup protection only on the configured streaming hosts. Network rules block the ad services observed on those pages. Normal video playback and the browser's Fullscreen API remain untouched.

## Install in Chrome

1. Download and unzip the latest release, or clone this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and choose the `extension` folder.
5. Reload an already-open streaming page once.

The toolbar popup lets you temporarily disable protection for the current host if a player needs troubleshooting.

## Updating an unpacked installation

After updating the project files, open `chrome://extensions`, find **Roja Popup Blocker**, click its circular **Reload** button, and then reload the streaming page. Chrome does not automatically reload changed extension service workers.

## Included protection

- blocks popups created with `window.open` on supported streaming hosts;
- immediately closes externally opened spam tabs and pop-unders, even when an ad script bypasses `window.open`;
- removes large fixed click-catcher overlays while preserving video/iframe players;
- blocks observed pop-under, interstitial, and tracking domains with Manifest V3 Declarative Net Request rules;
- watches dynamically inserted nodes, because many ad overlays arrive after the player;
- covers frames as well as the top-level page;
- supports RojaDirecta plus the third-party player hosts collected in `extension/config.js`.

## Development

Node.js 20 or later is enough; there are no third-party build dependencies.

```sh
npm test
npm run check
npm run build
```

`npm run build` validates the extension and creates `dist/roja-popup-blocker-v1.0.0.zip`, ready to install or attach to a GitHub release.

## Adding another streaming host

Add only the registrable host to `protectedHosts` in `extension/config.js`, then run `npm test && npm run check`. Subdomains are matched automatically. Avoid adding normal sites: the popup guard is intentionally strict while active.

## Scope and privacy

The extension stores only two things locally in Chrome: the hosts you paused and a count of blocked page-level items. It sends no browsing data anywhere and contains no analytics. The `<all_urls>` access is needed so protection can run inside changing third-party player frames; the code immediately exits on hosts not listed in `config.js`.

This project is independent and is not affiliated with RojaDirecta or any streaming provider. It does not provide, proxy, decrypt, or modify video streams.
