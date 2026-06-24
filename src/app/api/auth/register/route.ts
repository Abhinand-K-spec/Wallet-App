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

    // Sign up via Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authErr || !authData.user) {
      return NextResponse.json({ error: authErr?.message || 'Failed to create user' }, { status: 400 });
    }

    // Wait a brief moment or query profiles to ensure the trigger completed
    let profile = null;
    let retries = 5;
    while (retries > 0) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();
      
      if (data) {
        profile = data;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 200));
      retries--;
    }

    if (!profile) {
      return NextResponse.json({ error: 'Failed to initialize user profile' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'User created successfully',
      token: 'session_active',
      user: {
        id: profile.id,
        userId: profile.user_id,
        email: profile.email,
        role: profile.role,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Registration error in API:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
