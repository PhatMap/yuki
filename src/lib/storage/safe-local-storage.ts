export type LocalStorageWriteEntry = {
  key: string;
  value: string;
};

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

export function writeLocalStorageBatch(entries: LocalStorageWriteEntry[]) {
  if (typeof window === "undefined") {
    return false;
  }

  const previousValues = entries.map((entry) => ({
    key: entry.key,
    value: localStorage.getItem(entry.key),
  }));

  try {
    entries.forEach((entry) => {
      localStorage.setItem(entry.key, entry.value);
    });

    return true;
  } catch {
    previousValues.forEach((entry) => {
      try {
        if (entry.value === null) {
          localStorage.removeItem(entry.key);
        } else {
          localStorage.setItem(entry.key, entry.value);
        }
      } catch {
        // Best-effort rollback only.
      }
    });

    return false;
  }
}
