(() => {
  "use strict";

  const hostElement = document.querySelector("#host");
  const statusElement = document.querySelector("#status");
  const explanationElement = document.querySelector("#explanation");
  const enabledInput = document.querySelector("#enabled");
  const blockedElement = document.querySelector("#blocked");

  const init = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ? new URL(tab.url) : null;
    const hostname = url?.hostname || "";
    const supported = globalThis.RojaGuardConfig.isProtectedHost(hostname);
    const { disabledHosts = [], blockedTotal = 0 } = await chrome.storage.local.get([
      "disabledHosts",
      "blockedTotal"
    ]);
    const enabled = supported && !disabledHosts.includes(hostname);

    hostElement.textContent = hostname || "Keine normale Webseite";
    blockedElement.textContent = blockedTotal.toLocaleString("de-DE");
    enabledInput.disabled = !supported;
    enabledInput.checked = enabled;

    if (supported) {
      statusElement.textContent = enabled ? "Schutz aktiv" : "Schutz pausiert";
      explanationElement.textContent = enabled
        ? "Popups und Werbe-Overlays werden entfernt."
        : "Für diesen Host vorübergehend ausgeschaltet.";
    } else {
      statusElement.textContent = "Nicht in der Seitenliste";
      explanationElement.textContent = "Auf dieser Webseite greift der Popup-Schutz nicht ein.";
    }

    enabledInput.addEventListener("change", async () => {
      const next = new Set(disabledHosts);
      if (enabledInput.checked) next.delete(hostname);
      else next.add(hostname);
      await chrome.storage.local.set({ disabledHosts: [...next] });

      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: "ROJA_GUARD_SET_ENABLED",
          enabled: enabledInput.checked
        });
      } catch {
        // The page may need a reload after the extension was first installed.
      }

      statusElement.textContent = enabledInput.checked ? "Schutz aktiv" : "Schutz pausiert";
      explanationElement.textContent = enabledInput.checked
        ? "Popups und Werbe-Overlays werden entfernt."
        : "Für diesen Host vorübergehend ausgeschaltet.";
    });
  };

  init().catch((error) => {
    statusElement.textContent = "Nicht verfügbar";
    explanationElement.textContent = error.message;
    enabledInput.disabled = true;
  });
})();

