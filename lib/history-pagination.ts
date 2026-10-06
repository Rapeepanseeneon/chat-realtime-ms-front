import type { GroupMessage } from "./chat-types";

export const mergeGroupHistory = (
  current: GroupMessage[],
  incoming: GroupMessage[],
) => {
  const byId = new Map(incoming.map((message) => [message.id, message]));
  for (const message of current) byId.set(message.id, message);
  return [...byId.values()].sort((left, right) => {
    const leftId = BigInt(left.id);
    const rightId = BigInt(right.id);
    return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
  });
};

export const anchoredScrollTop = (
  previousScrollHeight: number,
  previousScrollTop: number,
  nextScrollHeight: number,
) =>
  Math.max(
    0,
    previousScrollTop + Math.max(0, nextScrollHeight - previousScrollHeight),
  );

export const historyTarget = (userId: string | null, groupId: string | null) =>
  userId ? `private:${userId}` : groupId ? `group:${groupId}` : "none";

export const isCurrentHistoryResponse = (
  requestGeneration: number,
  currentGeneration: number,
  requestTarget: string,
  currentTarget: string,
) => requestGeneration === currentGeneration && requestTarget === currentTarget;
