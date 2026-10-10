import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const code = await readFile(path.join(root, "extension/config.js"), "utf8");
const context = vm.createContext({});
vm.runInContext(code, context);
const config = context.RojaGuardConfig;

test("matches configured hosts and their subdomains", () => {
  assert.equal(config.isProtectedHost("polocruz10.pages.dev"), true);
  assert.equal(config.isProtectedHost("ww1.sportsonnline.click"), true);
  assert.equal(config.isProtectedHost("WWW.ROJADIRECTA.EU"), true);
});

test("does not activate on unrelated websites", () => {
  assert.equal(config.isProtectedHost("example.com"), false);
  assert.equal(config.isProtectedHost("notrojadirecta.eu"), false);
  assert.equal(config.isProtectedHost("rojadirecta.eu.example.com"), false);
});

