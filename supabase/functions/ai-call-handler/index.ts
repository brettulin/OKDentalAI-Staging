import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CallContext {
  callId: string
  officeId: string
  patientPhone?: string
  conversationState: 'greeting' | 'patient_lookup' | 'patient_creation' | 'appointment_booking' | 'confirmation'
  patientData?: any
  selectedProvider?: string
  selectedLocation?: string
  selectedSlot?: any
  appointmentData?: any
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
      callId, 
      officeId, 
      userMessage, 
      conversationHistory = [],
      context = {} 
    } = await req.json()

    console.log('AI Call Handler - Processing:', { callId, officeId, userMessage })

    // Get or create call context
    let callContext: CallContext = {
      callId,
      officeId,
      conversationState: 'greeting',
      ...context
    }

    // Process the user message and determine intent
    const intent = await analyzeIntent(userMessage, conversationHistory)
    console.log('Detected intent:', intent)

    let aiResponse = ''
    let actions = []

    switch (intent.type) {
      case 'schedule_appointment':
        const appointmentResult = await handleScheduleAppointment(
          supabaseClient, 
          callContext, 
          intent, 
          userMessage
        )
        aiResponse = appointmentResult.response
        actions = appointmentResult.actions
        callContext = { ...callContext, ...appointmentResult.updatedContext }
        break

      case 'patient_lookup':
        const lookupResult = await handlePatientLookup(
          supabaseClient, 
          callContext, 
          intent, 
          userMessage
        )
        aiResponse = lookupResult.response
        actions = lookupResult.actions
        callContext = { ...callContext, ...lookupResult.updatedContext }
        break

      case 'provide_info':
        aiResponse = await handleInfoRequest(supabaseClient, callContext, intent, userMessage)
        break

      case 'greeting':
        aiResponse = "Hello! I'm your AI dental receptionist. How can I help you today? Are you looking to schedule an appointment, check on an existing appointment, or do you have questions about our services?"
        break

      default:
        aiResponse = "I understand you're looking for assistance. Could you please tell me if you'd like to schedule an appointment, check on an existing one, or if you have other questions about our dental services?"
    }

    // Log the interaction
    await logCallTurn(supabaseClient, callId, 'user', userMessage)
    await logCallTurn(supabaseClient, callId, 'assistant', aiResponse)

    return new Response(
      JSON.stringify({
        success: true,
        response: aiResponse,
        actions,
        context: callContext,
        intent: intent.type
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    )

  } catch (error) {
    console.error('AI Call Handler Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        response: "I apologize, but I'm experiencing some technical difficulties. Let me transfer you to a human representative who can assist you better."
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    )
  }
})

async function analyzeIntent(message: string, history: any[]) {
  const lowerMessage = message.toLowerCase()
  
  // Simple intent detection - in production, use a proper NLP service
  if (lowerMessage.includes('appointment') || lowerMessage.includes('schedule') || lowerMessage.includes('book')) {
    return { type: 'schedule_appointment', confidence: 0.9 }
  }
  
  if (lowerMessage.includes('cancel') || lowerMessage.includes('reschedule')) {
    return { type: 'manage_appointment', confidence: 0.8 }
  }
  
  if (lowerMessage.includes('hours') || lowerMessage.includes('location') || lowerMessage.includes('address')) {
    return { type: 'provide_info', confidence: 0.8 }
  }
  
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || history.length === 0) {
    return { type: 'greeting', confidence: 0.7 }
  }
  
  // Check if message contains phone number for patient lookup
  const phonePattern = /(\d{3}[-.]?\d{3}[-.]?\d{4})/
  if (phonePattern.test(message)) {
    return { type: 'patient_lookup', confidence: 0.9, extractedPhone: message.match(phonePattern)?.[0] }
  }
  
  return { type: 'unknown', confidence: 0.3 }
}

async function handleScheduleAppointment(supabaseClient: any, context: CallContext, intent: any, message: string) {
  let response = ''
  let actions = []
  let updatedContext = {}

  switch (context.conversationState) {
    case 'greeting':
      // First, we need patient information
      response = "I'd be happy to help you schedule an appointment! To get started, could you please provide your phone number so I can look up your information?"
      updatedContext = { conversationState: 'patient_lookup' }
      break

    case 'patient_lookup':
      // Extract phone number and search for patient
      const phonePattern = /(\d{3}[-.]?\d{3}[-.]?\d{4})/
      const extractedPhone = message.match(phonePattern)?.[0]
      
      if (extractedPhone) {
        try {
          const { data: searchResult } = await supabaseClient.functions.invoke('pms-integrations', {
            body: {
              action: 'searchPatientByPhone',
              phoneNumber: extractedPhone,
              officeId: context.officeId
            }
          })

          if (searchResult?.data?.length > 0) {
            const patient = searchResult.data[0]
            response = `Great! I found your information, ${patient.firstName} ${patient.lastName}. Now let me check our available providers and times for you.`
            actions.push('get_providers')
            updatedContext = { 
              conversationState: 'appointment_booking',
              patientData: patient,
              patientPhone: extractedPhone 
            }
          } else {
            response = `I don't see an existing patient record for that number. No problem! I can create a new patient record for you. Could you please tell me your first and last name?`
            updatedContext = { 
              conversationState: 'patient_creation',
              patientPhone: extractedPhone 
            }
          }
        } catch (error) {
          console.error('Patient lookup error:', error)
          response = "I'm having trouble accessing our patient database right now. Let me get your basic information and I'll help you schedule an appointment."
          updatedContext = { conversationState: 'patient_creation', patientPhone: extractedPhone }
        }
      } else {
        response = "I didn't catch a phone number in your message. Could you please provide your 10-digit phone number?"
      }
      break

    case 'patient_creation':
      // Extract name information and create patient
      const namePattern = /my name is ([a-zA-Z\s]+)/i
      const nameMatch = message.match(namePattern)
      
      if (nameMatch || message.split(' ').length >= 2) {
        const fullName = nameMatch?.[1] || message.trim()
        const [firstName, ...lastNameParts] = fullName.split(' ')
        const lastName = lastNameParts.join(' ')

        try {
          const { data: createResult } = await supabaseClient.functions.invoke('pms-integrations', {
            body: {
              action: 'createPatient',
              patientData: {
                firstName,
                lastName,
                phone: context.patientPhone
              },
              officeId: context.officeId
            }
          })

          if (createResult?.data) {
            response = `Perfect! I've created your patient record, ${firstName}. Now let me show you our available appointment times.`
            actions.push('get_providers')
            updatedContext = { 
              conversationState: 'appointment_booking',
              patientData: createResult.data 
            }
          }
        } catch (error) {
          console.error('Patient creation error:', error)
          response = `Thank you, ${firstName}. I'll note your information and proceed with finding available appointment times.`
          updatedContext = { 
            conversationState: 'appointment_booking',
            patientData: { firstName, lastName, phone: context.patientPhone }
          }
        }
      } else {
        response = "Could you please provide your first and last name?"
      }
      break

    case 'appointment_booking':
      // Handle appointment preferences and booking
      response = await handleAppointmentBooking(supabaseClient, context, message)
      break
  }

  return { response, actions, updatedContext }
}

async function handlePatientLookup(supabaseClient: any, context: CallContext, intent: any, message: string) {
  const phone = intent.extractedPhone || context.patientPhone
  
  if (!phone) {
    return {
      response: "Could you please provide the phone number you'd like me to look up?",
      actions: [],
      updatedContext: {}
    }
  }

  try {
    const { data: searchResult } = await supabaseClient.functions.invoke('pms-integrations', {
      body: {
        action: 'searchPatientByPhone',
        phoneNumber: phone,
        officeId: context.officeId
      }
    })

    if (searchResult?.data?.length > 0) {
      const patient = searchResult.data[0]
      return {
        response: `I found the patient record for ${patient.firstName} ${patient.lastName} at ${phone}. How can I help you with this account?`,
        actions: [],
        updatedContext: { patientData: patient, patientPhone: phone }
      }
    } else {
      return {
        response: `I don't see a patient record for ${phone}. Would you like me to create a new patient record or try a different phone number?`,
        actions: [],
        updatedContext: { patientPhone: phone }
      }
    }
  } catch (error) {
    console.error('Patient lookup error:', error)
    return {
      response: "I'm having trouble accessing our patient database right now. Could you please call back in a few minutes or let me transfer you to a human representative?",
      actions: [],
      updatedContext: {}
    }
  }
}

async function handleInfoRequest(supabaseClient: any, context: CallContext, intent: any, message: string) {
  // Get office/location information
  try {
    const { data: locationsResult } = await supabaseClient.functions.invoke('pms-integrations', {
      body: {
        action: 'listLocations',
        officeId: context.officeId
      }
    })

    if (locationsResult?.data?.length > 0) {
      const location = locationsResult.data[0]
      
      if (message.toLowerCase().includes('hours')) {
        return `Our office hours vary by day. For the most current hours, please check our website or I can transfer you to our front desk. Our main location is at ${location.address.street}, ${location.address.city}, ${location.address.state}.`
      }
      
      if (message.toLowerCase().includes('location') || message.toLowerCase().includes('address')) {
        return `Our main location is at ${location.address.street}, ${location.address.city}, ${location.address.state} ${location.address.zipCode}. ${location.phone ? `You can reach us at ${location.phone}.` : ''}`
      }
    }
  } catch (error) {
    console.error('Info request error:', error)
  }

  return "I'd be happy to help with information about our practice. Could you be more specific about what you'd like to know? I can help with scheduling, location details, or general questions about our services."
}

async function handleAppointmentBooking(supabaseClient: any, context: CallContext, message: string) {
  try {
    // Get available providers first
    const { data: providersResult } = await supabaseClient.functions.invoke('pms-integrations', {
      body: {
        action: 'listProviders',
        officeId: context.officeId
      }
    })

    if (providersResult?.data?.length > 0) {
      const providers = providersResult.data
      const providersList = providers.map((p: any) => `Dr. ${p.name}`).join(', ')
      
      // Simple date extraction
      const datePattern = /(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|next week)/i
      const timePattern = /(morning|afternoon|evening|\d{1,2}:\d{2}|\d{1,2}\s?(am|pm))/i
      
      const hasDatePreference = datePattern.test(message)
      const hasTimePreference = timePattern.test(message)

      if (hasDatePreference || hasTimePreference) {
        // Try to get available slots for the first provider
        const providerId = providers[0].id
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const weekLater = new Date()
        weekLater.setDate(weekLater.getDate() + 7)

        const { data: slotsResult } = await supabaseClient.functions.invoke('pms-integrations', {
          body: {
            action: 'getAvailableSlots',
            providerId,
            dateRange: {
              from: tomorrow.toISOString().split('T')[0],
              to: weekLater.toISOString().split('T')[0]
            },
            officeId: context.officeId
          }
        })

        if (slotsResult?.data?.length > 0) {
          const availableSlots = slotsResult.data.slice(0, 3) // Show first 3 slots
          const slotsList = availableSlots.map((slot: any) => {
            const date = new Date(slot.startTime)
            return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
          }).join(', ')
          
          return `I have several appointments available with ${providersList}. Here are some options: ${slotsList}. Which time works best for you?`
        }
      }

      return `I can schedule you with any of our providers: ${providersList}. What day and time would work best for you? I can check morning, afternoon, or evening appointments.`
    } else {
      return "Let me check our appointment availability and get back to you. In the meantime, is there a particular day or time that works best for you?"
    }
  } catch (error) {
    console.error('Appointment booking error:', error)
    return "I'm checking our appointment availability. What day and time would be most convenient for you?"
  }
}

async function logCallTurn(supabaseClient: any, callId: string, role: string, text: string) {
  try {
    await supabaseClient
      .from('turns')
      .insert({
        call_id: callId,
        role,
        text,
        at: new Date().toISOString()
      })
  } catch (error) {
    console.error('Error logging call turn:', error)
  }
}