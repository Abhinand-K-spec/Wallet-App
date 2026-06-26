import { createClient } from '@/utils/supabase/server';

// In-memory fallback cache
const memoryCache = new Map<string, { code: string; expiresAt: number }>();

export async function saveOtp(email: string, code: string): Promise<boolean> {
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
  const expiresAtStr = new Date(expiresAt).toISOString();

  // Try database first
  try {
    const supabase = await createClient();
    
    // Delete any old OTPs
    await supabase
      .from('email_otps')
      .delete()
      .eq('email', email);

    const { error } = await supabase
      .from('email_otps')
      .insert({
        email,
        code,
        expires_at: expiresAtStr
      });

    if (!error) {
      console.log(`[OTP] Saved OTP code to database for ${email}`);
      return true;
    }

    if (error.message && error.message.includes("Could not find the table 'public.email_otps'")) {
      console.warn(`[OTP Cache Warning] email_otps table not found. Falling back to in-memory storage.`);
    } else {
      console.error('[OTP Database Error]', error);
    }
  } catch (err) {
    console.error('[OTP Cache DB Catch]', err);
  }

  // Memory Fallback
  memoryCache.set(email.toLowerCase().trim(), { code, expiresAt });
  console.log(`[OTP] Saved OTP code to memory for ${email}`);
  return true;
}

export async function verifyAndDeleteOtp(email: string, token: string): Promise<{ valid: boolean; error?: string }> {
  const emailKey = email.toLowerCase().trim();

  // Try database first
  try {
    const supabase = await createClient();
    const { data: otpRecord, error } = await supabase
      .from('email_otps')
      .select('*')
      .eq('email', email)
      .eq('code', token)
      .maybeSingle();

    if (!error && otpRecord) {
      // Check expiry
      if (new Date() > new Date(otpRecord.expires_at)) {
        return { valid: false, error: 'Verification failed. Expired code.' };
      }
      
      // Delete used OTP
      await supabase
        .from('email_otps')
        .delete()
        .eq('id', otpRecord.id);

      return { valid: true };
    }
  } catch (err) {
    console.error('[OTP Verify DB Catch]', err);
  }

  // Memory Fallback
  const cached = memoryCache.get(emailKey);
  if (!cached) {
    return { valid: false, error: 'Verification failed. Invalid code.' };
  }

  if (Date.now() > cached.expiresAt) {
    memoryCache.delete(emailKey);
    return { valid: false, error: 'Verification failed. Expired code.' };
  }

  if (cached.code !== token) {
    return { valid: false, error: 'Verification failed. Invalid code.' };
  }

  // Code is valid - remove from cache
  memoryCache.delete(emailKey);
  return { valid: true };
}
