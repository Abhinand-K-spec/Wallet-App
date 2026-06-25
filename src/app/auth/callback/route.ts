import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/reset-password';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Redirect to the target page (e.g. /reset-password)
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // If there's an error, redirect to login page with an error parameter
  return NextResponse.redirect(new URL('/login?error=Invalid or expired reset link', request.url));
}
