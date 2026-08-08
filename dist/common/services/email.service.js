import dnsPromises from "node:dns/promises";
import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
const isGmail = env.SMTP_HOST.includes("gmail");
const smtpPort = isGmail ? 465 : env.SMTP_PORT;
const smtpSecure = isGmail ? true : env.SMTP_SECURE;
const getTransporter = async () => {
    const hostName = env.SMTP_HOST.trim();
    let resolvedHost = hostName;
    try {
        const ipv4Addresses = await dnsPromises.resolve4(hostName);
        const firstIp = ipv4Addresses[0];
        if (firstIp) {
            resolvedHost = firstIp;
        }
    }
    catch (err) {
        console.warn("Dns resolve4 warning:", err);
    }
    return nodemailer.createTransport({
        host: resolvedHost,
        port: smtpPort,
        secure: smtpSecure,
        tls: {
            servername: hostName,
            rejectUnauthorized: false,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
        auth: {
            user: env.SMTP_USER.trim(),
            pass: env.SMTP_PASSWORD.replace(/\s+/g, ""),
        },
    });
};
export const sendPasswordResetCode = async (recipientEmail, recipientName, resetCode) => {
    const transporter = await getTransporter();
    await transporter.sendMail({
        from: env.SMTP_FROM,
        to: recipientEmail,
        subject: "Mã xác nhận đặt lại mật khẩu UGem",
        text: [
            `Xin chào ${recipientName},`,
            "",
            `Mã để bạn đặt lại mật khẩu là: ${resetCode}`,
            "",
            "Mã này có hiệu lực trong 10 phút.",
            "Không cung cấp mã này cho bất kỳ ai.",
            "",
            "Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.",
        ].join("\n"),
        html: `
      <div
        style="
          max-width: 560px;
          margin: 0 auto;
          padding: 28px;
          font-family: Arial, sans-serif;
          color: #0f172a;
        "
      >
        <h2 style="margin-bottom: 16px;">
          Đặt lại mật khẩu UGem
        </h2>

        <p>Xin chào <strong>${recipientName}</strong>,</p>

        <p>Mã để bạn đặt lại mật khẩu là:</p>

        <div
          style="
            margin: 24px 0;
            padding: 18px;
            border-radius: 12px;
            background: #ecfeff;
            text-align: center;
            font-size: 30px;
            font-weight: 700;
            letter-spacing: 8px;
            color: #0891b2;
          "
        >
          ${resetCode}
        </div>

        <p>Mã này có hiệu lực trong <strong>10 phút</strong>.</p>

        <p>
          Không cung cấp mã này cho bất kỳ ai.
          Nếu bạn không yêu cầu đặt lại mật khẩu,
          hãy bỏ qua email này.
        </p>
      </div>
    `,
    });
};
