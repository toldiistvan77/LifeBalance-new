import { supabase } from './supabase'

export async function testSupabaseConnection() {
  const { error } = await supabase.auth.getSession()

  if (error) {
    console.error('Supabase kapcsolati hiba:', error.message)
    return false
  }

  console.log('A Supabase Auth végpont válaszolt.')
  return true
}