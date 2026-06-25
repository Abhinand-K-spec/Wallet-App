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
    let { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (!profile) {
      // Profile does not exist - create it manually
      // Get the next user ID by ordering by created_at descending
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

      const { data: newProfile, error: insertErr } = await supabase
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
        .single();

      if (insertErr || !newProfile) {
        console.error('Failed to manually insert profile:', insertErr);
        return NextResponse.json({ error: 'User profile not found or failed to initialize' }, { status: 404 });
      }
      profile = newProfile;
    } else {
      // Profile exists - update email_verified to true
      const { data: updatedProfile, error: updateErr } = await supabase
        .from('profiles')
        .update({ email_verified: true })
        .eq('id', authData.user.id)
        .select()
        .single();

      if (updateErr || !updatedProfile) {
        console.error('Failed to update existing profile email_verified:', updateErr);
        return NextResponse.json({ error: 'Failed to update user profile' }, { status: 500 });
      }
      profile = updatedProfile;
    }

    return NextResponse.json({
      message: 'Email verified successfully',
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
