# Implement Automated Contacts on Signup

This plan addresses your requirement to automatically create contacts when a new broker signs up, ensuring proper cross-organization visibility while maintaining tenant data isolation.

## Proposed Changes

### 1. New API Route (`app/api/auth/setup/route.js`)
We will create a secure, backend API route that uses the admin database client to handle the post-signup setup. This ensures that we have the necessary permissions to write to the Admin's contact list (which the broker's client normally shouldn't be allowed to do).

This route will:
1. Create the Broker's Organization.
2. Create the Broker's Agent Profile.
3. **Broker's View:** Insert "PrimeRealOps" (Admin) as a contact into the Broker's CRM.
4. **Admin's View:** Insert the Broker's details (Name, Email, Phone, Company) as a contact into the Admin's CRM.

### 2. Update Signup Page (`app/signup/page.js`)
We will modify the frontend signup flow so that immediately after a successful Supabase authentication signup, it makes a secure call to our new `/api/auth/setup` route to provision the organization, agent, and the automated contacts.

### [NEW] `app/api/auth/setup/route.js`
- API endpoint using `supabaseAdmin` to handle secure database insertions across different organizations.

### [MODIFY] `app/signup/page.js`
- Replace the client-side database inserts with a single POST request to the new setup API route.

## User Review Required
> [!IMPORTANT]
> - By default, the admin contact added to the broker's CRM will be named **PrimeRealOps**. Should it have a specific email or phone number attached, or is just the name sufficient?
> - The admin's CRM will receive the broker as a contact. It will already show the Organization name column because the Admin Contacts page is currently designed to fetch and display the organization name for every contact globally.

## Verification Plan
1. I will sign up a test broker account.
2. Verify that the test broker's dashboard shows PrimeRealOps in their Contacts list.
3. Verify that the Admin's `/admin/contacts` page shows the new test broker's contact details along with their Organization name.
