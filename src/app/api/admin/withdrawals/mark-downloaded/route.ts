import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

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
    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'List of withdrawal IDs is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const adminCheck = await verifyAdmin(supabase);
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    // Update downloaded status in database
    const { error: updateErr } = await supabase
      .from('withdrawals')
      .update({
        downloaded: true,
        updated_at: new Date().toISOString()
      })
      .in('id', ids);

    if (updateErr) {
      console.error('Failed to mark withdrawals as downloaded:', updateErr);
      return NextResponse.json({ error: 'Failed to update withdrawals status' }, { status: 500 });
    }

    // Log admin action
    await supabase
      .from('admin_actions')
      .insert({
        admin_id: adminCheck.user.id,
        action: 'DOWNLOAD_WITHDRAWALS_CSV',
        target_id: ids.join(',').substring(0, 255) // Ensure it fits if long list
      });

    return NextResponse.json({
      message: `Successfully marked ${ids.length} withdrawals as downloaded`
    });
  } catch (error: any) {
    console.error('Mark downloaded error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
