import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getAuthenticatedDestination } from "../lib/auth-routing";

describe("authenticated routing", () => {
  test("sends existing and onboarded accounts to chat", () => {
    assert.equal(
      getAuthenticatedDestination({ onboardingCompleted: true }),
      "/chat",
    );
  });

  test("sends newly registered accounts to onboarding", () => {
    assert.equal(
      getAuthenticatedDestination({ onboardingCompleted: false }),
      "/onboarding",
    );
  });
});
