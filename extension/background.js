"use strict";

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["disabledHosts", "blockedTotal"]).then((stored) => {
    return chrome.storage.local.set({
      disabledHosts: Array.isArray(stored.disabledHosts) ? stored.disabledHosts : [],
      blockedTotal: Number.isFinite(stored.blockedTotal) ? stored.blockedTotal : 0
    });
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "ROJA_GUARD_BLOCKED") return;

  chrome.storage.local.get("blockedTotal").then(({ blockedTotal = 0 }) => {
    return chrome.storage.local.set({ blockedTotal: blockedTotal + 1 });
  });
});

