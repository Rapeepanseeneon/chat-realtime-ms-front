import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getServerApiBaseUrl } from "../lib/server-config";

describe("server API configuration", () => {
  test("uses the internal URL for server-side requests", () => {
    assert.equal(
      getServerApiBaseUrl({
        API_INTERNAL_URL: " https://127.0.0.1:3001/ ",
        NEXT_PUBLIC_API_URL: "https://192.168.1.46:3001",
      }),
      "https://127.0.0.1:3001",
    );
  });

  test("keeps the public URL fallback and localhost default", () => {
    assert.equal(
      getServerApiBaseUrl({ NEXT_PUBLIC_API_URL: "http://api.example.test/" }),
      "http://api.example.test",
    );
    assert.equal(getServerApiBaseUrl({}), "http://localhost:3001");
  });
});
