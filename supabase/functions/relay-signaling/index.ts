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

    if (!message || !message.type) {
      return new Response(
        JSON.stringify({ error: 'Invalid message format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user is a member of the chat/room
    const { data: membership, error: memberError } = await supabase
      .from('chat_members')
      .select('user_id')
      .eq('chat_id', chatId || roomId)
      .eq('user_id', user.id)
      .single()

    if (memberError || !membership) {
      console.error('Membership verification failed:', memberError)
      return new Response(
        JSON.stringify({ error: 'Not authorized for this chat' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
      return new Response(
        JSON.stringify({ error: 'Invalid call type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send to channel using service role for reliable delivery
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const channel = serviceSupabase.channel(channelName)
    await channel.subscribe()
    
    await channel.send({
      type: 'broadcast',
      event: 'signaling',
      payload: authenticatedPayload
    })

    // Clean up
    await serviceSupabase.removeChannel(channel)

    console.log(`Relayed ${message.type} from ${user.id} to ${to || 'all'} in ${channelName}`)

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
