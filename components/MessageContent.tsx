"use client";

import { useState } from "react";
import type { MessageAttachment } from "../lib/chat-types";
import { getApiBaseUrl } from "../lib/runtime-config";

const apiBaseUrl = getApiBaseUrl();
const urlPattern = /(https?:\/\/[^\s<>"']+)/gi;

const safeUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
};

const formatBytes = (bytes: number | null) => {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

function LinkedText({ text }: { text: string }) {
  const pieces = text.split(urlPattern);
  return (
    <p>
      {pieces.map((piece, index) => {
        const url = safeUrl(piece);
        return url ? (
          <a
            key={`${piece}-${index}`}
            href={url.toString()}
            target="_blank"
            rel="noopener noreferrer"
          >
            {piece}
          </a>
        ) : (
          piece
        );
      })}
    </p>
  );
}

export function MessageContent({
  text,
  attachment,
}: {
  text: string;
  attachment: MessageAttachment | null;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const exactLink = safeUrl(text.trim());
  const contentUrl = attachment?.contentUrl
    ? `${apiBaseUrl}${attachment.contentUrl}`
    : null;
  return (
    <>
      {text ? <LinkedText text={text} /> : null}
      {exactLink && !attachment ? (
        <a
          className="message-link-card"
          href={exactLink.toString()}
          target="_blank"
          rel="noopener noreferrer"
        >
          <strong>🔗 {exactLink.hostname}</strong>
          <span>{exactLink.toString()}</span>
        </a>
      ) : null}
      {attachment?.kind === "image" && contentUrl ? (
        <button
          className="message-photo"
          type="button"
          aria-label={`View ${attachment.fileName ?? "photo"} full size`}
          onClick={() => setLightboxOpen(true)}
        >
          <img
            src={contentUrl}
            alt={attachment.fileName ?? "Shared photo"}
            loading="lazy"
          />
        </button>
      ) : null}
      {attachment?.kind === "file" && contentUrl ? (
        <div className="message-file-card">
          <span aria-hidden="true">📎</span>
          <div>
            <strong>{attachment.fileName ?? "Attachment"}</strong>
            <small>{formatBytes(attachment.sizeBytes)}</small>
          </div>
          <a href={contentUrl} download={attachment.fileName ?? undefined}>
            Download
          </a>
        </div>
      ) : null}
      {attachment?.kind === "location" &&
      attachment.latitude != null &&
      attachment.longitude != null ? (
        <div className="message-location-card">
          <span aria-hidden="true">📍</span>
          <div>
            <strong>Shared location</strong>
            <small>
              {attachment.latitude.toFixed(5)},{" "}
              {attachment.longitude.toFixed(5)}
            </small>
          </div>
          <a
            href={`https://www.google.com/maps?q=${attachment.latitude},${attachment.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Map
          </a>
        </div>
      ) : null}
      {lightboxOpen && contentUrl ? (
        <div
          className="attachment-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Photo preview"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLightboxOpen(false);
          }}
        >
          <button
            type="button"
            aria-label="Close photo preview"
            onClick={() => setLightboxOpen(false)}
          >
            ×
          </button>
          <img src={contentUrl} alt={attachment?.fileName ?? "Shared photo"} />
        </div>
      ) : null}
    </>
  );
}
