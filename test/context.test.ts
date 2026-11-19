import { afterEach, describe, expect, it, vi } from "vitest";
import { buildContext } from "../src/context.js";

// getIDToken would call the runner's token service; only the exchange with npm is under test.
vi.mock("@actions/core", () => ({ getIDToken: vi.fn().mockResolvedValue("jwt") }));

const INPUTS = { mode: "check", baselineCommit: "", bump: "auto", dryRun: false, githubToken: "" } as const;
const WITH_OIDC = { ACTIONS_ID_TOKEN_REQUEST_URL: "https://token.example/" };
const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status });

describe("exchangeNpmToken", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("npm accepts the identity returns ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ token: "npm-token" })));
    const result = await buildContext(INPUTS, WITH_OIDC).exchangeNpmToken("pkg");
    expect(result).toMatchObject({ ok: true, status: 200 });
  });

  it("npm rejects the identity returns its status and message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ message: "no trusted publisher" }, 401)));
    const result = await buildContext(INPUTS, WITH_OIDC).exchangeNpmToken("pkg");
    expect(result).toEqual({ ok: false, status: 401, message: "no trusted publisher" });
  });

  it("npm does not answer in time returns a failed result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError")));
    const result = await buildContext(INPUTS, WITH_OIDC).exchangeNpmToken("pkg");
    expect(result).toMatchObject({
      ok: false,
      status: 0,
      message: expect.stringContaining("npm did not answer"),
    });
  });

  it("request carries an abort signal so a stalled server cannot hang the job", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ token: "t" }));
    vi.stubGlobal("fetch", fetchMock);
    await buildContext(INPUTS, WITH_OIDC).exchangeNpmToken("pkg");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ signal: expect.any(AbortSignal) });
  });

  it("job has no OIDC token returns a failed result without calling npm", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await buildContext(INPUTS, {}).exchangeNpmToken("pkg");
    expect(result).toEqual({ ok: false, status: 0, message: "no OIDC token available" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("packageExists", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    [200, true],
    [404, false],
    [503, null],
  ])("registry answers %i returns %s", async (status, expected) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));
    expect(await buildContext(INPUTS, {}).packageExists("pkg")).toBe(expected);
  });

  it("registry does not answer returns null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError")));
    expect(await buildContext(INPUTS, {}).packageExists("pkg")).toBeNull();
  });
});
