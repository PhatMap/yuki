// Keep this helper scoped to small UI preferences and temporary compatibility
// reads. Large story/chapter/chunk/analysis data belongs in IndexedDB.
export function readJsonFromLocalStorage<T>(
  key: string,
  fallback: T,
  validate?: (value: unknown) => value is T,
): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const rawValue = localStorage.getItem(key);

    if (!rawValue) {
      return fallback;
    }

    const parsedValue = JSON.parse(rawValue) as unknown;

    if (validate && !validate(parsedValue)) {
      return fallback;
    }

    return parsedValue as T;
  } catch {
    return fallback;
  }
}
