"use strict";

importScripts("config.js", "tab-policy.js");

const closingTabs = new Set();
const protectedTabs = new Set();
let statsUpdate = Promise.resolve();

const getStoredState = () => chrome.storage.local.get([
  "disabledHosts",
  "learnedHosts"
]).then(({ disabledHosts = [], learnedHosts = [] }) => ({
  disabledHosts: Array.isArray(disabledHosts) ? disabledHosts : [],
  learnedHosts: Array.isArray(learnedHosts) ? learnedHosts : []
}));

const rememberHost = async (hostname) => {
  const host = String(hostname || "").toLowerCase().replace(/^www\./, "");
  if (!host || globalThis.RojaGuardConfig.isProtectedHost(host)) return;

  const { learnedHosts } = await getStoredState();
  const next = [host, ...learnedHosts.filter((entry) => entry !== host)].slice(0, 200);
  await chrome.storage.local.set({ learnedHosts: next });
};

const protectionFor = async ({ tabId, url = "", referrer = "" }) => {
  let topUrl = url;
  if (Number.isInteger(tabId)) {
    try {
      const tab = await chrome.tabs.get(tabId);
      topUrl = tab.url || tab.pendingUrl || topUrl;
    } catch {
      // The sender may have closed while this message was in flight.
    }
  }

  const hostname = globalThis.RojaTabPolicy.hostnameFromUrl(topUrl);
  const { disabledHosts, learnedHosts } = await getStoredState();
  const referrerHost = globalThis.RojaTabPolicy.hostnameFromUrl(referrer);
  const referredFromProtected = globalThis.RojaTabPolicy.isPortalHost(referrerHost) ||
    globalThis.RojaTabPolicy.isProtectedHost(referrerHost, learnedHosts);
  const protectedPage = protectedTabs.has(tabId) ||
    globalThis.RojaTabPolicy.isProtectedHost(hostname, learnedHosts) ||
    referredFromProtected;

  if (protectedPage) {
    if (Number.isInteger(tabId)) protectedTabs.add(tabId);
    if (referredFromProtected) void rememberHost(hostname);
  }
  return {
    protected: protectedPage,
    enabled: protectedPage && !disabledHosts.includes(hostname),
    hostname
  };
};

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
    const [sourceTab, { disabledHosts, learnedHosts }] = await Promise.all([
      chrome.tabs.get(sourceTabId),
      getStoredState()
    ]);

    const sourceUrl = sourceTab.url || sourceTab.pendingUrl || "";
    const sourceHost = globalThis.RojaTabPolicy.hostnameFromUrl(sourceUrl);
    const effectiveLearnedHosts = protectedTabs.has(sourceTabId)
      ? [sourceHost, ...learnedHosts]
      : learnedHosts;
    const shouldClose = globalThis.RojaTabPolicy.shouldClose({
      sourceUrl,
      targetUrl,
      disabledHosts,
      learnedHosts: effectiveLearnedHosts
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
  chrome.storage.local.get(["disabledHosts", "blockedTotal", "learnedHosts"]).then((stored) => {
    return chrome.storage.local.set({
      disabledHosts: Array.isArray(stored.disabledHosts) ? stored.disabledHosts : [],
      blockedTotal: Number.isFinite(stored.blockedTotal) ? stored.blockedTotal : 0,
      learnedHosts: Array.isArray(stored.learnedHosts) ? stored.learnedHosts : []
    });
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ROJA_GUARD_BLOCKED") {
    recordBlocked();
    return false;
  }

  if (message?.type === "ROJA_GUARD_GET_PROTECTION") {
    protectionFor({
      tabId: sender.tab?.id ?? message.tabId,
      url: sender.tab?.url || message.url || "",
      referrer: message.referrer || ""
    }).then(sendResponse).catch(() => sendResponse({
      protected: false,
      enabled: false,
      hostname: ""
    }));
    return true;
  }

  return false;
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
  void (async () => {
    try {
      const sourceTab = await chrome.tabs.get(details.sourceTabId);
      const sourceUrl = sourceTab.url || sourceTab.pendingUrl || "";
      const sourceHost = globalThis.RojaTabPolicy.hostnameFromUrl(sourceUrl);

      if (globalThis.RojaTabPolicy.isPortalHost(sourceHost)) {
        protectedTabs.add(details.tabId);
        await rememberHost(globalThis.RojaTabPolicy.hostnameFromUrl(details.url));
        return;
      }
    } catch {
      // Fall through to the normal strict tab policy.
    }

    await closeSpamTab({
      sourceTabId: details.sourceTabId,
      targetTabId: details.tabId,
      targetUrl: details.url || ""
    });
  })();
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0 || !protectedTabs.has(details.tabId)) return;
  void rememberHost(globalThis.RojaTabPolicy.hostnameFromUrl(details.url));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  protectedTabs.delete(tabId);
  closingTabs.delete(tabId);
});
