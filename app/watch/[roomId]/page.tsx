'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ChessboardComponent from '@/components/Chessboard';
import { Chess } from 'chess.js';

export default function WatchPage() {
  const { roomId } = useParams();
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState('start');
  const [players, setPlayers] = useState({ white: 'Белые', black: 'Чёрные' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState('');

  // Загрузка информации об игре
  const fetchGameData = async () => {
    const { data: gameRoom, error: gameError } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    
    if (gameError || !gameRoom) {
      setError('Игра не найдена');
      setLoading(false);
      return;
    }

    // Загружаем имена игроков
    if (gameRoom.player1_id) {
      const { data: p1 } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', gameRoom.player1_id)
        .single();
      if (p1) setPlayers(prev => ({ ...prev, white: p1.username }));
    }
    if (gameRoom.player2_id) {
      const { data: p2 } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', gameRoom.player2_id)
        .single();
      if (p2) setPlayers(prev => ({ ...prev, black: p2.username }));
    }

    // Загружаем позицию
    if (gameRoom.fen && gameRoom.fen !== 'start' && gameRoom.fen !== fen) {
      try {
        const newGame = new Chess();
        newGame.load(gameRoom.fen);
        setGame(newGame);
        setFen(gameRoom.fen);
        setLastUpdate(new Date().toLocaleTimeString());
        console.log('Доска обновлена:', gameRoom.fen.substring(0, 30));
      } catch (e) {
        console.error('Ошибка загрузки FEN:', e);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    if (roomId) {
      fetchGameData();
    }
  }, [roomId]);

  // Обновление позиции в реальном времени (polling)
  useEffect(() => {
    if (!roomId) return;

    const interval = setInterval(fetchGameData, 2000);
    return () => clearInterval(interval);
  }, [roomId]);

  if (loading) return <div className="flex justify-center items-center min-h-screen">Загрузка игры...</div>;
  if (error) return <div className="flex justify-center items-center min-h-screen text-red-600">{error}</div>;

  return (
    <div className="flex justify-center items-center min-h-screen p-4">
      <div className="w-full max-w-[600px]">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
          <div className="flex justify-between mb-4 text-center">
            <div className="font-bold text-lg">⚪ {players.white}</div>
            <div className="text-2xl">VS</div>
            <div className="font-bold text-lg">⚫ {players.black}</div>
          </div>
          
          <ChessboardComponent position={fen} onPieceDrop={() => false} arePiecesDraggable={false} />
          
          <div className="text-center text-sm text-gray-500 mt-3">
            Прямая трансляция • Обновление каждые 2 секунды
            {lastUpdate && <span className="ml-2">• Последнее: {lastUpdate}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}