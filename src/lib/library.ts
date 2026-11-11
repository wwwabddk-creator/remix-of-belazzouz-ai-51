import { classifyGeneratedContent, type LibItem, type LibraryDraft } from "./library-content";
export type { LibItem, LibKind } from "./library-content";

export const LIBRARY_CHANGED = "belazo:library-changed";
type StoredItem = LibItem & { owner: string; key: string };

function openLibrary(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("belazo-library", 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore("items", { keyPath: "key" });
      store.createIndex("owner", "owner");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readLibrary(owner: string): Promise<LibItem[]> {
  // Keep existing device-local items when upgrading from the original library.
  const legacyKey = "belazzouz.library";
  try {
    const raw = localStorage.getItem(legacyKey);
    if (raw) {
      const legacy: unknown = JSON.parse(raw);
      if (Array.isArray(legacy)) {
        const drafts = legacy.filter((item): item is LibraryDraft =>
          item && typeof item.title === "string" && ["image", "code", "text"].includes(item.kind));
        if (drafts.length) await updateLibrary(owner, drafts, undefined, false);
        localStorage.removeItem(legacyKey);
      }
    }
  } catch { /* Leave legacy data intact if migration cannot complete. */ }
  const db = await openLibrary();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("items").objectStore("items").index("owner").getAll(owner);
      request.onsuccess = () => resolve((request.result as StoredItem[])
        .map(({ owner: _owner, key: _key, ...item }) => item)
        .sort((a, b) => b.createdAt - a.createdAt));
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

async function updateLibrary(owner: string, drafts: LibraryDraft[], removeId?: string, notify = true) {
  const db = await openLibrary();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("items", "readwrite");
      const store = transaction.objectStore("items");
      for (const draft of drafts) {
        const id = crypto.randomUUID();
        store.put({ ...draft, id, owner, key: `${owner}:${id}`, createdAt: Date.now() });
      }
      if (removeId) store.delete(`${owner}:${removeId}`);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("Library save failed"));
    });
    if (notify) window.dispatchEvent(new CustomEvent(LIBRARY_CHANGED, { detail: owner }));
  } finally { db.close(); }
}

export function addLibraryItem(item: LibraryDraft, owner: string) {
  return updateLibrary(owner, [item]);
}

export function saveGeneratedContent(content: string, title: string, owner: string) {
  return updateLibrary(owner, classifyGeneratedContent(content, title));
}

export function removeLibraryItem(id: string, owner: string) {
  return updateLibrary(owner, [], id);
}