"use strict";

importScripts("config.js", "tab-policy.js");

const closingTabs = new Set();
let statsUpdate = Promise.resolve();

const recordBlocked = () => {
  statsUpdate = statsUpdate
    .then(() => chrome.storage.local.get("blockedTotal"))
    .then(({ blockedTotal = 0 }) => chrome.storage.local.set({ blockedTotal: blockedTotal + 1 }))
    .catch(() => {});
  return statsUpdate;
};

const closeSpamTab = async ({ sourceTabId, targetTabId, targetUrl = "" }) => {
  if (!Number.isInteger(sourceTabId) || !Number.isInteger(targetTabId)) return;
  if (sourceTabId === targetTabId || closingTabs.has(targetTabId)) return;

  try {
    const [sourceTab, { disabledHosts = [] }] = await Promise.all([
      chrome.tabs.get(sourceTabId),
      chrome.storage.local.get("disabledHosts")
    ]);

    const shouldClose = globalThis.RojaTabPolicy.shouldClose({
      sourceUrl: sourceTab.url || sourceTab.pendingUrl || "",
      targetUrl,
      disabledHosts
    });
    if (!shouldClose) return;

    closingTabs.add(targetTabId);
    await chrome.tabs.remove(targetTabId);
    await recordBlocked();
  } catch {
    // Chrome may dispatch both creation events after the tab is already gone.
  } finally {
    closingTabs.delete(targetTabId);
  }
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["disabledHosts", "blockedTotal"]).then((stored) => {
    return chrome.storage.local.set({
      disabledHosts: Array.isArray(stored.disabledHosts) ? stored.disabledHosts : [],
      blockedTotal: Number.isFinite(stored.blockedTotal) ? stored.blockedTotal : 0
    });
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "ROJA_GUARD_BLOCKED") recordBlocked();
});

chrome.tabs.onCreated.addListener((tab) => {
  if (!Number.isInteger(tab.openerTabId) || !Number.isInteger(tab.id)) return;
  void closeSpamTab({
    sourceTabId: tab.openerTabId,
    targetTabId: tab.id,
    targetUrl: tab.pendingUrl || tab.url || ""
  });
});

chrome.webNavigation.onCreatedNavigationTarget.addListener((details) => {
  void closeSpamTab({
    sourceTabId: details.sourceTabId,
    targetTabId: details.tabId,
    targetUrl: details.url || ""
  });
});
