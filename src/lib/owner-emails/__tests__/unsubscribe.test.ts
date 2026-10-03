import { unsubscribe } from "../unsubscribe";

const TOKEN = "3f1c2b8e-9d4a-4c6b-8e2f-0a1b2c3d4e5f";

describe("unsubscribe", () => {
  it("sends the token and kind to email_unsubscribe", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: true, error: null });
    await expect(unsubscribe(TOKEN, "reminders", rpc)).resolves.toBe("done");
    expect(rpc).toHaveBeenCalledWith({ p_token: TOKEN, p_kind: "reminders" });
  });

  it("says when the token matches no account", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: false, error: null });
    await expect(unsubscribe(TOKEN, "all", rpc)).resolves.toBe("not_found");
  });

  it("reports errors and throws as errors", async () => {
    await expect(unsubscribe(TOKEN, "all", jest.fn().mockResolvedValue({ data: null, error: {} }))).resolves.toBe(
      "error",
    );
    await expect(unsubscribe(TOKEN, "all", jest.fn().mockRejectedValue(new Error("down")))).resolves.toBe("error");
    await expect(unsubscribe(TOKEN, "all", null)).resolves.toBe("error");
  });
});
