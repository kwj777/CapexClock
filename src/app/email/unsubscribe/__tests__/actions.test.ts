import { unsubscribeAction } from "../actions";

jest.mock("@/lib/owner-emails/unsubscribe", () => ({ unsubscribe: jest.fn(async () => "done") }));

const TOKEN = "0b8f2c1e-4d3a-4e5f-9a6b-7c8d9e0f1a2b";

function form(k: string): FormData {
  const data = new FormData();
  data.set("t", TOKEN);
  data.set("k", k);
  return data;
}

describe("unsubscribeAction", () => {
  it("says which button was pressed, so the page confirms what was turned off", async () => {
    // The page for one email also offers "Turn off all three": its message must say all three.
    await expect(unsubscribeAction("idle", form("all"))).resolves.toEqual({ result: "done", kind: "all" });
    await expect(unsubscribeAction("idle", form("reminders"))).resolves.toEqual({ result: "done", kind: "reminders" });
  });

  it("reports a garbled link as not found", async () => {
    await expect(unsubscribeAction("idle", form("everything"))).resolves.toEqual({ result: "not_found", kind: null });
  });
});
