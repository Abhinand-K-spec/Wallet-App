import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, token, password } = body;

    if (!email || !token) {
      return NextResponse.json({ error: 'Email and verification code are required' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Verify custom OTP using the resilient cache
    const { verifyAndDeleteOtp } = await import('@/utils/otpCache');
    const verifyResult = await verifyAndDeleteOtp(email, token);

    if (!verifyResult.valid) {
      return NextResponse.json({ error: verifyResult.error || 'Verification failed. Invalid code.' }, { status: 400 });
    }

    // 2. Perform Supabase SignUp now that the email is verified!
    // Since "Confirm email" is toggled OFF in Supabase, this will succeed and log the user in immediately.
    if (!password) {
      return NextResponse.json({ error: 'Password is required to complete signup.' }, { status: 400 });
    }

    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email,
      password
    });

    if (authErr || !authData.user) {
      console.error('Supabase Auth SignUp failed in verify-otp:', authErr);
      return NextResponse.json({ error: authErr?.message || 'Failed to create account.' }, { status: 400 });
    }

    // Retrieve or create profile
    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (!profile) {
      // Profile does not exist - create it manually
      const { data: latestUsers } = await supabase
        .from('profiles')
        .select('user_id')
        .order('created_at', { ascending: false })
        .limit(1);

      let nextNum = 1000;
      if (latestUsers && latestUsers.length > 0) {
        const latestId = latestUsers[0].user_id;
        const match = latestId.match(/USR-(\d+)/);
        if (match) {
          nextNum = parseInt(match[1], 10) + 1;
        }
      }
      const newUserId = `USR-${nextNum}`;

      const { data: newProfile } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          user_id: newUserId,
          email: email,
          role: 'USER',
          status: 'ACTIVE',
          email_verified: true
        })
        .select()
        .maybeSingle();

      profile = newProfile || {
        id: authData.user.id,
        user_id: newUserId,
        email: email,
        role: 'USER',
        status: 'ACTIVE',
        email_verified: true
      };
    } else {
      // Update email_verified = true
      const { data: updatedProfile } = await supabase
        .from('profiles')
        .update({ email_verified: true })
        .eq('id', authData.user.id)
        .select()
        .maybeSingle();

      if (updatedProfile) {
        profile = updatedProfile;
      } else {
        profile.email_verified = true;
      }
    }

    return NextResponse.json({
      message: 'Email verified and account registered successfully',
      token: authData.session?.access_token || 'session_active',
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
