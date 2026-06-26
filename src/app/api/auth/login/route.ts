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

    if (authErr || !authData.user) {
      return NextResponse.json({ error: authErr?.message || 'Invalid credentials' }, { status: 401 });
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

    if (!profile.email_verified) {
      // Generate random 6-digit OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      // Store in database
      await supabase
        .from('email_otps')
        .delete()
        .eq('email', profile.email);

      const { error: otpErr } = await supabase
        .from('email_otps')
        .insert({
          email: profile.email,
          code,
          expires_at: expiresAt
        });

      if (otpErr) {
        console.error('Failed to store OTP during login verification block:', otpErr);
      } else {
        // Send the email
        const { sendOtpEmail } = await import('@/utils/mailer');
        await sendOtpEmail(profile.email, code);
      }

      return NextResponse.json({
        message: 'Verification OTP sent to your email. Please verify to log in.',
        requiresVerification: true,
        email: profile.email
      });
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
