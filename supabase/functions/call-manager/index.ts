import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { 
      action,
      callId,
      officeId,
      twilioCallSid,
      fromNumber,
      toNumber 
    } = await req.json()

    console.log('Call Manager - Action:', action, { callId, officeId, twilioCallSid })

    switch (action) {
      case 'start_call':
        return await handleStartCall(supabaseClient, {
          callId,
          officeId,
          twilioCallSid,
          fromNumber,
          toNumber
        })

      case 'end_call':
        return await handleEndCall(supabaseClient, {
          callId,
          outcome: req.body?.outcome || 'completed'
        })

      case 'get_call_history':
        return await getCallHistory(supabaseClient, callId)

      case 'update_call_outcome':
        return await updateCallOutcome(supabaseClient, {
          callId,
          outcome: req.body?.outcome,
          transcriptJson: req.body?.transcriptJson
        })

      default:
        throw new Error(`Unknown action: ${action}`)
    }

  } catch (error) {
    console.error('Call Manager Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    )
  }
})

async function handleStartCall(supabaseClient: any, params: any) {
  const { callId, officeId, twilioCallSid, fromNumber, toNumber } = params

  try {
    // Create new call record
    const { data: call, error } = await supabaseClient
      .from('calls')
      .insert({
        id: callId,
        clinic_id: await getClinicIdFromOffice(supabaseClient, officeId),
        office_id: officeId,
        twilio_call_sid: twilioCallSid,
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    // Log initial system message
    await supabaseClient
      .from('turns')
      .insert({
        call_id: callId,
        role: 'system',
        text: `Call started from ${fromNumber} to ${toNumber}`,
        at: new Date().toISOString(),
        meta: { fromNumber, toNumber, twilioCallSid }
      })

    // Generate initial AI greeting
    const { data: aiResponse } = await supabaseClient.functions.invoke('ai-call-handler', {
      body: {
        callId,
        officeId,
        userMessage: '', // Empty for initial greeting
        conversationHistory: [],
        context: { conversationState: 'greeting' }
      }
    })

    return new Response(
      JSON.stringify({
        success: true,
        call,
        initialResponse: aiResponse?.response || "Hello! Thank you for calling. How can I assist you today?"
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    )

  } catch (error) {
    console.error('Error starting call:', error)
    throw error
  }
}

async function handleEndCall(supabaseClient: any, params: any) {
  const { callId, outcome } = params

  try {
    // Update call record
    const { data: call, error } = await supabaseClient
      .from('calls')
      .update({
        ended_at: new Date().toISOString(),
        outcome
      })
      .eq('id', callId)
      .select()
      .single()

    if (error) throw error

    // Log call end
    await supabaseClient
      .from('turns')
      .insert({
        call_id: callId,
        role: 'system',
        text: `Call ended with outcome: ${outcome}`,
        at: new Date().toISOString(),
        meta: { outcome }
      })

    return new Response(
      JSON.stringify({
        success: true,
        call
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    )

  } catch (error) {
    console.error('Error ending call:', error)
    throw error
  }
}

async function getCallHistory(supabaseClient: any, callId: string) {
  try {
    // Get call details
    const { data: call, error: callError } = await supabaseClient
      .from('calls')
      .select('*')
      .eq('id', callId)
      .single()

    if (callError) throw callError

    // Get all turns for this call
    const { data: turns, error: turnsError } = await supabaseClient
      .from('turns')
      .select('*')
      .eq('call_id', callId)
      .order('at', { ascending: true })

    if (turnsError) throw turnsError

    return new Response(
      JSON.stringify({
        success: true,
        call,
        turns: turns || []
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    )

  } catch (error) {
    console.error('Error getting call history:', error)
    throw error
  }
}

async function updateCallOutcome(supabaseClient: any, params: any) {
  const { callId, outcome, transcriptJson } = params

  try {
    const updateData: any = {}
    if (outcome) updateData.outcome = outcome
    if (transcriptJson) updateData.transcript_json = transcriptJson

    const { data: call, error } = await supabaseClient
      .from('calls')
      .update(updateData)
      .eq('id', callId)
      .select()
      .single()

    if (error) throw error

    return new Response(
      JSON.stringify({
        success: true,
        call
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    )

  } catch (error) {
    console.error('Error updating call outcome:', error)
    throw error
  }
}

async function getClinicIdFromOffice(supabaseClient: any, officeId: string) {
  try {
    const { data: office, error } = await supabaseClient
      .from('offices')
      .select('clinic_id')
      .eq('id', officeId)
      .single()

    if (error) throw error
    return office.clinic_id
  } catch (error) {
    console.error('Error getting clinic ID from office:', error)
    return null
  }
}