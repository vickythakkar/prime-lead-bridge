import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Extract digits from a phone string and return the last 10 digits (or all digits if < 10).
 */
export function normalizePhoneDigits(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/**
 * Build a Postgres ILIKE pattern that matches regardless of separators like (859) 209-6868, 859-209-6868, +18592096868.
 */
function buildFlexiblePhonePattern(digits) {
  if (digits.length === 10) {
    return `%${digits.slice(0, 3)}%${digits.slice(3, 6)}%${digits.slice(6, 10)}%`;
  }
  return `%${digits}%`;
}

/**
 * Looks up a caller by phone number across contacts, leads, and agents.
 * If orgId is provided, searches within that organization first.
 * If orgId is omitted (global Admin lookup), searches across all organizations.
 */
export async function lookupCallerByPhone(phone, orgId = null) {
  const digits = normalizePhoneDigits(phone);
  if (!digits || digits.length < 7) return null;

  const pattern = buildFlexiblePhonePattern(digits);

  const matchesExactDigits = (candidatePhone) => {
    const candidateDigits = normalizePhoneDigits(candidatePhone);
    return Boolean(candidateDigits) && candidateDigits === digits;
  };

  // 1. Check contacts table first
  try {
    let contactsQuery = supabaseAdmin
      .from('contacts')
      .select('id, name, phone, company, custom_fields, organization_id, organizations(company_name, name)')
      .ilike('phone', pattern)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('updated_at', { ascending: false })
      .limit(20);

    if (orgId) {
      contactsQuery = contactsQuery.eq('organization_id', orgId);
    }

    const { data: contacts } = await contactsQuery;
    const matchedContact = (contacts || []).find((c) => c.name && matchesExactDigits(c.phone));
    if (matchedContact) {
      return {
        id: matchedContact.id,
        name: matchedContact.name.trim(),
        company: matchedContact.company || null,
        role: matchedContact.custom_fields?.role || null,
        organizationName: matchedContact.organizations?.company_name || matchedContact.organizations?.name || null,
        source: 'contact',
      };
    }
  } catch (err) {
    console.warn('[caller-lookup] contacts query error:', err?.message || err);
  }

  // 2. Check leads table
  try {
    let leadsQuery = supabaseAdmin
      .from('leads')
      .select('id, name, phone, organization_id, organizations(company_name, name)')
      .ilike('phone', pattern)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('created_at', { ascending: false })
      .limit(20);

    if (orgId) {
      leadsQuery = leadsQuery.eq('organization_id', orgId);
    }

    const { data: leads } = await leadsQuery;
    const matchedLead = (leads || []).find((l) => l.name && matchesExactDigits(l.phone));
    if (matchedLead) {
      return {
        id: matchedLead.id,
        name: matchedLead.name.trim(),
        company: null,
        role: 'Lead',
        organizationName: matchedLead.organizations?.company_name || matchedLead.organizations?.name || null,
        source: 'lead',
      };
    }
  } catch (err) {
    console.warn('[caller-lookup] leads query error:', err?.message || err);
  }

  // 3. Check agents table (cell_phone)
  try {
    let agentsQuery = supabaseAdmin
      .from('agents')
      .select('id, name, cell_phone, organization_id, organizations(company_name, name)')
      .ilike('cell_phone', pattern)
      .limit(20);

    if (orgId) {
      agentsQuery = agentsQuery.eq('organization_id', orgId);
    }

    const { data: agents } = await agentsQuery;
    const matchedAgent = (agents || []).find((a) => a.name && matchesExactDigits(a.cell_phone));
    if (matchedAgent) {
      return {
        id: matchedAgent.id,
        name: matchedAgent.name.trim(),
        company: null,
        role: 'Agent',
        organizationName: matchedAgent.organizations?.company_name || matchedAgent.organizations?.name || null,
        source: 'agent',
      };
    }
  } catch (err) {
    console.warn('[caller-lookup] agents query error:', err?.message || err);
  }

  return null;
}
