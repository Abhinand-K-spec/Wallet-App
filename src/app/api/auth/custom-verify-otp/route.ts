import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { code } = body;

    if (!code || code.length !== 6) {
      return NextResponse.json({ error: 'Valid 6-digit verification code is required' }, { status: 400 });
    }

    // Retrieve latest code for user's email
    const { data: otpRecord, error: otpError } = await supabase
      .from('email_otps')
      .select('*')
      .eq('email', user.email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError || !otpRecord) {
      return NextResponse.json({ error: 'No verification request found. Please request a new code.' }, { status: 400 });
    }

    // Check expiration
    if (new Date(otpRecord.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Verification code has expired. Please request a new code.' }, { status: 400 });
    }

    // Check code match
    if (otpRecord.code !== code) {
      return NextResponse.json({ error: 'Invalid verification code.' }, { status: 400 });
    }

    // Update user profile status to verified
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ email_verified: true })
      .eq('id', user.id);

    if (profileError) {
      console.error('Failed to update email_verified in profiles:', profileError);
      return NextResponse.json({ error: 'Failed to verify email profile' }, { status: 500 });
    }

    // Clean up codes for this email
    await supabase
      .from('email_otps')
      .delete()
      .eq('email', user.email);

    return NextResponse.json({
      message: 'Email verified successfully!',
      verified: true,
    }, { status: 200 });
  } catch (error: any) {
    console.error('Custom OTP Verification error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
