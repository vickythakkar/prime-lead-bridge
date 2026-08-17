export async function DELETE(request, { params }) {
  const admin = verifyAdminToken(request);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    
    // Safety check: Do not allow deleting the Admin org
    if (id === '8a564ec4-9544-4b63-ac58-98ec66d69a76') {
      return Response.json({ error: 'Cannot delete the Admin organization' }, { status: 403 });
    }

    // 1. Get associated Twilio numbers
    const { data: numbers } = await supabaseAdmin
      .from('organization_numbers')
      .select('*')
      .eq('organization_id', id);
      
    // 2. Release from Twilio
    if (numbers && numbers.length > 0) {
      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      for (const num of numbers) {
        if (num.twilio_sid) {
          try {
            await client.incomingPhoneNumbers(num.twilio_sid).remove();
          } catch (e) {
            console.error('Failed to release Twilio number during org deletion:', e);
          }
        }
      }
    }

    // 3. Delete the organization (Assuming ON DELETE CASCADE or we might need to delete related records first)
    const { error } = await supabaseAdmin
      .from('organizations')
      .delete()
      .eq('id', id);

    if (error) {
      // If it fails due to foreign key constraints, we might need manual cleanup
      console.error('Supabase Delete Error:', error);
      throw error;
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('Error deleting org:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
