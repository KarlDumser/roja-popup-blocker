globalThis.RojaGuardConfig = Object.freeze({
  protectedHosts: Object.freeze([
    "rojadirecta.cat",
    "rojadirecta.eu",
    "dotplay.click",
    "elgoles.lol",
    "forprivateuse.sbs",
    "freesportshd.site",
    "gomstrieam.shop",
    "lnky.fun",
    "mycloudstream.io",
    "nonstopservice.org",
    "pianoplays.biz",
    "polocruz10.pages.dev",
    "regames4u.cfd",
    "sebn.dad",
    "shazysport.pro",
    "shd247.world",
    "sportsinjection.group",
    "sportsonline.website",
    "sportsonnline.click",
    "techusman.lol",
    "vivtops.st",
    "wheelsports.lol",
    "wildgames.bz",
    "wixfree.lol",
    "ytstreams.club",
    "dyntheme.net",
    "nexa.st",
    "matchli.st"
  ]),

  adTokens: Object.freeze([
    "ad-300",
    "ad-728",
    "ad-container",
    "ad-overlay",
    "adclicklayer",
    "adsbox",
    "advert",
    "click-catcher",
    "interstitial",
    "first-click-ads-layer",
    "delayed-popup-ads-layer",
    "popunder",
    "popup-ad",
    "publicidad"
  ]),

  isProtectedHost(hostname) {
    const host = String(hostname || "").toLowerCase().replace(/^www\./, "");
    return this.protectedHosts.some((entry) => host === entry || host.endsWith(`.${entry}`));
  }
});
