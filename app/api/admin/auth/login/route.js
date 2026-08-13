import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return Response.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Look up admin by email
    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !admin) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Simple password check (stored as bcrypt-style hash, but for MVP we'll use a simple comparison)
    // In production, use bcrypt.compare()
    if (admin.password_hash !== password) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Create a simple JWT-like token (base64 encoded JSON with expiry)
    const tokenPayload = {
      admin_id: admin.id,
      email: admin.email,
      name: admin.name,
      exp: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
    };
    
    const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');

    return Response.json({ 
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
