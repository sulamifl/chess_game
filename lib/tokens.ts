import { supabase } from './supabase';

export async function addTokens(userId: string, amount: number): Promise<boolean> {
  const { error } = await supabase.rpc('increment_tokens', { user_id: userId, inc_amount: amount });
  if (error) {
    console.error('Error adding tokens:', error);
    return false;
  }
  return true;
}

export async function deductTokens(userId: string, amount: number): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('tokens')
    .eq('id', userId)
    .single();
  if (error || !data) return false;
  if (data.tokens < amount) return false;
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ tokens: data.tokens - amount })
    .eq('id', userId);
  return !updateError;
}

export async function getTokens(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('tokens')
    .eq('id', userId)
    .single();
  if (error) return 0;
  return data.tokens;
}