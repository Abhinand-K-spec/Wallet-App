import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
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

    // Call Supabase Auth signUp to register the user and trigger native verification email/OTP
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password
    });

    if (signUpErr) {
      console.error('Supabase Auth signUp error during registration:', signUpErr);
      return NextResponse.json({ error: signUpErr.message }, { status: 400 });
    }

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
