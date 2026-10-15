import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
// Node 25 exposes an incomplete native localStorage when no backing file is set.
// Use isolated browser-like storage for component tests.
function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(String(key)) ?? null, setItem: (key, value) => values.set(String(key), String(value)),
    removeItem: key => values.delete(String(key)), clear: () => values.clear(), key: i => [...values.keys()][i] ?? null,
    get length() { return values.size; } };
}
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: memoryStorage() });
Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: memoryStorage() });
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); });
