type Environment = Record<string, string | undefined>;

const normalizedUrl = (value: string | undefined) =>
  value?.trim().replace(/\/$/, "") || null;

export const getServerApiBaseUrl = (environment: Environment = process.env) =>
  normalizedUrl(environment.API_INTERNAL_URL) ??
  normalizedUrl(environment.NEXT_PUBLIC_API_URL) ??
  "http://localhost:3001";
