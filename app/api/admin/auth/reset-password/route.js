import { supabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';

const SECRET = process.env.JWT_SECRET || 'plb-admin-fallback-secret-key-32chars!!';

export async function POST(request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password || password.length < 6) {
      return Response.json({ error: 'Valid token and a password of at least 6 characters are required.' }, { status: 400 });
    }

    // Verify the JWT token
    const parts = token.split('.');
    if (parts.length !== 3) {
      return Response.json({ error: 'Invalid or expired token.' }, { status: 401 });
    }

    const [header, encodedPayload, signature] = parts;
    const expectedSignature = crypto.createHmac('sha256', SECRET).update(`${header}.${encodedPayload}`).digest('base64url');

    if (signature !== expectedSignature) {
      return Response.json({ error: 'Invalid or tampered token.' }, { status: 401 });
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));

    if (payload.action !== 'reset_password' || !payload.admin_id) {
      return Response.json({ error: 'Invalid token type.' }, { status: 401 });
    }

    if (Date.now() > payload.exp) {
      return Response.json({ error: 'Reset link has expired. Please request a new one.' }, { status: 401 });
    }

    // Update the admin password in the database
    const { error: updateError } = await supabaseAdmin
      .from('admins')
      .update({ password_hash: password })
      .eq('id', payload.admin_id);

    if (updateError) {
      console.error('Failed to update admin password:', updateError);
      return Response.json({ error: 'Database error while updating password.' }, { status: 500 });
    }

    // Send the confirmation email
    try {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      await resend.emails.send({
        from: 'Prime Admin <info@primerealops.com>',
        to: payload.email,
        subject: 'Security Alert: Admin Password Changed',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 8px;">
            <h2 style="color: #333;">Admin Password Changed</h2>
            <p style="color: #555; line-height: 1.5;">This is an automated confirmation that the password for your Prime Lead Bridge Admin account (<strong>${payload.email}</strong>) has been successfully updated.</p>
            <p style="color: #d97706; font-size: 14px; line-height: 1.5; padding: 10px; background-color: #fef3c7; border-radius: 4px; border: 1px solid #fde68a;">
              <strong>Security Notice:</strong> If you did not make this change, please contact the IT support team immediately as your account may be compromised.
            </p>
          </div>
        `
      });
    } catch (emailErr) {
      console.error('Failed to send admin confirmation email:', emailErr);
      // We don't fail the password reset if the email fails
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('Admin Password Reset API Error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
