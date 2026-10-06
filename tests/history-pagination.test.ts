import { test } from "node:test";
import assert from "node:assert/strict";
import type { GroupMessage } from "../lib/chat-types";
import {
  anchoredScrollTop,
  historyTarget,
  isCurrentHistoryResponse,
  mergeGroupHistory,
} from "../lib/history-pagination";

const groupMessage = (id: string, text = id): GroupMessage => ({
  id,
  groupId: "1",
  senderId: "2",
  senderUsername: "sender",
  senderAvatarUrl: null,
  messageText: text,
  createdAt: "2026-10-06T00:00:00.000Z",
  editedAt: null,
  deletedAt: null,
  replyToMessageId: null,
  attachment: null,
  reply: null,
});

test("older group history prepends numerically and deduplicates realtime rows", () => {
  const current = [groupMessage("10", "realtime"), groupMessage("11")];
  const older = [
    groupMessage("8"),
    groupMessage("9"),
    groupMessage("10", "stale"),
  ];
  const merged = mergeGroupHistory(current, older);
  assert.deepEqual(
    merged.map((message) => message.id),
    ["8", "9", "10", "11"],
  );
  assert.equal(
    merged.find((message) => message.id === "10")?.messageText,
    "realtime",
  );
});

test("prepend scroll anchor keeps the same content in view", () => {
  assert.equal(anchoredScrollTop(1_000, 24, 1_480), 504);
  assert.equal(anchoredScrollTop(1_000, 24, 900), 24);
});

test("responses from a switched conversation are rejected", () => {
  const requestTarget = historyTarget("10", null);
  assert.equal(
    isCurrentHistoryResponse(4, 4, requestTarget, historyTarget("10", null)),
    true,
  );
  assert.equal(
    isCurrentHistoryResponse(4, 5, requestTarget, historyTarget("20", null)),
    false,
  );
  assert.equal(
    isCurrentHistoryResponse(4, 4, requestTarget, historyTarget(null, "10")),
    false,
  );
});
