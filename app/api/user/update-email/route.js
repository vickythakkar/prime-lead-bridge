import { supabaseAdmin } from '@/lib/supabase-admin';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized: missing authorization header' }, { status: 401 });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return Response.json({ error: 'Unauthorized: invalid token' }, { status: 401 });
    }

    // Authenticate user via Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized: session expired or invalid' }, { status: 401 });
    }

    const body = await request.json();
    const { newEmail, updateOrgEmails } = body;

    if (!newEmail || typeof newEmail !== 'string') {
      return Response.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const cleanEmail = newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return Response.json({ error: 'Please enter a valid email address format.' }, { status: 400 });
    }

    if (cleanEmail === (user.email || '').toLowerCase()) {
      return Response.json({ error: 'This is already your current sign-in email.' }, { status: 400 });
    }

    // Check if another user already has this email
    const { data: { users: existingUsers } = {}, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (!listErr && existingUsers) {
      const match = existingUsers.find(u => u.email?.toLowerCase() === cleanEmail && u.id !== user.id);
      if (match) {
        return Response.json({ error: 'An account with this email address already exists.' }, { status: 400 });
      }
    }

    // Update user's login email in Supabase Auth
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        email: cleanEmail,
        email_confirm: true
      }
    );

    if (updateError) {
      console.error('Failed to update auth user email:', updateError);
      return Response.json({ error: updateError.message || 'Failed to update login email.' }, { status: 400 });
    }

    // Optionally sync organization contact & notification emails
    if (updateOrgEmails) {
      try {
        const { data: agent } = await supabaseAdmin
          .from('agents')
          .select('organization_id')
          .eq('id', user.id)
          .single();

        if (agent?.organization_id) {
          await supabaseAdmin
            .from('organizations')
            .update({
              contact_email: cleanEmail,
              notify_email: cleanEmail
            })
            .eq('id', agent.organization_id);
        }
      } catch (orgErr) {
        console.warn('Could not auto-sync organization contact emails:', orgErr);
      }
    }

    // Send security notification email via Resend
    if (resend) {
      try {
        const recipients = [cleanEmail];
        if (user.email && user.email.toLowerCase() !== cleanEmail) {
          recipients.push(user.email);
        }

        await resend.emails.send({
          from: 'Prime Lead Bridge <info@primerealops.com>',
          to: recipients,
          subject: 'Security Alert: Prime Lead Bridge Login Email Updated',
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0b0f19; color: #f8fafc; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
              <h2 style="color: #6366f1; margin-top: 0;">Sign-In Email Updated</h2>
              <p style="color: #94a3b8; font-size: 15px; line-height: 1.6;">
                The primary sign-in email for your Prime Lead Bridge account has been successfully changed.
              </p>
              <div style="background-color: #131b2e; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid rgba(99, 102, 241, 0.2);">
                <p style="margin: 4px 0; color: #94a3b8; font-size: 14px;"><strong>Previous Email:</strong> ${user.email}</p>
                <p style="margin: 4px 0; color: #10b981; font-size: 14px;"><strong>New Sign-In Email:</strong> ${cleanEmail}</p>
              </div>
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">
                Next time you log in, please use <strong>${cleanEmail}</strong> along with your existing password.
              </p>
              <div style="margin-top: 24px; padding: 12px; background-color: #1c1917; border-left: 4px solid #f59e0b; border-radius: 4px; font-size: 13px; color: #fde68a;">
                <strong>Security note:</strong> If you did not make this change, please contact us immediately at info@primerealops.com.
              </div>
            </div>
          `
        });
      } catch (mailErr) {
        console.warn('Could not send confirmation email:', mailErr);
      }
    }

    return Response.json({
      success: true,
      email: cleanEmail,
      message: 'Sign-in email successfully updated.'
    });
  } catch (err) {
    console.error('Update email API error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
