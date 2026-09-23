import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decodeProfileRouteUsername,
  profileApiPath,
} from "../lib/profile-route";

test("profile route decodes once before constructing the username API path", () => {
  const storedUsername = "Person 👌<DEVELOPER_PB>";
  const routeParam = encodeURIComponent(storedUsername);

  const decodedUsername = decodeProfileRouteUsername(routeParam);
  const apiPath = profileApiPath(decodedUsername);

  assert.equal(decodedUsername, storedUsername);
  assert.equal(
    apiPath,
    `/api/profiles/by-username/${encodeURIComponent(storedUsername)}`,
  );
  assert.equal(apiPath.includes("%2520"), false);
  assert.equal(decodeURIComponent(apiPath.split("/").at(-1)!), storedUsername);
});

test("profile route keeps ordinary usernames unchanged", () => {
  assert.equal(decodeProfileRouteUsername("Alice_42"), "Alice_42");
  assert.equal(
    profileApiPath("Alice_42"),
    "/api/profiles/by-username/Alice_42",
  );
});
