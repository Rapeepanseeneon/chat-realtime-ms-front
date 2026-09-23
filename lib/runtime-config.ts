const configuredApiUrl =
  process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "") ?? "";
const configuredWebSocketUrl =
  process.env.NEXT_PUBLIC_WS_URL?.trim().replace(/\/$/, "") ?? "";
const useCurrentHost = process.env.NEXT_PUBLIC_USE_CURRENT_HOST === "true";

export const resolveRuntimeUrl = (
  configuredUrl: string,
  options: {
    useCurrentHost: boolean;
    hostname?: string;
    pageProtocol?: string;
    websocket: boolean;
  },
) => {
  if (!configuredUrl || !options.useCurrentHost || !options.hostname)
    return configuredUrl;
  try {
    const url = new URL(configuredUrl);
    url.hostname = options.hostname;
    if (options.pageProtocol === "https:")
      url.protocol = options.websocket ? "wss:" : "https:";
    return url.toString().replace(/\/$/, "");
  } catch {
    return configuredUrl;
  }
};

const withBrowserHost = (configuredUrl: string, websocket: boolean) =>
  resolveRuntimeUrl(configuredUrl, {
    useCurrentHost,
    hostname:
      typeof window === "undefined" ? undefined : window.location.hostname,
    pageProtocol:
      typeof window === "undefined" ? undefined : window.location.protocol,
    websocket,
  });

export const getApiBaseUrl = () => withBrowserHost(configuredApiUrl, false);
export const getWebSocketUrl = () =>
  withBrowserHost(configuredWebSocketUrl, true);
