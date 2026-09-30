import { supabaseAdmin } from '@/lib/supabase-admin';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    const origin = new URL(request.url).origin;

    // Generate the password reset link using Supabase Admin
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${origin}/reset-password`,
      }
    });

    if (error) {
      console.error('Generate Link Error:', error);
      // Return success to prevent email enumeration
      return Response.json({ success: true });
    }

    const resetLink = data.properties.action_link;

    // Send via Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'Prime Lead Bridge <info@primerealops.com>',
      to: email,
      subject: 'Password Reset Request - Prime Lead Bridge',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 8px;">
          <h2 style="color: #333;">Reset Your Password</h2>
          <p style="color: #555; line-height: 1.5;">You recently requested to reset your password for your Prime Lead Bridge account. Click the button below to securely set a new password.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
          </div>
          <p style="color: #777; font-size: 12px; line-height: 1.5;">If you did not request a password reset, please ignore this email or contact support if you have questions.</p>
        </div>
      `
    });

    if (emailError) {
      console.error('Resend Primary Error:', emailError);
      
      // Fallback for unverified domains in Resend
      const { error: fallbackError } = await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: email,
        subject: 'Password Reset Request - Prime Lead Bridge',
        html: `Click <a href="${resetLink}">here</a> to reset your password.`
      });

      if (fallbackError) {
        console.error('Resend Fallback Error:', fallbackError);
        return Response.json({ error: fallbackError.message }, { status: 500 });
      }
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('Forgot Password API Error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
