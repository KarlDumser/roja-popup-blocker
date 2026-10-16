(() => {
  "use strict";

  const config = globalThis.RojaGuardConfig;
  if (!config) return;

  const originalOpen = window.open.bind(window);
  const staticallyProtected = config.isProtectedHost(location.hostname);
  const active = () => staticallyProtected ||
    document.documentElement?.dataset.rojaGuardActive === "true";
  const disabled = () => document.documentElement?.dataset.rojaGuardDisabled === "true";

  const resolveUrl = (value) => {
    if (typeof value !== "string" || value.trim() === "") return null;
    try {
      return new URL(value, location.href);
    } catch {
      return null;
    }
  };

  const report = (kind, value = "") => {
    document.dispatchEvent(new CustomEvent("rojaguard:blocked", {
      detail: { kind, value: String(value).slice(0, 500) }
    }));
  };

  const guardedOpen = function guardedOpen(url, target, features) {
    if (!active() || disabled()) return originalOpen(url, target, features);

    const parsed = resolveUrl(url);
    if (parsed && parsed.origin === location.origin) {
      return originalOpen(url, target, features);
    }

    report("popup", parsed?.href || url || "about:blank");
    return null;
  };

  Object.defineProperty(guardedOpen, "name", { value: "open" });
  Object.defineProperty(window, "open", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: guardedOpen
  });
})();

