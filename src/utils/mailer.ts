import nodemailer from 'nodemailer';

const host = process.env.SMTP_HOST;
const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

let transporter: nodemailer.Transporter | null = null;

if (host && user && pass) {
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user,
      pass,
    },
  });
}

export async function sendOtpEmail(email: string, otp: string): Promise<boolean> {
  const mailOptions = {
    from: `"GetPay Security" <${user || 'security@getpayspace.in'}>`,
    to: email,
    subject: 'Confirm your registration - OTP Code',
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded-xl: 16px;">
        <h2 style="color: #4f46e5; text-align: center; margin-bottom: 24px;">Verify Your Email</h2>
        <p style="font-size: 14px; color: #374151; line-height: 1.5;">
          Thank you for signing up for GetPay. Please enter the following 6-digit verification code to complete your registration:
        </p>
        <div style="background-color: #f3f4f6; border-radius: 12px; padding: 16px; margin: 24px 0; text-align: center;">
          <span style="font-size: 32px; font-weight: bold; font-family: monospace; letter-spacing: 4px; color: #111827;">${otp}</span>
        </div>
        <p style="font-size: 12px; color: #6b7280; text-align: center; margin-top: 24px;">
          This code is valid for 5 minutes. If you did not request this code, please ignore this email.
        </p>
      </div>
    `,
  };

  if (transporter) {
    try {
      await transporter.sendMail(mailOptions);
      console.log(`[SMTP] Verification OTP successfully sent to ${email}`);
      return true;
    } catch (err) {
      console.error('[SMTP] Failed to send verification email via SMTP:', err);
    }
  }

  // Fallback / Mock behavior when SMTP settings are not provided or fail
  console.log('\n==================================================');
  console.log(`[MAILER FALLBACK MOCK]`);
  console.log(`To: ${email}`);
  console.log(`Verification Code: ${otp}`);
  console.log('==================================================\n');
  return false;
}
