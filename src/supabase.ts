import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
console.log(
  'Supabase URL betöltve:',
  Boolean(supabaseUrl)
)
console.log(
  'Supabase kulcs betöltve:',
  Boolean(supabasePublishableKey)
)
console.log('Supabase URL formátum:', supabaseUrl)

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Hiányzik a Supabase URL vagy a Publishable key a .env.local fájlból.'
  )
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
)