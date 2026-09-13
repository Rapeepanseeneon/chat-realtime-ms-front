import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyMessageMutation,
  mergeMessages,
  parsePrivateMessage,
  parseServerMessage,
  applyReadReceipt,
} from "../lib/chat-events";
import type { PrivateMessage } from "../lib/chat-types";

const original: PrivateMessage = {
  id: "1",
  senderId: "10",
  receiverId: "20",
  messageText: "old",
  createdAt: "2026-09-13T00:00:00.000Z",
  readAt: null,
  messageStatus: "sent",
  scheduledAt: null,
  releasedAt: null,
  stateUpdatedAt: null,
  deliveryId: "1",
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

test("ghost schedule/release snapshots cannot regress and reads exclude hidden drafts", () => {
  const ghost: PrivateMessage = {
    ...original,
    messageStatus: "ghost",
    deliveryId: null,
    stateUpdatedAt: "2026-09-13T00:00:00.000Z",
  };
  const scheduled: PrivateMessage = {
    ...ghost,
    messageStatus: "scheduled",
    scheduledAt: "2026-09-14T00:00:00.000Z",
    stateUpdatedAt: "2026-09-13T00:01:00.000Z",
  };
  const cancelledSchedule: PrivateMessage = {
    ...ghost,
    stateUpdatedAt: "2026-09-13T00:02:00.000Z",
  };
  assert.equal(
    mergeMessages([cancelledSchedule], [scheduled])[0].messageStatus,
    "ghost",
  );
  const released: PrivateMessage = {
    ...ghost,
    messageStatus: "sent",
    deliveryId: "30",
    releasedAt: "2026-09-13T00:03:00.000Z",
    stateUpdatedAt: "2026-09-13T00:03:00.000Z",
  };
  assert.equal(
    mergeMessages([released], [scheduled, ghost])[0].messageStatus,
    "sent",
  );
  const laterNormal = {
    ...original,
    id: "20",
    deliveryId: "20",
    createdAt: released.createdAt,
  };
  assert.deepEqual(
    mergeMessages([released], [laterNormal]).map((message) => message.id),
    ["20", "1"],
  );
  const receipt = {
    type: "message.read" as const,
    readerId: "20",
    senderId: "10",
    throughMessageId: "20",
    throughDeliveryId: "20",
    readAt: "2026-09-13T00:02:30.000Z",
  };
  assert.equal(applyReadReceipt([ghost], receipt)[0].readAt, null);
  assert.equal(applyReadReceipt([released], receipt)[0].readAt, null);
  assert.equal(
    applyReadReceipt([released], {
      ...receipt,
      throughMessageId: "1",
      throughDeliveryId: "30",
    })[0].readAt,
    receipt.readAt,
  );
  const removed: PrivateMessage = {
    ...ghost,
    messageStatus: "cancelled",
    deletedAt: "2026-09-13T00:04:00.000Z",
    stateUpdatedAt: "2026-09-13T00:04:00.000Z",
    messageText: "",
  };
  assert.equal(mergeMessages([removed], [ghost]).length, 0);
});
