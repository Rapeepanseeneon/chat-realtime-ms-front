"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { ChatFriend, ChatGroup, GroupInfo } from "../lib/chat-types";
import { UserAvatar } from "./UserAvatar";
const api = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "");
type Props = {
  isOpen: boolean;
  group: ChatGroup | null;
  friends: ChatFriend[];
  onClose: () => void;
  onChanged: (group?: ChatGroup, left?: boolean) => void;
};
export function GroupManager({
  isOpen,
  group,
  friends,
  onClose,
  onChanged,
}: Props) {
  const [name, setName] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [info, setInfo] = useState<GroupInfo | null>(null),
    [error, setError] = useState<string | null>(null),
    [pending, setPending] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setName(group?.name ?? "");
    setSelected([]);
    if (!group) {
      setInfo(null);
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      try {
        const r = await fetch(`${api}/api/groups/${group.id}`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!r.ok) throw Error();
        setInfo(((await r.json()) as { group: GroupInfo }).group);
      } catch (e) {
        if (!(e instanceof Error && e.name === "AbortError"))
          setError("Group info could not be loaded.");
      }
    };
    void load();
    return () => controller.abort();
  }, [isOpen, group]);
  if (!isOpen) return null;
  const request = async (body: unknown) => {
    setPending(true);
    setError(null);
    try {
      const r = await fetch(
        group ? `${api}/api/groups/${group.id}` : `${api}/api/groups`,
        {
          method: group ? "PUT" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const value = (await r.json()) as { error?: string; group?: ChatGroup };
      if (!r.ok) throw Error(value.error ?? "Group could not be updated.");
      const left =
        typeof body === "object" &&
        body !== null &&
        "action" in body &&
        body.action === "leave";
      onChanged(value.group, left);
      if (!group) onClose();
      else {
        setInfo(null);
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Group could not be updated.");
    } finally {
      setPending(false);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void request(
      group ? { action: "rename", name } : { name, memberIds: selected },
    );
  };
  const available = friends.filter(
    (friend) => !info?.members.some((member) => member.id === friend.id),
  );
  return (
    <div
      className="friend-dialog-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="friend-dialog group-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-dialog-title"
      >
        <div className="friend-dialog-header">
          <div>
            <p className="eyebrow">Pb Messenger</p>
            <h2 id="group-dialog-title">
              {group ? "Group info" : "Create Group"}
            </h2>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <label className="field">
            <span>Group Name</span>
            <input
              value={name}
              maxLength={80}
              required
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {!group ? (
            <fieldset className="group-member-picker">
              <legend>Select friends</legend>
              {friends.map((friend) => (
                <label key={friend.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(friend.id)}
                    onChange={() =>
                      setSelected((ids) =>
                        ids.includes(friend.id)
                          ? ids.filter((id) => id !== friend.id)
                          : [...ids, friend.id],
                      )
                    }
                  />
                  <span className="sidebar-contact-avatar">
                    {friend.username[0]?.toUpperCase()}
                  </span>
                  {friend.username}
                </label>
              ))}
            </fieldset>
          ) : null}
          {info ? (
            <div className="group-info-list">
              <p>
                <strong>{info.memberCount}</strong> members · Created{" "}
                {new Date(info.createdAt).toLocaleDateString()}
              </p>
              {info.members.map((member) => (
                <div key={member.id}>
                  <span>
                    <UserAvatar
                      username={member.username}
                      avatarUrl={member.avatarUrl}
                      className="sidebar-contact-avatar"
                    />
                    {member.username}
                    {member.role === "owner" ? " · Owner" : ""}
                  </span>
                  {info.role === "owner" && member.role !== "owner" ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        void request({ action: "remove", userId: member.id })
                      }
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
              {info.role === "owner" && available.length ? (
                <label className="field">
                  <span>Add accepted friend</span>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value)
                        void request({ action: "add", userId: e.target.value });
                    }}
                  >
                    <option value="">Choose friend…</option>
                    {available.map((friend) => (
                      <option key={friend.id} value={friend.id}>
                        {friend.username}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}
          {error ? (
            <p className="form-message form-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="form-actions">
            <button
              className="button button-primary"
              disabled={pending || !name.trim()}
            >
              {pending ? "Please wait…" : group ? "Save name" : "Create Group"}
            </button>
            {group ? (
              <button
                type="button"
                className="button button-ghost"
                disabled={pending}
                onClick={() => void request({ action: "leave" })}
              >
                {info?.role === "owner"
                  ? "Leave & transfer ownership"
                  : "Leave group"}
              </button>
            ) : null}
            <button
              type="button"
              className="button button-ghost"
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
