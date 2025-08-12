import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getAuthContext } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authContext = await getAuthContext(req);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { phoneNumber, callId, userMessage } = await req.json();

    console.log(`Patient lookup: ${phoneNumber} for call ${callId}`);

    // First try PMS integration if available
    let pmsResults = [];
    let localResults = [];

    // Get office for PMS integration
    const { data: offices } = await supabase
      .from('offices')
      .select('*')
      .eq('clinic_id', authContext.clinic_id);

    if (offices && offices.length > 0) {
      const office = offices[0]; // Use first available office
      
      try {
        const { data: pmsData, error: pmsError } = await supabase.functions.invoke('pms-integrations', {
          body: {
            action: 'searchPatientByPhone',
            officeId: office.id,
            phoneNumber: phoneNumber
          }
        });

        if (!pmsError && pmsData?.success) {
          pmsResults = pmsData.data || [];
          console.log(`Found ${pmsResults.length} patients in PMS`);
        }
      } catch (error) {
        console.error('PMS search error:', error);
      }
    }

    // Also search local database
    const { data: localPatients } = await supabase
      .from('patients')
      .select('*')
      .eq('clinic_id', authContext.clinic_id)
      .ilike('phone', `%${phoneNumber.replace(/\D/g, '')}%`);

    localResults = localPatients || [];

    // Combine results (PMS takes precedence)
    const allResults = [...pmsResults];
    
    // Add local results that aren't already in PMS results
    localResults.forEach(localPatient => {
      const exists = pmsResults.some(pmsPatient => 
        pmsPatient.phone?.replace(/\D/g, '') === localPatient.phone?.replace(/\D/g, '')
      );
      
      if (!exists) {
        allResults.push({
          id: localPatient.id,
          firstName: localPatient.full_name.split(' ')[0],
          lastName: localPatient.full_name.split(' ').slice(1).join(' '),
          phone: localPatient.phone,
          email: localPatient.email,
          dateOfBirth: localPatient.dob,
          source: 'local'
        });
      }
    });

    // Store search result in call context for AI to use
    if (callId) {
      const searchContext = {
        phoneNumber,
        patientsFound: allResults.length,
        searchTimestamp: new Date().toISOString(),
        patients: allResults.map(p => ({
          name: `${p.firstName} ${p.lastName}`,
          phone: p.phone,
          hasAccount: true
        }))
      };

      // Store turn with search context
      await supabase
        .from('turns')
        .insert({
          call_id: callId,
          role: 'system',
          text: `Patient search completed: ${allResults.length} patients found for ${phoneNumber}`,
          meta: { 
            action: 'patient_search',
            context: searchContext
          }
        });

      // Generate AI response based on search results
      let aiResponse = '';
      
      if (allResults.length === 0) {
        aiResponse = `I don't see any existing patients with the phone number ${phoneNumber}. Let me help you create a new patient record. Could you please provide the patient's first and last name?`;
      } else if (allResults.length === 1) {
        const patient = allResults[0];
        aiResponse = `I found ${patient.firstName} ${patient.lastName} in our system with phone number ${patient.phone}. Is this the correct patient? If so, I can help you schedule an appointment.`;
      } else {
        const patientList = allResults.map(p => `${p.firstName} ${p.lastName}`).join(', ');
        aiResponse = `I found ${allResults.length} patients with that phone number: ${patientList}. Which patient would you like to schedule for?`;
      }

      // Generate AI response using OpenAI
      try {
        const { data: chatData } = await supabase.functions.invoke('openai-chat', {
          body: {
            messages: [
              { role: 'user', content: userMessage || `Search for patient with phone ${phoneNumber}` },
              { role: 'assistant', content: aiResponse }
            ],
            callId: callId,
            aiSettings: {}
          }
        });

        if (chatData?.response) {
          aiResponse = chatData.response;
        }
      } catch (error) {
        console.error('AI response error:', error);
        // Use fallback response
      }

      return new Response(
        JSON.stringify({
          success: true,
          patients: allResults,
          aiResponse,
          context: searchContext
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        patients: allResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Patient lookup error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        patients: []
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});