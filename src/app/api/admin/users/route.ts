import { NextResponse, type NextRequest } from 'next/server';
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const role = searchParams.get('role');
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '10';

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const supabase = await createClient();
    const adminCheck = await verifyAdmin(supabase);
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    // Build Supabase dynamic query
    let query = supabase.from('profiles').select('*', { count: 'exact' });

    if (role && ['USER', 'ADMIN'].includes(role)) {
      query = query.eq('role', role);
    }
    if (status && ['ACTIVE', 'SUSPENDED'].includes(status)) {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.or(`email.ilike.%${search}%,user_id.ilike.%${search}%`);
    }

    // Apply ordering & pagination
    const { data: users, count, error } = await query
      .order('created_at', { ascending: false })
      .range(skip, skip + limitNum - 1);

    if (error) {
      console.error('Fetch users query error:', error);
      return NextResponse.json({ error: 'Failed to retrieve users' }, { status: 500 });
    }

    const totalCount = count || 0;

    // Convert keys to camelCase to match expectations
    const mappedUsers = (users || []).map((u: any) => ({
      id: u.id,
      userId: u.user_id,
      email: u.email,
      role: u.role,
      status: u.status,
      createdAt: u.created_at,
      updatedAt: u.updated_at,
    }));

    return NextResponse.json({
      users: mappedUsers,
      totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum)
    });
  } catch (error: any) {
    console.error('Admin users get error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
