export interface BrowserStoragePersistenceResult {
  supported: boolean;
  requested: boolean;
  persistedBefore?: boolean;
  persistedAfter?: boolean;
  granted: boolean;
  message: string;
}

export async function requestBrowserStoragePersistence(): Promise<BrowserStoragePersistenceResult> {
  if (typeof navigator === "undefined" || !navigator.storage) {
    return {
      supported: false,
      requested: false,
      granted: false,
      message: "Storage Manager API is not available in this runtime.",
    };
  }

  if (!navigator.storage.persisted || !navigator.storage.persist) {
    return {
      supported: false,
      requested: false,
      granted: false,
      message: "Persistent storage request is not supported by this browser.",
    };
  }

  const persistedBefore = await navigator.storage.persisted();

  if (persistedBefore) {
    return {
      supported: true,
      requested: false,
      persistedBefore,
      persistedAfter: true,
      granted: true,
      message: "Persistent storage is already enabled for this origin.",
    };
  }

  const persistedAfter = await navigator.storage.persist();

  return {
    supported: true,
    requested: true,
    persistedBefore,
    persistedAfter,
    granted: persistedAfter,
    message: persistedAfter
      ? "Persistent storage request was granted for this origin."
      : "Persistent storage request was not granted by the browser.",
  };
}
