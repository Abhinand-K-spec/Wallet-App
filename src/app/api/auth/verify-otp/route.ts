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

      if (newProfile) {
        profile = newProfile;
      } else {
        // Fallback: query again in case trigger fired in the background
        const { data: retryProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();
        
        if (retryProfile) {
          profile = retryProfile;
        } else {
          // If profile still doesn't exist and insert failed (due to RLS), use in-memory fallback
          profile = {
            id: authData.user.id,
            user_id: newUserId,
            email: email,
            role: 'USER',
            status: 'ACTIVE',
            email_verified: true
          };
        }
      }
    } else {
      // Profile exists - try to update email_verified to true
      const { data: updatedProfile } = await supabase
        .from('profiles')
        .update({ email_verified: true })
        .eq('id', authData.user.id)
        .select()
        .maybeSingle();

      if (updatedProfile) {
        profile = updatedProfile;
      }
      // If update fails due to RLS policies, we continue using the existing profile fetched above
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
