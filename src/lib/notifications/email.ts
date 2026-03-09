import { env } from "@/lib/config";

type OrderEmailArgs = {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
};

export async function sendOrderEmail(args: OrderEmailArgs) {
  if (!env.POSTMARK_SERVER_TOKEN || !env.POSTMARK_FROM_EMAIL) {
    return {
      mode: "disabled" as const,
      delivered: false,
      note: "Postmark email delivery is not configured."
    };
  }

  const response = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": env.POSTMARK_SERVER_TOKEN
    },
    body: JSON.stringify({
      From: env.POSTMARK_FROM_EMAIL,
      To: args.to,
      Subject: args.subject,
      HtmlBody: args.htmlBody,
      TextBody: args.textBody,
      MessageStream: "outbound"
    })
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Postmark email failed with status ${response.status}: ${payload}`);
  }

  return {
    mode: "live" as const,
    delivered: true
  };
}