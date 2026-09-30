import { supabaseAdmin } from '@/lib/supabase-admin';
import { Resend } from 'resend';
import crypto from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);
const SECRET = process.env.JWT_SECRET || 'plb-admin-fallback-secret-key-32chars!!';

export async function POST(request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    const origin = new URL(request.url).origin;

    // Verify admin exists
    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .select('id, email, name')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !admin) {
      // Return success to prevent enumeration
      return Response.json({ success: true });
    }

    // Generate Admin Reset JWT
    const tokenPayload = {
      admin_id: admin.id,
      email: admin.email,
      action: 'reset_password',
      exp: Date.now() + (30 * 60 * 1000), // 30 minutes
    };
    
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
    const signature = crypto.createHmac('sha256', SECRET).update(`${header}.${encodedPayload}`).digest('base64url');
    const resetToken = `${header}.${encodedPayload}.${signature}`;

    const resetLink = `${origin}/admin/reset-password?token=${resetToken}`;

    // Send via Resend
    const { error: emailError } = await resend.emails.send({
      from: 'Prime Admin <info@primerealops.com>',
      to: admin.email,
      subject: 'Admin Password Reset - Prime Lead Bridge',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 8px;">
          <h2 style="color: #333;">Admin Password Reset</h2>
          <p style="color: #555; line-height: 1.5;">Hello ${admin.name || 'Admin'},<br><br>You requested a password reset for your Prime Lead Bridge Admin Control Center.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Admin Password</a>
          </div>
          <p style="color: #777; font-size: 12px; line-height: 1.5;">This link will expire in 30 minutes. If you did not request this, please secure your account.</p>
        </div>
      `
    });

    if (emailError) {
      console.error('Admin Resend Error:', emailError);
      return Response.json({ error: 'Failed to send admin reset email' }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('Admin Forgot Password Error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
