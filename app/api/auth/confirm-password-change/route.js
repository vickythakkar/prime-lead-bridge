import { supabaseAdmin } from '@/lib/supabase-admin';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify the user via Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Send the confirmation email
    const { error: emailError } = await resend.emails.send({
      from: 'Prime Lead Bridge <info@primerealops.com>',
      to: user.email,
      subject: 'Security Alert: Password Changed',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 8px;">
          <h2 style="color: #333;">Password Changed Successfully</h2>
          <p style="color: #555; line-height: 1.5;">This is an automated confirmation that the password for your Prime Lead Bridge account (<strong>${user.email}</strong>) has been successfully updated.</p>
          <p style="color: #d97706; font-size: 14px; line-height: 1.5; padding: 10px; background-color: #fef3c7; border-radius: 4px; border: 1px solid #fde68a;">
            <strong>Security Notice:</strong> If you did not make this change, please contact the support team immediately as your account may be compromised.
          </p>
        </div>
      `
    });

    if (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      return Response.json({ error: 'Failed to send confirmation email' }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('Confirm Password API Error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
