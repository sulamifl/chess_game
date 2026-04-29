'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function CreateTournament() {
  const [name, setName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [timeControl, setTimeControl] = useState('rapid');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const createTournament = async () => {
    if (!name) {
      alert('Введите название турнира');
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Войдите в аккаунт');
      return;
    }

    const { data, error } = await supabase
      .from('tournaments')
      .insert({
        name,
        created_by: user.id,
        max_players: maxPlayers,
        time_control: timeControl,
        status: 'waiting',
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      alert('Ошибка создания турнира');
    } else {
      router.push(`/tournament/${data.id}`);
    }
    setLoading(false);
  };

  return (
    <div className="container mx-auto p-4 max-w-md">
      <h1 className="text-2xl font-bold mb-6">Создать турнир</h1>
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Название турнира"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border p-2 rounded"
        />
        <select
          value={maxPlayers}
          onChange={(e) => setMaxPlayers(Number(e.target.value))}
          className="w-full border p-2 rounded"
        >
          <option value={4}>4 игрока</option>
          <option value={6}>6 игроков</option>
          <option value={8}>8 игроков</option>
        </select>
        <select
          value={timeControl}
          onChange={(e) => setTimeControl(e.target.value)}
          className="w-full border p-2 rounded"
        >
          <option value="blitz">Блиц (3+0)</option>
          <option value="rapid">Быстрые (10+0)</option>
          <option value="classic">Классика (30+0)</option>
        </select>
        <button
          onClick={createTournament}
          disabled={loading}
          className="w-full bg-green-600 text-white py-2 rounded"
        >
          {loading ? 'Создание...' : 'Создать турнир'}
        </button>
      </div>
    </div>
  );
}