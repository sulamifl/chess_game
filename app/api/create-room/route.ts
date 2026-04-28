import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  const { userId } = await request.json();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const roomId = Math.random().toString(36).substring(2, 10);
  const { error } = await supabase.from('game_rooms').insert({
    id: roomId,
    player1_id: userId,
    fen: 'start',
    current_turn: 'w',
    status: 'waiting',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ roomId });
}