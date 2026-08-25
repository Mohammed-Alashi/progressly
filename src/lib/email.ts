import nodemailer from "nodemailer";

const appUrl = "https://progressly-seven.vercel.app";

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      "GMAIL_USER and GMAIL_APP_PASSWORD must be configured to send email."
    );
  }

  return {
    user,
    transporter: nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    }),
  };
}

function emailLayout(title: string, message: string) {
  return `
    <main style="max-width:560px;margin:0 auto;padding:32px;font-family:Arial,sans-serif;color:#24213d;line-height:1.6">
      <p style="margin:0;color:#635bdf;font-size:12px;font-weight:700;letter-spacing:.08em">PROGRESSLY</p>
      <h1 style="margin:12px 0;font-size:28px">${title}</h1>
      <p>${message}</p>
      <a href="${appUrl}" style="display:inline-block;margin-top:12px;padding:12px 18px;border-radius:10px;background:#635bdf;color:#fff;font-weight:700;text-decoration:none">Open Progressly</a>
    </main>
  `;
}

export async function sendWeeklyDraftReadyEmail(to: string) {
  const { user, transporter } = getTransporter();

  await transporter.sendMail({
    from: `Progressly <${user}>`,
    to,
    subject: "Your Progressly weekly draft is ready",
    text: "Your weekly LinkedIn draft is ready for review. You can edit, approve, or discard it in Progressly: https://progressly-seven.vercel.app",
    html: emailLayout(
      "Your weekly draft is ready",
      "Your weekly LinkedIn draft is ready for review. Open Progressly to edit it, approve it, or discard it."
    ),
  });
}

export async function sendTestEmail(to: string) {
  const { user, transporter } = getTransporter();

  await transporter.sendMail({
    from: `Progressly <${user}>`,
    to,
    subject: "Your Progressly test email",
    text: "This is a test email from Progressly. Your weekly draft reminders will arrive here.",
    html: emailLayout(
      "Your email reminders are connected",
      "This is a test email from Progressly. Your weekly LinkedIn draft reminders will arrive here."
    ),
  });
}
