import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configCode = await readFile(path.join(root, "extension/config.js"), "utf8");
const guardCode = await readFile(path.join(root, "extension/main-world-guard.js"), "utf8");

const createContext = (hostname) => {
  const calls = [];
  const events = [];
  const window = {
    open(...args) {
      calls.push(args);
      return { opened: true };
    }
  };
  const context = vm.createContext({
    window,
    globalThis: window,
    location: { hostname, href: `https://${hostname}/watch`, origin: `https://${hostname}` },
    document: {
      documentElement: { dataset: {} },
      dispatchEvent(event) { events.push(event); }
    },
    CustomEvent: class CustomEvent { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    URL
  });
  vm.runInContext(configCode, context);
  vm.runInContext(guardCode, context);
  return { window, calls, events, context };
};

test("blocks external and blank popups on a protected streaming host", () => {
  const { window, calls, events } = createContext("polocruz10.pages.dev");
  assert.equal(window.open("https://ads.example/pop"), null);
  assert.equal(window.open(), null);
  assert.equal(calls.length, 0);
  assert.equal(events.length, 2);
});

test("allows same-origin windows and respects the pause switch", () => {
  const { window, calls, context } = createContext("polocruz10.pages.dev");
  assert.deepEqual(window.open("/help"), { opened: true });
  context.document.documentElement.dataset.rojaGuardDisabled = "true";
  assert.deepEqual(window.open("https://ads.example/pop"), { opened: true });
  assert.equal(calls.length, 2);
});

test("does not patch window.open on an unrelated host", () => {
  const { window, calls } = createContext("example.com");
  assert.deepEqual(window.open("https://another.example"), { opened: true });
  assert.equal(calls.length, 1);
});

