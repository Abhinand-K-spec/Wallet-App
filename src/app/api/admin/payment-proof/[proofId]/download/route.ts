import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import fs from 'fs';
import path from 'path';

async function verifyAdmin(supabase: any) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized', status: 401 };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'ADMIN') {
    return { error: 'Forbidden', status: 403 };
  }
  return { user, profile };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ proofId: string }> }
) {
  try {
    const { proofId } = await context.params;
    const supabase = await createClient();
    
    // Check if the user is authenticated (both users and admins can view/download)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: proof, error: fetchErr } = await supabase
      .from('payment_proofs')
      .select('*')
      .eq('id', proofId)
      .maybeSingle();

    if (fetchErr || !proof) {
      return NextResponse.json({ error: 'Payment proof not found' }, { status: 404 });
    }

    const filePath = path.join(process.cwd(), 'public', proof.original_file_url);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(proof.original_file_url);

    let contentType = 'image/jpeg';
    if (fileName.endsWith('.png')) {
      contentType = 'image/png';
    }

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error('Payment proof download error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
