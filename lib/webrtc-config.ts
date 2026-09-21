const configuredIceServers = process.env.NEXT_PUBLIC_WEBRTC_ICE_SERVERS?.split(
  ",",
)
  .map((url) => url.trim())
  .filter(Boolean);

const configuredIceServerJson = (() => {
  const raw = process.env.NEXT_PUBLIC_WEBRTC_ICE_SERVERS_JSON?.trim();
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !Array.isArray(value) ||
      !value.every(
        (item) =>
          typeof item === "object" &&
          item !== null &&
          (typeof (item as RTCIceServer).urls === "string" ||
            (Array.isArray((item as RTCIceServer).urls) &&
              (item as RTCIceServer).urls.length > 0)),
      )
    )
      return null;
    return value as RTCIceServer[];
  } catch {
    return null;
  }
})();

export const peerConnectionConfig: RTCConfiguration = {
  iceServers:
    configuredIceServerJson ??
    (configuredIceServers?.length
      ? configuredIceServers
      : ["stun:stun.l.google.com:19302"]
    ).map((url) => ({ urls: url })),
};
