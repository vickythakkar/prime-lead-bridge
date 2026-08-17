import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing ID' }), { status: 400 });
    }

    // 1. Get the twilio_sid from DB
    const { data: numData, error: fetchError } = await supabaseAdmin
      .from('organization_numbers')
      .select('*')
      .eq('id', id)
      .single();
      
    if (fetchError || !numData) {
      return new Response(JSON.stringify({ error: 'Number not found in DB' }), { status: 404 });
    }

    // 2. Release from Twilio
    if (numData.twilio_sid) {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.incomingPhoneNumbers(numData.twilio_sid).remove();
    }

    // 3. Remove from DB
    const { error: delError } = await supabaseAdmin
      .from('organization_numbers')
      .delete()
      .eq('id', id);

    if (delError) {
      return new Response(JSON.stringify({ error: 'Failed to delete from DB' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error("Twilio release error:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}
