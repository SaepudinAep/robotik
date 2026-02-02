import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS (Penting agar web Bapak bisa memanggil ini)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '' // Memakai Kunci Master dari Secret
    )

    const { email, password, role, school_id, level_id, class_id } = await req.json()

    // 1. Buat User di Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (authError) throw authError

    // 2. Update Profil (Karena Trigger sudah membuat barisnya, kita tinggal update isinya)
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({ role, school_id, level_id, class_id })
      .eq('id', authUser.user.id)

    if (profileError) throw profileError

    return new Response(JSON.stringify({ message: 'User berhasil dibuat!' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
