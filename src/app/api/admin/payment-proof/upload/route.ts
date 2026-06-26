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

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const adminCheck = await verifyAdmin(supabase);
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const paymentRequestId = formData.get('paymentRequestId') as string;

    if (!file || !paymentRequestId) {
      return NextResponse.json({ error: 'File and paymentRequestId are required' }, { status: 400 });
    }

    // 1. Validation
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type. Only PNG, JPG, and JPEG are allowed.' }, { status: 400 });
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size exceeds maximum limit of 10MB.' }, { status: 400 });
    }

    // 2. Save original file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileExt = path.extname(file.name) || '.jpg';
    const fileName = `proof_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}${fileExt}`;
    const filePath = path.join(uploadsDir, fileName);

    fs.writeFileSync(filePath, buffer);
    const originalFileUrl = `/uploads/${fileName}`;

    // 3. Create database entry
    const { data: proof, error: dbErr } = await supabase
      .from('payment_proofs')
      .insert({
        payment_request_id: paymentRequestId,
        original_file_url: originalFileUrl,
        approved_status: 'PENDING'
      })
      .select()
      .single();

    if (dbErr || !proof) {
      console.error('Failed to create payment proof DB record:', dbErr);
      return NextResponse.json({ error: 'Failed to save payment proof to database' }, { status: 500 });
    }

    // 4. Create Audit Log
    const { error: auditErr } = await supabase
      .from('payment_proof_audits')
      .insert({
        payment_proof_id: proof.id,
        admin_id: adminCheck.user.id,
        action: 'UPLOADED_PROOF',
        details: { fileName: file.name, fileSize: file.size, fileType: file.type }
      });

    if (auditErr) {
      console.error('Failed to log audit:', auditErr);
    }

    return NextResponse.json({
      message: 'File uploaded successfully',
      proof: {
        id: proof.id,
        paymentRequestId: proof.payment_request_id,
        originalFileUrl: proof.original_file_url,
        createdAt: proof.created_at
      }
    });
  } catch (error: any) {
    console.error('Payment proof upload error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
