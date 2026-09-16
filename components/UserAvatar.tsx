const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "") ?? "";

export const avatarSource = (avatarUrl: string | null | undefined) =>
  avatarUrl
    ? avatarUrl.startsWith("http")
      ? avatarUrl
      : `${apiBaseUrl}${avatarUrl}`
    : null;

export function UserAvatar({
  username,
  avatarUrl,
  className = "user-avatar",
}: {
  username: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  const source = avatarSource(avatarUrl);
  return (
    <span className={className} aria-hidden="true">
      {source ? (
        // Avatar URLs are validated and issued by the authenticated backend.
        <img src={source} alt="" />
      ) : (
        username.trim().charAt(0).toLocaleUpperCase() || "P"
      )}
    </span>
  );
}
