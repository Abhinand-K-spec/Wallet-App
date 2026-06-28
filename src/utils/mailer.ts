import nodemailer from 'nodemailer';

// Helper to get env variables, handling both standard and process.env. prefixed keys
const getEnv = (key: string): string | undefined => {
  return process.env[key] || process.env[`process.env.${key}`];
};

const getMailerTransporter = (): nodemailer.Transporter | null => {
  const host = getEnv('SMTP_HOST') || 'smtp.gmail.com';
  const port = parseInt(getEnv('SMTP_PORT') || '465', 10);
  const user = getEnv('SMTP_USER');
  const pass = getEnv('SMTP_PASS');

  if (!user || !pass) {
    console.warn('[MAILER] Missing SMTP_USER or SMTP_PASS. Mailer will fallback to mock logging.');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

export async function sendOtpEmail(email: string, otp: string): Promise<boolean> {
  const user = getEnv('SMTP_USER') || 'security@getpayspace.in';
  
  const mailOptions = {
    from: `"GetPay Security" <${user}>`,
    to: email,
    subject: 'Confirm your registration - OTP Code',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; border: 1px solid #f3f4f6; border-radius: 24px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #4f46e5; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.025em;">Verify Your Email</h2>
          <p style="font-size: 14px; color: #4b5563; margin-top: 8px; line-height: 1.5;">
            Confirm your registration code below to verify your email.
          </p>
        </div>
        
        <div style="background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); border-radius: 16px; padding: 20px; margin: 24px 0; text-align: center; border: 1px solid #ddd6fe;">
          <span style="font-size: 36px; font-weight: 800; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: 6px; color: #4f46e5;">${otp}</span>
        </div>
        
        <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 24px 0 0 0; line-height: 1.5;">
          This verification code is valid for 5 minutes.<br />
          If you did not request this verification, please ignore this email safely.
        </p>
      </div>
    `,
  };

  const transporter = getMailerTransporter();

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
