// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

Deno.serve(async (req) => {
  try {
    const SUPABASE_URL_ENV = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('PROJECT_URL') ?? ''
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!SUPABASE_URL_ENV || !serviceKey) {
      throw new Error('Server configuration error');
    }

    const supabaseAdmin = createClient(
      SUPABASE_URL_ENV,
      serviceKey,
    );

    // Get the user's organization
    const userId = 'fe543d69-f2dc-4097-8b3e-daa379fd3876';
    
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('primary_organization_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error(`Failed to fetch profile: ${profileError?.message || 'Profile not found'}`);
    }

    if (!profile.primary_organization_id) {
      throw new Error('No primary organization found for user');
    }

    // Get current state before reset
    const { data: orgBefore, error: orgBeforeError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, stripe_account_id, charges_enabled, payouts_enabled')
      .eq('id', profile.primary_organization_id)
      .single();

    if (orgBeforeError || !orgBefore) {
      throw new Error(`Failed to fetch organization: ${orgBeforeError?.message || 'Organization not found'}`);
    }

    // Reset Stripe settings
    const { error: updateError } = await supabaseAdmin
      .from('organizations')
      .update({
        stripe_account_id: null,
        charges_enabled: false,
        payouts_enabled: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.primary_organization_id);

    if (updateError) {
      throw new Error(`Failed to reset organization: ${updateError.message}`);
    }

    // Verify the reset
    const { data: orgAfter, error: orgAfterError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, stripe_account_id, charges_enabled, payouts_enabled')
      .eq('id', profile.primary_organization_id)
      .single();

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Stripe settings reset successfully',
        before: orgBefore,
        after: orgAfter
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});
