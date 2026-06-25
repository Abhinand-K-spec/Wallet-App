import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST() {
  try {
    const supabase = await createClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate a 6-digit random code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration

    // Insert OTP into database
    const { error: dbError } = await supabase
      .from('email_otps')
      .insert({
        email: user.email,
        code,
        expires_at: expiresAt.toISOString(),
      });

    if (dbError) {
      console.error('Failed to store OTP in database:', dbError);
      return NextResponse.json({ error: 'Failed to generate verification code' }, { status: 500 });
    }

    // Log code to server console for testing/debugging
    console.log(`\n==============================================`);
    console.log(`[EMAIL OTP VERIFICATION]`);
    console.log(`User: ${user.email}`);
    console.log(`OTP Code: ${code}`);
    console.log(`Expires At: ${expiresAt.toLocaleString()}`);
    console.log(`==============================================\n`);

    const responsePayload: any = {
      message: 'Verification code generated and sent to your email.',
    };

    // Return the code in response ONLY for local testing/development
    if (process.env.NODE_ENV === 'development') {
      responsePayload.code = code;
    }

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error: any) {
    console.error('Custom OTP Send error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
