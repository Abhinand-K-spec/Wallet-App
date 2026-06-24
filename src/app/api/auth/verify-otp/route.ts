import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, token } = body;

    if (!email || !token) {
      return NextResponse.json({ error: 'Email and verification code are required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify OTP via Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    });

    if (authErr || !authData.user) {
      return NextResponse.json({ error: authErr?.message || 'Verification failed. Invalid or expired code.' }, { status: 400 });
    }

    // Retrieve profile
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Email verified successfully',
      token: 'session_active',
      user: {
        id: profile.id,
        userId: profile.user_id,
        email: profile.email,
        role: profile.role,
      },
    }, { status: 200 });
  } catch (error: any) {
    console.error('OTP Verification error in API:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
