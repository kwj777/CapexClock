import { gzipSync } from "node:zlib";
import relay, {
  config,
  relayedResponse,
  RELAY_PREFIX,
  upstreamHeaders,
  upstreamUrl,
} from "../../../netlify/edge-functions/posthog-relay";
import { RELAY_PATH } from "../analytics";

describe("the PostHog relay's path", () => {
  it("is the one the browser sends to, and the one Netlify runs the relay on", () => {
    expect(RELAY_PREFIX).toBe(RELAY_PATH);
    expect(config.path).toBe(`${RELAY_PATH}/*`);
  });
});

describe("upstreamUrl", () => {
  const site = "https://capexclock.com";

  it("sends events and flags to PostHog's events host, with the path and query as they were", () => {
    expect(upstreamUrl(`${site}/clockwork/e/?compression=gzip-js&_=1`)).toBe(
      "https://us.i.posthog.com/e/?compression=gzip-js&_=1",
    );
    expect(upstreamUrl(`${site}/clockwork/i/v0/e/?_=1`)).toBe("https://us.i.posthog.com/i/v0/e/?_=1");
    expect(upstreamUrl(`${site}/clockwork/flags/?v=2`)).toBe("https://us.i.posthog.com/flags/?v=2");
  });

  it("sends scripts and remote config to PostHog's assets host", () => {
    expect(upstreamUrl(`${site}/clockwork/static/surveys.js?v=1.434.15`)).toBe(
      "https://us-assets.i.posthog.com/static/surveys.js?v=1.434.15",
    );
    expect(upstreamUrl(`${site}/clockwork/array/phc_abc/config.js`)).toBe(
      "https://us-assets.i.posthog.com/array/phc_abc/config.js",
    );
  });

  it("only relays to PostHog, whatever the path", () => {
    for (const path of ["//evil.example/x", "/@evil.example/x", "/..%2F..%2Fx", "/e/../../../x"]) {
      const target = upstreamUrl(`${site}/clockwork${path}`);
      if (target !== null) expect(new URL(target).host).toMatch(/^us(-assets)?\.i\.posthog\.com$/);
    }
  });

  it("relays nothing outside its path", () => {
    expect(upstreamUrl(`${site}/clockwork`)).toBeNull();
    expect(upstreamUrl(`${site}/clockworks/e/`)).toBeNull();
    expect(upstreamUrl(`${site}/app/clockwork/e/`)).toBeNull();
    expect(upstreamUrl(`${site}/clockwork/../app`)).toBeNull();
  });
});

describe("upstreamHeaders", () => {
  const incoming = new Headers({
    cookie: "sb-abc-auth-token=secret; ph_phc_abc_posthog=1",
    authorization: "Bearer secret",
    "content-type": "text/plain",
    "user-agent": "Safari",
    accept: "*/*",
    referer: "https://capexclock.com/app/properties/22-oak-street",
    "x-forwarded-for": "10.0.0.1",
    "x-conversations-token": "widget-token",
  });

  it("passes on only what PostHog reads, never the site's cookies or sign-in", () => {
    const headers = upstreamHeaders(incoming, "203.0.113.7");
    expect(Object.fromEntries(headers)).toEqual({
      accept: "*/*",
      "content-type": "text/plain",
      "user-agent": "Safari",
      "x-conversations-token": "widget-token",
      "x-forwarded-for": "203.0.113.7",
    });
  });

  it("sends no IP rather than a wrong one when Netlify gives none", () => {
    expect(upstreamHeaders(incoming, undefined).has("x-forwarded-for")).toBe(false);
  });
});

describe("relayedResponse", () => {
  it("keeps the status, body and caching, and drops what no longer applies", async () => {
    const upstream = new Response("ok", {
      status: 200,
      headers: {
        "content-type": "application/javascript",
        "cache-control": "public, max-age=3600",
        "content-encoding": "gzip",
        "content-length": "999",
        "set-cookie": "a=1",
        "strict-transport-security": "max-age=31536000; includeSubDomains",
      },
    });
    const response = relayedResponse(upstream);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(response.headers.get("content-type")).toBe("application/javascript");
    for (const name of ["content-encoding", "content-length", "set-cookie", "strict-transport-security"]) {
      expect(response.headers.has(name)).toBe(false);
    }
  });
});

describe("relay", () => {
  const fetchSpy = jest.spyOn(globalThis, "fetch");
  afterEach(() => fetchSpy.mockReset());
  afterAll(() => fetchSpy.mockRestore());

  it("posts the event body to PostHog byte for byte and returns PostHog's answer", async () => {
    fetchSpy.mockResolvedValue(new Response('{"status":1}', { status: 200 }));
    const body = gzipSync(JSON.stringify([{ event: "photo_offer_clicked" }]));
    const response = await relay(
      new Request("https://capexclock.com/clockwork/e/?compression=gzip-js", {
        method: "POST",
        body,
        headers: { "content-type": "text/plain", cookie: "sb-abc-auth-token=secret" },
      }),
      { ip: "203.0.113.7" },
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"status":1}');
    const [target, init] = fetchSpy.mock.calls[0];
    expect(target).toBe("https://us.i.posthog.com/e/?compression=gzip-js");
    expect(init?.method).toBe("POST");
    expect(Buffer.from(init?.body as ArrayBuffer)).toEqual(body);
    const sent = new Headers(init?.headers);
    expect(sent.has("cookie")).toBe(false);
    expect(sent.get("x-forwarded-for")).toBe("203.0.113.7");
  });

  it("sends no body with a GET", async () => {
    fetchSpy.mockResolvedValue(new Response("config", { status: 200 }));
    await relay(new Request("https://capexclock.com/clockwork/array/phc_abc/config.js"), { ip: "203.0.113.7" });
    const [target, init] = fetchSpy.mock.calls[0];
    expect(target).toBe("https://us-assets.i.posthog.com/array/phc_abc/config.js");
    expect(init?.method).toBe("GET");
    expect(init?.body).toBeUndefined();
  });

  it("answers 502 when PostHog can't be reached, so PostHog tries batched events again", async () => {
    fetchSpy.mockRejectedValue(new TypeError("fetch failed"));
    const response = await relay(new Request("https://capexclock.com/clockwork/e/", { method: "POST", body: "x" }), {});
    expect(response.status).toBe(502);
  });

  it("answers 404 outside its path without calling PostHog", async () => {
    const response = await relay(new Request("https://capexclock.com/clockworks/e/"), {});
    expect(response.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
