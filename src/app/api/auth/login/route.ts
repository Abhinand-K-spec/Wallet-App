import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Identifier and password are required' }, { status: 400 });
    }

    const supabase = await createClient();
    let email = identifier;

    // If identifier is a custom USR-xxxx ID instead of an email, look it up in profiles first
    if (!identifier.includes('@')) {
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', identifier)
        .maybeSingle();

      if (profile && profile.email) {
        email = profile.email;
      } else {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
    }

    // Sign in with Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authErr) {
      if (authErr.message.includes('Email not confirmed')) {
        // Resend Supabase OTP natively
        const { error: resendErr } = await supabase.auth.resend({
          type: 'signup',
          email
        });
        if (resendErr) {
          console.error('Failed to resend confirmation email on unconfirmed login:', resendErr);
        }
        return NextResponse.json({
          message: 'Verification OTP sent to your email. Please verify to log in.',
          requiresVerification: true,
          email
        });
      }
      return NextResponse.json({ error: authErr.message || 'Invalid credentials' }, { status: 401 });
    }

    // Fetch custom profile data (user_id, role, status)
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    if (profile.status !== 'ACTIVE') {
      // Sign out since account is suspended
      await supabase.auth.signOut();
      return NextResponse.json({ error: 'Account suspended' }, { status: 403 });
    }

    // Dynamically sync email_verified in database profiles if it is false but user is confirmed in Auth
    if (!profile.email_verified && authData.user?.email_confirmed_at) {
      await supabase
        .from('profiles')
        .update({ email_verified: true })
        .eq('id', authData.user.id);
      profile.email_verified = true;
    }

    return NextResponse.json({
      message: 'Login successful',
      token: authData.session?.access_token || 'session_active',
      user: {
        id: profile.id,
        userId: profile.user_id,
        email: profile.email,
        role: profile.role,
      },
    });
  } catch (error: any) {
    console.error('Login error in API:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
