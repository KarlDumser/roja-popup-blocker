globalThis.RojaTabPolicy = Object.freeze({
  portalHosts: Object.freeze([
    "rojadirecta.cat",
    "rojadirecta.eu"
  ]),

  hostnameFromUrl(value) {
    try {
      return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return "";
    }
  },

  originFromUrl(value) {
    try {
      return new URL(value).origin;
    } catch {
      return "";
    }
  },

  isPortalHost(hostname) {
    const host = String(hostname || "").toLowerCase().replace(/^www\./, "");
    return this.portalHosts.some((entry) => host === entry || host.endsWith(`.${entry}`));
  },

  shouldClose({ sourceUrl, targetUrl, disabledHosts = [] }) {
    const sourceHost = this.hostnameFromUrl(sourceUrl);
    if (!globalThis.RojaGuardConfig?.isProtectedHost(sourceHost)) return false;
    if (this.isPortalHost(sourceHost)) return false;
    if (disabledHosts.includes(sourceHost)) return false;

    const sourceOrigin = this.originFromUrl(sourceUrl);
    const targetOrigin = this.originFromUrl(targetUrl);

    // Blank targets are the usual first stage of a pop-under. Same-origin tabs
    // remain available for rare player help/settings windows.
    if (!targetOrigin) return true;
    return targetOrigin !== sourceOrigin;
  }
});
