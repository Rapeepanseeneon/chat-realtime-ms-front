export type CursorPage<T> = {
  items: T[];
  hasMore: boolean;
  nextCursor: string | null;
};

export const mergeUniqueById = <T extends { id: string }>(
  current: T[],
  incoming: T[],
) => {
  const merged = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) merged.set(item.id, item);
  return [...merged.values()];
};

export const collectCursorPages = async <T extends { id: string }>(
  loadPage: (cursor: string | null) => Promise<CursorPage<T>>,
  isCurrent: () => boolean,
) => {
  let items: T[] = [];
  let cursor: string | null = null;
  const seenCursors = new Set<string>();
  while (true) {
    const page = await loadPage(cursor);
    if (!isCurrent()) return null;
    items = mergeUniqueById(items, page.items);
    if (!page.hasMore) return items;
    if (!page.nextCursor || seenCursors.has(page.nextCursor))
      throw new Error("Pagination cursor did not advance.");
    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }
};

const compareIds = (left: string, right: string) => {
  const leftId = BigInt(left);
  const rightId = BigInt(right);
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
};

export const sortFriendsForChat = <
  T extends {
    id: string;
    username: string;
    favorite: boolean;
    recentAt: string | null;
  },
>(
  friends: T[],
) =>
  [...friends].sort((left, right) => {
    if (left.favorite !== right.favorite) return left.favorite ? -1 : 1;
    if (left.recentAt !== right.recentAt) {
      if (!left.recentAt) return 1;
      if (!right.recentAt) return -1;
      const recent = right.recentAt.localeCompare(left.recentAt);
      if (recent) return recent;
    }
    const username = left.username.localeCompare(right.username, undefined, {
      sensitivity: "base",
    });
    return username || compareIds(left.id, right.id);
  });

export const sortGroupsForChat = <T extends { id: string; updatedAt: string }>(
  groups: T[],
) =>
  [...groups].sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) ||
      compareIds(right.id, left.id),
  );
