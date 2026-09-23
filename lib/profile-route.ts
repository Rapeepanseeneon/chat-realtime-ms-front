export const decodeProfileRouteUsername = (routeUsername: string) => {
  try {
    return decodeURIComponent(routeUsername);
  } catch {
    return routeUsername;
  }
};

export const profileApiPath = (username: string) =>
  `/api/profiles/by-username/${encodeURIComponent(username)}`;
