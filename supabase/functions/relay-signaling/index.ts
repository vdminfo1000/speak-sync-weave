import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with user's auth
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { to, message, chatId, roomId, callType } = await req.json()
    
    console.log('[relay-signaling] Received request:', {
      from: user.id,
      to,
      messageType: message?.type,
      chatId,
      roomId,
      callType
    })

    if (!message || !message.type) {
      console.error('[relay-signaling] Invalid message format:', message)
      return new Response(
        JSON.stringify({ error: 'Invalid message format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // For group calls, we don't require chat membership since users are invited directly
    // The invitation itself serves as authorization
    const isGroupCall = callType === 'group-video' || callType === 'group-audio';
    
    if (!isGroupCall) {
      // Verify user is a member of the chat for regular calls
      const { data: membership, error: memberError } = await supabase
        .from('chat_members')
        .select('user_id, chat_id')
        .eq('chat_id', chatId || roomId)
        .eq('user_id', user.id)
        .maybeSingle()

      console.log('[relay-signaling] Membership query result:', {
        userId: user.id,
        chatId: chatId || roomId,
        membership,
        error: memberError
      })

      if (memberError) {
        console.error('[relay-signaling] Database error during membership check:', memberError)
        return new Response(
          JSON.stringify({ 
            error: 'Database error checking chat membership',
            details: memberError.message 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!membership) {
        console.error('[relay-signaling] User is not a member of this chat:', {
          userId: user.id,
          chatId: chatId || roomId,
          messageType: message?.type
        })
        return new Response(
          JSON.stringify({ 
            error: 'Not authorized for this chat',
            chatId: chatId || roomId,
            userId: user.id
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      console.log('[relay-signaling] Membership verified for user:', user.id, 'in chat:', chatId || roomId)
    } else {
      console.log('[relay-signaling] Group call - skipping membership check for user:', user.id, 'in room:', roomId)
    }

    // Create authenticated signaling message
    // The 'from' field is now trustworthy since it's set by the server
    const authenticatedPayload = {
      from: user.id, // Server-verified sender
      to: to,
      message: message,
      timestamp: Date.now()
    }

    // Determine channel name based on call type
    let channelName: string
    if (callType === 'video') {
      channelName = `video-call-${chatId}`
    } else if (callType === 'audio') {
      channelName = `audio-call-${chatId}`
    } else if (callType === 'group-video') {
      channelName = `group-video-call-${roomId}`
    } else if (callType === 'group-audio') {
      channelName = `group-audio-call-${roomId}`
    } else {
      console.error('[relay-signaling] Invalid call type:', callType)
      return new Response(
        JSON.stringify({ error: 'Invalid call type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('[relay-signaling] Broadcasting to channel:', channelName)

    // Send to channel using service role for reliable delivery via HTTP broadcast
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    console.log('[relay-signaling] Sending broadcast message:', {
      event: 'signaling',
      messageType: message.type,
      from: user.id,
      to: to
    })
    
    // Use direct HTTP broadcast API for guaranteed delivery
    const broadcastResponse = await fetch(
      `${supabaseUrl}/realtime/v1/api/broadcast`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          messages: [
            {
              topic: channelName,
              event: 'signaling',
              payload: authenticatedPayload,
            }
          ]
        }),
      }
    )

    if (!broadcastResponse.ok) {
      const errorText = await broadcastResponse.text()
      console.error('[relay-signaling] Broadcast failed:', broadcastResponse.status, errorText)
      throw new Error(`Broadcast failed: ${broadcastResponse.status}`)
    }

    console.log(`[relay-signaling] Successfully relayed ${message.type} from ${user.id} to ${to || 'all'} in ${channelName}`)

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in relay-signaling:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
