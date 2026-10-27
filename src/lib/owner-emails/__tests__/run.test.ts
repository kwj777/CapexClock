import type { SavedProperty, SavedReportComponent } from "@/verticals/landlord";
import { readMode, runOwnerEmails, type EmailStore, type LogEntry, type Member, type OwnerData } from "../run";
import type { OutgoingEmail } from "../send";

const TOKEN = "3f1c2b8e-9d4a-4c6b-8e2f-0a1b2c3d4e5f";
const ALL_ON = { reminders: true, budget_summary: true, condition_report: true };

const PROPERTY: SavedProperty = { id: "p1", name: "Elm St <A>", unit_count: 4, year_built: 2000 };
const ROOF: SavedReportComponent = {
  id: "c-roof",
  property_id: "p1",
  category: "Roof",
  name: "Roof",
  quantity: 1,
  install_year: 2007,
  useful_life_years: 20,
  replacement_cost_each: 12000,
  scenario: "run_to_failure",
  unit_label: "per_building",
  condition: "fair",
  notes: null,
};
const HEATER: SavedReportComponent = { ...ROOF, id: "c-wh", category: "Plumbing", name: "Water heater", install_year: 2015, useful_life_years: 12, replacement_cost_each: 1500 };

function member(userId: string, o: Partial<Member> = {}): Member {
  return { userId, email: `${userId}@example.com`, switches: { ...ALL_ON }, unsubscribeToken: TOKEN, ...o };
}

class FakeStore implements EmailStore {
  log = new Map<string, LogEntry[]>();
  constructor(
    public list: Member[],
    public data: Record<string, OwnerData>,
  ) {}
  async members() {
    return this.list;
  }
  async ownerData(userId: string) {
    return this.data[userId] ?? { properties: [], components: [] };
  }
  async sentLog(userId: string) {
    return this.log.get(userId) ?? [];
  }
  async record(userId: string, entries: readonly Omit<LogEntry, "sent_at">[]) {
    const list = this.log.get(userId) ?? [];
    list.push(...entries.map((e) => ({ ...e, sent_at: NOW.toISOString() })));
    this.log.set(userId, list);
  }
}

let NOW = new Date("2027-03-10T15:00:00Z");
const OWNED: OwnerData = { properties: [PROPERTY], components: [ROOF, HEATER] };

function run(store: EmailStore, mode: "live" | "preview" | "off", sent: OutgoingEmail[], extra = {}) {
  return runOwnerEmails({
    mode,
    now: NOW,
    store,
    send: async (e) => {
      sent.push(e);
    },
    site: "https://capexclock.com",
    previewTo: "support@capexclock.com",
    ...extra,
  });
}

beforeEach(() => {
  NOW = new Date("2027-03-10T15:00:00Z");
});

it("reads the mode, off unless live or preview", () => {
  expect(readMode(undefined)).toBe("off");
  expect(readMode(" LIVE ")).toBe("live");
  expect(readMode("preview")).toBe("preview");
  expect(readMode("yes")).toBe("off");
});

it("sends nothing when off", async () => {
  const sent: OutgoingEmail[] = [];
  const store = new FakeStore([member("u1")], { u1: OWNED });
  const spy = jest.spyOn(store, "members");
  await run(store, "off", sent);
  expect(sent).toEqual([]);
  expect(spy).not.toHaveBeenCalled();
});

describe("live", () => {
  it("reminds once about what's due this year, then not again", async () => {
    const store = new FakeStore([member("u1")], { u1: OWNED });
    const sent: OutgoingEmail[] = [];
    const result = await run(store, "live", sent);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("u1@example.com");
    expect(sent[0].subject).toBe("Elm St <A>: 2 replacements due in 2027");
    expect(sent[0].html).toContain("Elm St &lt;A&gt;");
    expect(sent[0].text).toContain("- Roof: $12,000. Reaches its end of life this year.");
    expect(sent[0].oneClickUrl).toBe(`https://capexclock.com/email/unsubscribe/one-click?t=${TOKEN}&k=reminders`);
    expect(sent[0].text).toContain(`https://capexclock.com/email/unsubscribe?t=${TOKEN}&k=reminders`);
    expect(result.sent).toEqual([{ kind: "reminders", userId: "u1" }]);
    expect(store.log.get("u1")).toEqual([
      expect.objectContaining({ kind: "reminder", year: 2027, component_id: "c-roof" }),
      expect.objectContaining({ kind: "reminder", year: 2027, component_id: "c-wh" }),
    ]);

    NOW = new Date("2027-03-20T15:00:00Z");
    await run(store, "live", sent);
    expect(sent).toHaveLength(1);
  });

  it("waits a week before reminding about something new", async () => {
    const store = new FakeStore([member("u1")], { u1: { properties: [PROPERTY], components: [ROOF] } });
    const sent: OutgoingEmail[] = [];
    await run(store, "live", sent);
    store.data.u1 = OWNED;
    NOW = new Date("2027-03-12T15:00:00Z");
    await run(store, "live", sent);
    expect(sent).toHaveLength(1);
    NOW = new Date("2027-03-17T15:00:00Z");
    await run(store, "live", sent);
    expect(sent).toHaveLength(2);
    expect(sent[1].subject).toBe("Elm St <A>: Water heater is due for replacement in 2027");
  });

  it("sends the budget summary in November, once", async () => {
    NOW = new Date("2027-11-02T15:00:00Z");
    const store = new FakeStore([member("u1", { switches: { ...ALL_ON, reminders: false } })], { u1: OWNED });
    const sent: OutgoingEmail[] = [];
    await run(store, "live", sent);
    expect(sent.map((e) => e.subject)).toEqual(["Your 2028 replacement budget: $13,500"]);
    expect(sent[0].text).toContain("Monthly reserve");
    NOW = new Date("2027-11-03T15:00:00Z");
    await run(store, "live", sent);
    expect(sent).toHaveLength(1);
  });

  it("respects each switch and skips owners with no properties", async () => {
    NOW = new Date("2027-11-02T15:00:00Z");
    const store = new FakeStore(
      [member("off", { switches: { reminders: false, budget_summary: false, condition_report: false } }), member("empty")],
      { off: OWNED },
    );
    const sent: OutgoingEmail[] = [];
    await run(store, "live", sent);
    expect(sent).toEqual([]);
  });

  it("keeps going past an owner whose send fails", async () => {
    const store = new FakeStore([member("bad"), member("good")], { bad: OWNED, good: OWNED });
    const sent: OutgoingEmail[] = [];
    const result = await runOwnerEmails({
      mode: "live",
      now: NOW,
      store,
      site: "https://capexclock.com",
      previewTo: "x@example.com",
      send: async (e) => {
        if (e.to.startsWith("bad")) throw new Error("refused");
        sent.push(e);
      },
    });
    expect(result.failed).toEqual([{ userId: "bad", error: "refused" }]);
    expect(store.log.get("bad")).toBeUndefined();
    expect(sent.map((e) => e.to)).toEqual(["good@example.com"]);
  });

  it("stops starting new owners when the time runs out", async () => {
    const store = new FakeStore([member("a"), member("b"), member("c")], { a: OWNED, b: OWNED, c: OWNED });
    let t = 0;
    const result = await run(store, "live", [], { budgetMs: 15, clock: () => (t += 10) });
    expect(result.sent).toHaveLength(1);
    expect(result.leftForNextRun).toBe(2);
  });

  it("sends the condition report in January when a builder is given", async () => {
    NOW = new Date("2027-01-08T15:00:00Z");
    const store = new FakeStore([member("u1", { switches: { ...ALL_ON, reminders: false } })], { u1: OWNED });
    const sent: OutgoingEmail[] = [];
    const builder = jest.fn().mockResolvedValue({ subject: "Report", html: "<p>r</p>", text: "r", attachments: [{ filename: "a.pdf", content: "QQ==" }] });
    await run(store, "live", sent, { conditionReport: builder });
    expect(sent.map((e) => [e.subject, e.attachments?.length])).toEqual([["Report", 1]]);
    expect(builder.mock.calls[0][1]).toBe(2027);
    await run(store, "live", sent, { conditionReport: builder });
    expect(sent).toHaveLength(1);
  });
});

describe("preview", () => {
  it("sends every email to the preview address, whatever the date, and logs nothing", async () => {
    const store = new FakeStore([member("u1")], { u1: OWNED });
    const sent: OutgoingEmail[] = [];
    const builder = jest.fn().mockResolvedValue({ subject: "Report", html: "", text: "", attachments: [] });
    await run(store, "preview", sent, { conditionReport: builder });
    expect(sent.map((e) => [e.to, e.subject])).toEqual([
      ["support@capexclock.com", "[Preview for u1@example.com] Elm St <A>: 2 replacements due in 2027"],
      ["support@capexclock.com", expect.stringMatching(/^\[Preview for u1@example.com\] Your 2028 replacement budget/)],
      ["support@capexclock.com", "[Preview for u1@example.com] Report"],
    ]);
    expect(sent.every((e) => e.idempotencyKey === undefined)).toBe(true);
    expect(store.log.size).toBe(0);
  });
});
