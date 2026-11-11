import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { classifyGeneratedContent, filterLibrary } from "./library-content";
import { addLibraryItem, readLibrary, removeLibraryItem, saveGeneratedContent, LIBRARY_CHANGED } from "./library";

beforeAll(() => { vi.stubGlobal("window", new EventTarget()); });

describe("generated library", () => {
  it("puts generated images in Images", async () => {
    await addLibraryItem({ kind: "image", title: "Cat", url: "data:image/png;base64,Y2F0" }, "images-user");
    const items = filterLibrary(await readLibrary("images-user"), "image");
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe("data:image/png;base64,Y2F0");
  });
  it("puts generated code in Code, not Text", () => {
    expect(classifyGeneratedContent("```js\nconst x = 42;\n```", "Example"))
      .toEqual([{ kind: "code", title: "Example · js", body: "const x = 42;" }]);
  });
  it("puts generated prose in Text", () => {
    expect(classifyGeneratedContent("Hello world", "Greeting"))
      .toEqual([{ kind: "text", title: "Greeting", body: "Hello world" }]);
  });
  it("puts all three categories in All", async () => {
    await addLibraryItem({ kind: "image", title: "Image", url: "image.png" }, "all-user");
    await saveGeneratedContent("Explanation\n```ts\nconst value = 1;\n```", "Code", "all-user");
    const all = filterLibrary(await readLibrary("all-user"), "all");
    expect(all.map((item) => item.kind).sort()).toEqual(["code", "image", "text"]);
  });
  it("persists large image content beyond localStorage-sized payloads", async () => {
    const url = "data:image/png;base64," + "a".repeat(6_000_000);
    await addLibraryItem({ kind: "image", title: "Large", url }, "large-user");
    expect((await readLibrary("large-user"))[0].url).toBe(url);
  });
  it("keeps different accounts' libraries separate", async () => {
    await saveGeneratedContent("Private content", "Private", "owner-one");
    expect(await readLibrary("owner-two")).toEqual([]);
  });
  it("notifies the view after save and deletion", async () => {
    const notify = vi.fn();
    window.addEventListener(LIBRARY_CHANGED, notify);
    await saveGeneratedContent("Saved", "Live", "live-user");
    const [item] = await readLibrary("live-user");
    await removeLibraryItem(item.id, "live-user");
    expect(notify).toHaveBeenCalledTimes(2);
    expect(await readLibrary("live-user")).toEqual([]);
    window.removeEventListener(LIBRARY_CHANGED, notify);
  });
  it("does not save empty responses", () => {
    expect(classifyGeneratedContent("  ", "Empty")).toEqual([]);
  });
});