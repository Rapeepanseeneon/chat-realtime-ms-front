import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyMessageMutation,
  mergeMessages,
  parsePrivateMessage,
  parseServerMessage,
} from "../lib/chat-events";
import type { PrivateMessage } from "../lib/chat-types";

const original: PrivateMessage = {
  id: "1",
  senderId: "10",
  receiverId: "20",
  messageText: "old",
  createdAt: "2026-09-13T00:00:00.000Z",
  readAt: null,
  editedAt: null,
  deletedAt: null,
  replyToMessageId: null,
  reply: null,
};
const reply: PrivateMessage = {
  ...original,
  id: "2",
  senderId: "20",
  receiverId: "10",
  messageText: "reply",
  replyToMessageId: "1",
  reply: {
    id: "1",
    senderId: "10",
    messageText: "old",
    editedAt: null,
    deletedAt: null,
  },
};
const edited = {
  ...original,
  messageText: "new",
  editedAt: "2026-09-13T00:01:00.000Z",
};
const deleted = {
  ...edited,
  messageText: "",
  deletedAt: "2026-09-13T00:02:00.000Z",
};

test("history racing with realtime cannot regress edits, tombstones or seen", () => {
  const seen = { ...edited, readAt: "2026-09-13T00:01:30.000Z" };
  const merged = mergeMessages([seen], [original, original]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].messageText, "new");
  assert.equal(merged[0].readAt, seen.readAt);
  assert.equal(mergeMessages([deleted], [edited, original])[0].messageText, "");
  assert.equal(
    mergeMessages([deleted], [edited])[0].deletedAt,
    deleted.deletedAt,
  );
});
test("reply quotes update outside latest history and cannot resurrect deleted text", () => {
  const updated = applyMessageMutation([reply], edited);
  assert.equal(updated.length, 1);
  assert.equal(updated[0].reply?.messageText, "new");
  const tombstone = applyMessageMutation(updated, deleted);
  assert.equal(tombstone[0].reply?.messageText, "");
  const staleHistory = mergeMessages(tombstone, [reply]);
  assert.equal(staleHistory[0].reply?.deletedAt, deleted.deletedAt);
  assert.equal(staleHistory[0].reply?.messageText, "");
});
test("events validate ids and sanitize deleted content including quotes", () => {
  assert.equal(
    parseServerMessage(
      JSON.stringify({ type: "message.edited", message: edited }),
    )?.type,
    "message.edited",
  );
  assert.equal(
    parsePrivateMessage({ ...deleted, messageText: "must not leak" })
      ?.messageText,
    "",
  );
  assert.equal(
    parsePrivateMessage({
      ...reply,
      reply: {
        ...reply.reply,
        deletedAt: deleted.deletedAt,
        messageText: "must not leak",
      },
    })?.reply?.messageText,
    "",
  );
  assert.equal(parsePrivateMessage({ ...original, id: "invalid" }), null);
  assert.equal(parsePrivateMessage({ ...reply, replyToMessageId: "3" }), null);
});
