import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

import { sendOtpEmail } from '@/utils/mailer';
import { saveOtp } from '@/utils/otpCache';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Check if the email is already verified
    const { data: profile } = await supabase
      .from('profiles')
      .select('email_verified')
      .eq('email', email)
      .maybeSingle();

    if (profile && profile.email_verified) {
      return NextResponse.json({ error: 'This email is already verified.' }, { status: 400 });
    }

    // Generate random 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Store OTP in database/memory cache
    await saveOtp(email, code);

    // Send the email
    await sendOtpEmail(email, code);

    return NextResponse.json({ message: 'Verification code resent successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('OTP Resend error in API:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
