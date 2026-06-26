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

    // Check if the email is already verified in profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('email_verified')
      .eq('email', email)
      .maybeSingle();

    if (profile && profile.email_verified) {
      return NextResponse.json({ error: 'This email is already verified.' }, { status: 400 });
    }

    // Call Supabase Auth resend natively
    const { error: resendErr } = await supabase.auth.resend({
      type: 'signup',
      email
    });

    if (resendErr) {
      console.error('Supabase Auth resend error:', resendErr);
      return NextResponse.json({ error: resendErr.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Verification code resent successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('OTP Resend error in API:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
