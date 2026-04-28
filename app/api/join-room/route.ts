import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  const { roomId, userId } = await request.json();
  if (!roomId || !userId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  // Проверяем, существует ли комната и не заполнена ли уже
  const { data: room, error } = await supabase
    .from('game_rooms')
    .select('*')
    .eq('id', roomId)
    .single();
  if (error || !room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  if (room.player2_id) return NextResponse.json({ error: 'Room full' }, { status: 400 });

  // Обновляем: добавляем второго игрока, статус меняем на playing, если не был
  const { error: updateError } = await supabase
    .from('game_rooms')
    .update({ player2_id: userId, status: 'playing' })
    .eq('id', roomId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}