import { resendSender } from "../send";

const EMAIL = {
  to: "owner@example.com",
  subject: "Roof is due",
  html: "<p>hi</p>",
  text: "hi",
  oneClickUrl: "https://capexclock.com/email/unsubscribe/one-click?t=x&k=reminders",
};

it("posts to Resend with the unsubscribe headers and reply-to", async () => {
  const fetchImpl = jest.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  await resendSender("re_key", fetchImpl)({ ...EMAIL, idempotencyKey: "u:reminder:2027" });
  const [url, init] = fetchImpl.mock.calls[0];
  expect(url).toBe("https://api.resend.com/emails");
  expect(init.headers).toMatchObject({ Authorization: "Bearer re_key", "Idempotency-Key": "u:reminder:2027" });
  const body = JSON.parse(init.body);
  expect(body).toMatchObject({
    from: "CapexClock <reminders@capexclock.com>",
    to: ["owner@example.com"],
    reply_to: "support@capexclock.com",
    headers: { "List-Unsubscribe": `<${EMAIL.oneClickUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  });
  expect(body.attachments).toBeUndefined();
});

it("sends attachments and throws on a refusal", async () => {
  const ok = jest.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  await resendSender("k", ok)({ ...EMAIL, attachments: [{ filename: "a.pdf", content: "QQ==" }] });
  expect(JSON.parse(ok.mock.calls[0][1].body).attachments).toEqual([{ filename: "a.pdf", content: "QQ==" }]);

  const refused = jest.fn().mockResolvedValue(new Response("domain not verified", { status: 403 }));
  await expect(resendSender("k", refused)(EMAIL)).rejects.toThrow("Resend refused the email (403): domain not verified");
});
