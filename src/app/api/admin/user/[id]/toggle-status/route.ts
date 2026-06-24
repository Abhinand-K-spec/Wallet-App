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

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const supabase = await createClient();
    const adminCheck = await verifyAdmin(supabase);
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    if (id === adminCheck.user.id) {
      return NextResponse.json({ error: 'You cannot suspend your own admin account.' }, { status: 400 });
    }

    // Fetch the target user
    const { data: targetUser, error: fetchErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !targetUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const newStatus = targetUser.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';

    // Update user status
    const { data: updatedUser, error: updateErr } = await supabase
      .from('profiles')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr || !updatedUser) {
      console.error('Update user status error:', updateErr);
      return NextResponse.json({ error: 'Failed to update user status.' }, { status: 500 });
    }

    // Log the admin action
    await supabase
      .from('admin_actions')
      .insert({
        admin_id: adminCheck.user.id,
        action: newStatus === 'SUSPENDED' ? 'SUSPENDED_USER' : 'ACTIVATED_USER',
        target_id: targetUser.id
      });

    return NextResponse.json({
      message: `User status successfully updated to ${newStatus.toLowerCase()}`,
      user: {
        id: updatedUser.id,
        userId: updatedUser.user_id,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.status
      }
    });
  } catch (error: any) {
    console.error('Toggle user status API error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
