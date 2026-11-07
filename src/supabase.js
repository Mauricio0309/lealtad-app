import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// La sesión se guarda en el celular y se renueva sola: el mesero entra una
// vez y no vuelve a escribir su correo cada día. (Son los valores por defecto
// de supabase-js; se dejan escritos para que nadie los apague sin querer.)
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
