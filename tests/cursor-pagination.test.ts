import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  collectCursorPages,
  mergeUniqueById,
  sortFriendsForChat,
} from "../lib/cursor-pagination";

describe("cursor list helpers", () => {
  test("deduplicates objects by stable ID and keeps the newest value", () => {
    assert.deepEqual(
      mergeUniqueById(
        [
          { id: "1", value: "old" },
          { id: "2", value: "keep" },
        ],
        [
          { id: "1", value: "new" },
          { id: "3", value: "add" },
        ],
      ),
      [
        { id: "1", value: "new" },
        { id: "2", value: "keep" },
        { id: "3", value: "add" },
      ],
    );
  });

  test("walks cursor pages without duplicates", async () => {
    const pages = new Map<
      string | null,
      {
        items: { id: string }[];
        hasMore: boolean;
        nextCursor: string | null;
      }
    >([
      [
        null,
        {
          items: [{ id: "1" }, { id: "2" }],
          hasMore: true,
          nextCursor: "next",
        },
      ],
      [
        "next",
        {
          items: [{ id: "2" }, { id: "3" }],
          hasMore: false,
          nextCursor: null,
        },
      ],
    ]);
    const items = await collectCursorPages(
      async (cursor) => pages.get(cursor)!,
      () => true,
    );
    assert.deepEqual(
      items?.map((item) => item.id),
      ["1", "2", "3"],
    );
  });

  test("ignores a stale response before it can replace current state", async () => {
    let current = true;
    const items = await collectCursorPages(
      async () => {
        current = false;
        return { items: [{ id: "1" }], hasMore: false, nextCursor: null };
      },
      () => current,
    );
    assert.equal(items, null);
  });

  test("preserves favorite and recent chat ordering after traversal", () => {
    const sorted = sortFriendsForChat([
      { id: "1", username: "Amy", favorite: false, recentAt: null },
      { id: "2", username: "Zed", favorite: true, recentAt: null },
      {
        id: "3",
        username: "Bob",
        favorite: false,
        recentAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    assert.deepEqual(
      sorted.map((friend) => friend.id),
      ["2", "3", "1"],
    );
  });
});
