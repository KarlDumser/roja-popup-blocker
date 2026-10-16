(() => {
  "use strict";

  const config = globalThis.RojaGuardConfig;
  if (!config) return;

  const staticallyProtected = config.isProtectedHost(location.hostname);
  let protectedPage = false;
  let enabled = false;
  let observer;
  let started = false;

  const forcedAdSelectors = [
    "#adClickLayer",
    "#adsNativeContainer",
    "#first-click-ads-layer",
    ".delayed-popup-ads-layer",
    ".ad-300",
    ".ad-320-box",
    ".ad-468-box",
    ".ad-728",
    ".native-ad",
    "[aria-label='Advertisement']"
  ];

  const report = (kind, value = "") => {
    chrome.runtime.sendMessage({
      type: "ROJA_GUARD_BLOCKED",
      kind,
      value: String(value).slice(0, 500)
    }).catch(() => {});
  };

  const elementLabel = (element) => [
    element.id,
    typeof element.className === "string" ? element.className : "",
    element.getAttribute?.("aria-label") || ""
  ].join(" ").toLowerCase();

  const isMediaControl = (element) => Boolean(element.closest?.(
    "video, audio, iframe, button, input, select, [role='button'], [role='slider']"
  ));

  const hasAdToken = (element) => {
    const label = elementLabel(element);
    return config.adTokens.some((token) => label.includes(token));
  };

  const isLargeOverlay = (element) => {
    if (!(element instanceof HTMLElement) || isMediaControl(element)) return false;

    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (style.position !== "fixed" && style.position !== "absolute") return false;

    const rect = element.getBoundingClientRect();
    const viewportArea = Math.max(1, innerWidth * innerHeight);
    const elementArea = Math.max(0, rect.width) * Math.max(0, rect.height);
    const zIndex = Number.parseInt(style.zIndex, 10) || 0;
    const looksLikeAd = hasAdToken(element) || element.matches("a, [onclick], [onmouseup]") ||
      Boolean(element.querySelector("a, img, [onclick], [onmouseup]"));

    return looksLikeAd && zIndex >= 500 && elementArea / viewportArea >= 0.35;
  };

  const removeElement = (element, reason) => {
    if (!element?.isConnected) return false;
    element.remove();
    report(reason, elementLabel(element));
    return true;
  };

  const clean = (root = document) => {
    if (!protectedPage || !enabled || !root.querySelectorAll) return;

    const forced = [];
    if (root instanceof Element && root.matches(forcedAdSelectors.join(","))) forced.push(root);
    forced.push(...root.querySelectorAll(forcedAdSelectors.join(",")));
    for (const element of forced) removeElement(element, "player-ad-overlay");

    if (root instanceof Element && hasAdToken(root) && !isMediaControl(root)) {
      removeElement(root, "ad-element");
      return;
    }

    const candidates = root.querySelectorAll([
      ".ad-300",
      ".ad-320-box",
      ".ad-468-box",
      ".ad-728",
      ".adsbox",
      ".ad-overlay",
      ".popup-ad",
      "[id^='ad-']",
      "[class~='publicidad']",
      "[class~='popunder']",
      "[class~='interstitial']"
    ].join(","));

    for (const element of candidates) {
      if (!isMediaControl(element)) removeElement(element, "ad-element");
    }

    const overlayCandidates = root.querySelectorAll("body > div, body > a, [style*='z-index']");
    for (const element of overlayCandidates) {
      if (isLargeOverlay(element)) removeElement(element, "overlay");
    }
  };

  const setEnabled = (nextEnabled) => {
    enabled = protectedPage && nextEnabled;
    if (document.documentElement) {
      document.documentElement.dataset.rojaGuardActive = String(protectedPage);
      document.documentElement.dataset.rojaGuardDisabled = String(!enabled);
    }
    if (enabled) clean();
  };

  document.addEventListener("rojaguard:blocked", (event) => {
    if (enabled) report(event.detail?.kind || "popup", event.detail?.value || "");
  });

  document.addEventListener("pointerdown", (event) => {
    if (!enabled) return;
    const overlay = event.target instanceof Element
      ? event.target.closest("a, div, span")
      : null;
    if (overlay && isLargeOverlay(overlay)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      removeElement(overlay, "click-overlay");
    }
  }, true);

  const start = () => {
    if (started || !protectedPage) return;
    started = true;

    const style = document.createElement("style");
    style.dataset.rojaGuardStyle = "true";
    style.textContent = `${forcedAdSelectors.join(",")} {
      display: none !important;
      pointer-events: none !important;
      visibility: hidden !important;
    }`;
    (document.head || document.documentElement).appendChild(style);

    clean();
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) {
            if (isLargeOverlay(node)) removeElement(node, "dynamic-overlay");
            else clean(node);
          }
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "ROJA_GUARD_SET_ENABLED" && protectedPage) {
      setEnabled(Boolean(message.enabled));
      sendResponse({ ok: true, enabled });
    }
  });

  const activate = async () => {
    let status = { protected: staticallyProtected, enabled: staticallyProtected };
    try {
      status = await chrome.runtime.sendMessage({
        type: "ROJA_GUARD_GET_PROTECTION",
        url: location.href,
        referrer: document.referrer
      });
    } catch {
      // Static host protection still works if the service worker is restarting.
    }

    protectedPage = staticallyProtected || Boolean(status?.protected);
    if (!protectedPage) return;
    setEnabled(staticallyProtected ? status?.enabled !== false : Boolean(status?.enabled));

    if (document.documentElement) start();
    else document.addEventListener("DOMContentLoaded", start, { once: true });
  };

  void activate();
})();
