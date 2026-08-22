import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendInviteEmail(toEmail: string, householdName: string, inviteCode: string) {
  try {
    await resend.emails.send({
      from: 'Omniwealth <onboarding@omniwealth.org>', // Replace with your verified Resend domain email
      to: toEmail,
      subject: `Join the ${householdName} Family Vault`,
      html: `
        <div style="font-family: sans-serif; background-color: #020617; color: #f8fafc; padding: 32px; border-radius: 16px;">
          <h2 style="color: #6366f1; margin-top: 0;">Global Family Vault Invitation</h2>
          <p>You have been invited to collaborate on the <strong>${householdName}</strong> wealth command center.</p>
          <p>Your household invite code is:</p>
          <div style="background: #0f172a; border: 1px solid #1e293b; padding: 16px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 2px; text-align: center; color: #38bdf8; margin: 20px 0;">
            ${inviteCode}
          </div>
          <p style="font-size: 12px; color: #94a3b8;">If you didn't request this invitation, you can safely ignore this email.</p>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error };
  }
}