import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Check if the user is already registered in profiles
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: 'User already registered' }, { status: 400 });
    }

    // Generate random 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Store OTP in database/memory cache
    const { saveOtp } = await import('@/utils/otpCache');
    await saveOtp(email, code);

    // Send via nodemailer mailer
    const { sendOtpEmail } = await import('@/utils/mailer');
    await sendOtpEmail(email, code);

    return NextResponse.json({
      message: 'Verification OTP sent to your email. Please verify to complete signup.',
      requiresVerification: true,
      email,
    }, { status: 200 });
  } catch (error: any) {
    console.error('Registration error in API:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
