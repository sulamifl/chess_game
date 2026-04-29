'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function TournamentPage() {
  const { id } = useParams();
  const router = useRouter();
  const [tournament, setTournament] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id || null));
  }, []);

  const fetchData = async () => {
    const { data: t } = await supabase.from('tournaments').select('*').eq('id', id).single();
    setTournament(t);

    const { data: p } = await supabase.from('tournament_players').select('*').eq('tournament_id', id);
    setPlayers(p || []);

    const { data: g } = await supabase.from('tournament_games').select('*').eq('tournament_id', id);
    setGames(g || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [id]);

  const joinTournament = async () => {
    if (!userId) return;
    const { data: profile } = await supabase.from('profiles').select('elo, username').eq('id', userId).single();
    await supabase.from('tournament_players').insert({
      tournament_id: id,
      user_id: userId,
      username: profile?.username,
      elo: profile?.elo,
    });
    await supabase.from('tournaments').update({ current_players: players.length + 1 }).eq('id', id);
    fetchData();
  };

  const startTournament = async () => {
    const pairs: [any, any][] = [];
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        pairs.push([players[i], players[j]]);
      }
    }
    for (const [p1, p2] of pairs) {
      const roomId = Math.random().toString(36).substring(2, 10);
      const timeSeconds = tournament.time_control === 'blitz' ? 180 : tournament.time_control === 'rapid' ? 600 : 1800;
      await supabase.from('game_rooms').insert({
        id: roomId,
        player1_id: p1.user_id,
        player2_id: p2.user_id,
        status: 'waiting',
        time_control: tournament.time_control,
        time_left_player1: timeSeconds,
        time_left_player2: timeSeconds,
      });
      await supabase.from('tournament_games').insert({
        tournament_id: id,
        room_id: roomId,
        player1_id: p1.user_id,
        player2_id: p2.user_id,
      });
    }
    await supabase.from('tournaments').update({ status: 'active' }).eq('id', id);
    fetchData();
  };

  const joinGame = (roomId: string) => {
    router.push(`/game/multiplayer?room=${roomId}`);
  };

  if (loading) return <div className="p-4">Загрузка...</div>;

  const myGames = games.filter(g => g.player1_id === userId || g.player2_id === userId);
  const isCreator = tournament?.created_by === userId;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">{tournament?.name}</h1>
      <p>Статус: {tournament?.status} | Игроков: {players.length}/{tournament?.max_players}</p>

      {tournament?.status === 'waiting' && (
        <>
          {!players.find(p => p.user_id === userId) && (
            <button onClick={joinTournament} className="bg-blue-600 text-white p-2 rounded mt-2">Присоединиться</button>
          )}
          {isCreator && players.length >= 2 && (
            <button onClick={startTournament} className="bg-green-600 text-white p-2 rounded mt-2 ml-2">Начать турнир</button>
          )}
        </>
      )}

      {tournament?.status === 'active' && (
        <div className="mt-4">
          <h2 className="text-xl">Ваши партии:</h2>
          {myGames.map((g: any) => (
            <button key={g.id} onClick={() => joinGame(g.room_id)} className="bg-purple-600 text-white p-2 rounded mt-2 block">
              Игра против {g.player1_id === userId ? 'соперника' : 'соперника'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}