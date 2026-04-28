'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ChessboardComponent from '@/components/Chessboard';
import { Chess } from 'chess.js';
import { updateRatings, saveGame } from '@/lib/db';

export default function MultiplayerPage() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('room');
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [opponentJoined, setOpponentJoined] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const channelRef = useRef<any>(null);
  const gameRef = useRef(game);
  const roomDataRef = useRef<{ player1_id: string; player2_id: string } | null>(null);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  // 1. Получаем текущего пользователя
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  // Функция для обработки окончания игры
  const handleGameOver = async (resultCode: string) => {
    if (!roomId || !roomDataRef.current) return;
    
    const { player1_id, player2_id } = roomDataRef.current;
    const pgn = gameRef.current.pgn();
    
    // Обновляем рейтинги Эло
    if (resultCode === '1-0') {
      // Победили белые (player1)
      await updateRatings(player1_id, player2_id, false);
    } else if (resultCode === '0-1') {
      // Победили чёрные (player2)
      await updateRatings(player2_id, player1_id, false);
    } else if (resultCode === '1/2-1/2') {
      // Ничья
      await updateRatings(player1_id, player2_id, true);
    }
    
    // Сохраняем партию для обоих игроков
    await saveGame(player1_id, pgn, resultCode);
    await saveGame(player2_id, pgn, resultCode);
    
    // Обновляем статус комнаты
    await supabase.from('game_rooms').update({ status: 'finished' }).eq('id', roomId);
    
    // Отправляем сообщение о конце игры через broadcast
    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_over',
      payload: { result: resultCode },
    });
  };

  // 2. Подписка на Realtime и загрузка состояния комнаты
  useEffect(() => {
    if (!roomId || !userId) return;

    const fetchRoom = async () => {
      const { data: room, error } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('id', roomId)
        .single();
      if (error) return;
      
      // Сохраняем данные комнаты
      roomDataRef.current = { player1_id: room.player1_id, player2_id: room.player2_id };
      
      // Определяем, чей ход
      const isPlayer1 = room.player1_id === userId;
      const isPlayer2 = room.player2_id === userId;
      if (!isPlayer1 && !isPlayer2) {
        alert('Вы не участник этой комнаты');
        return;
      }
      
      if (room.status === 'waiting' && isPlayer1) {
        setOpponentJoined(false);
      } else if (room.player2_id && room.status === 'playing') {
        setOpponentJoined(true);
      }
      
      // Если игра уже завершена
      if (room.status === 'finished') {
        setGameOver(true);
        setResultMessage('Игра завершена');
        return;
      }
      
      // Устанавливаем начальную позицию
      if (room.fen && room.fen !== 'start' && room.fen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
        try {
          const newGame = new Chess();
          newGame.load(room.fen);
          setGame(newGame);
          setFen(room.fen);
        } catch (e) {}
      }
      
      const myColor = (isPlayer1 && room.current_turn === 'w') || (isPlayer2 && room.current_turn === 'b');
      setIsMyTurn(myColor);
    };
    fetchRoom();

    // Подписываемся на изменения в комнате
    const channel = supabase.channel(`room-${roomId}`);
    channel
      .on('broadcast', { event: 'move' }, ({ payload }) => {
        if (gameOver) return;
        const { from, to } = payload;
        const gameCopy = new Chess(gameRef.current.fen());
        try {
          const move = gameCopy.move({ from, to, promotion: 'q' });
          if (move) {
            setGame(gameCopy);
            setFen(gameCopy.fen());
            setIsMyTurn(true);
            supabase.from('game_rooms').update({ 
              fen: gameCopy.fen(),
              current_turn: gameCopy.turn()
            }).eq('id', roomId);
            
            // Проверяем окончание игры
            if (gameCopy.isGameOver()) {
              let resultCode = '1/2-1/2';
              if (gameCopy.isCheckmate()) {
                resultCode = gameCopy.turn() === 'w' ? '0-1' : '1-0';
              }
              setGameOver(true);
              if (gameCopy.isCheckmate()) {
                const winner = gameCopy.turn() === 'w' ? 'Чёрные' : 'Белые';
                setResultMessage(`Мат! Победили ${winner}`);
              } else if (gameCopy.isStalemate()) {
                setResultMessage('Пат! Ничья');
              } else {
                setResultMessage('Игра окончена');
              }
              handleGameOver(resultCode);
            }
          }
        } catch (e) {}
      })
      .on('broadcast', { event: 'game_over' }, ({ payload }) => {
        setGameOver(true);
        setResultMessage(payload.result === '1-0' ? 'Победили белые!' : 
                        payload.result === '0-1' ? 'Победили чёрные!' : 'Ничья!');
      })
      .on('postgres_changes', { 
        schema: 'public', 
        table: 'game_rooms', 
        event: 'UPDATE', 
        filter: `id=eq.${roomId}` 
      }, (payload) => {
        const newRoom = payload.new;
        if (newRoom.player2_id && newRoom.status === 'playing' && !opponentJoined) {
          setOpponentJoined(true);
        }
        if (newRoom.status === 'finished') {
          setGameOver(true);
          setResultMessage('Игра завершена');
        }
        if (newRoom.fen && newRoom.fen !== gameRef.current.fen() && !gameOver) {
          try {
            const newGame = new Chess();
            newGame.load(newRoom.fen);
            setGame(newGame);
            setFen(newRoom.fen);
            const isPlayer1 = newRoom.player1_id === userId;
            const isPlayer2 = newRoom.player2_id === userId;
            const myColor = (isPlayer1 && newRoom.current_turn === 'w') || (isPlayer2 && newRoom.current_turn === 'b');
            setIsMyTurn(myColor);
          } catch (e) {}
        }
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [roomId, userId, opponentJoined, gameOver]);

  // 3. Обработка хода игрока
  const onPieceDrop = (source: string, target: string) => {
    if (!isMyTurn || gameOver) return false;
    const gameCopy = new Chess(game.fen());
    try {
      const move = gameCopy.move({ from: source, to: target, promotion: 'q' });
      if (move) {
        setGame(gameCopy);
        setFen(gameCopy.fen());
        setIsMyTurn(false);
        // Отправляем ход через broadcast
        channelRef.current?.send({
          type: 'broadcast',
          event: 'move',
          payload: { from: source, to: target },
        });
        // Обновляем БД
        supabase.from('game_rooms').update({
          fen: gameCopy.fen(),
          current_turn: gameCopy.turn(),
        }).eq('id', roomId);
        
        // Проверяем окончание игры после хода
        if (gameCopy.isGameOver()) {
          let resultCode = '1/2-1/2';
          if (gameCopy.isCheckmate()) {
            resultCode = gameCopy.turn() === 'w' ? '0-1' : '1-0';
          }
          setGameOver(true);
          if (gameCopy.isCheckmate()) {
            const winner = gameCopy.turn() === 'w' ? 'Чёрные' : 'Белые';
            setResultMessage(`Мат! Победили ${winner}`);
          } else if (gameCopy.isStalemate()) {
            setResultMessage('Пат! Ничья');
          } else {
            setResultMessage('Игра окончена');
          }
          handleGameOver(resultCode);
        }
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  // 4. Создание комнаты
  const createRoom = async () => {
    if (!userId) return;
    const res = await fetch('/api/create-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const { roomId: newRoomId } = await res.json();
    const link = `${window.location.origin}/game/multiplayer?room=${newRoomId}`;
    navigator.clipboard.writeText(link);
    alert(`Ссылка скопирована: ${link}`);
    window.location.href = `/game/multiplayer?room=${newRoomId}`;
  };

  if (!roomId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl mb-4">Мультиплеер</h1>
        <button onClick={createRoom} className="bg-blue-600 text-white px-6 py-3 rounded">
          Создать комнату
        </button>
      </div>
    );
  }

  if (!opponentJoined && userId && !gameOver) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h2>Комната: {roomId}</h2>
        <p>Ожидаем подключения второго игрока...</p>
        <p>Поделитесь ссылкой с другом:</p>
        <input readOnly value={window.location.href} className="border p-2 w-full max-w-md" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-[600px]">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
          <div className="text-center mb-2 font-bold">
            {gameOver ? (
              <span className="text-red-600">{resultMessage}</span>
            ) : (
              <span>{isMyTurn ? 'Ваш ход' : 'Ход противника'}</span>
            )}
          </div>
          <ChessboardComponent
            position={fen}
            onPieceDrop={onPieceDrop}
            arePiecesDraggable={isMyTurn && !gameOver}
          />
          {gameOver && (
            <button
              onClick={() => window.location.href = '/'}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              На главную
            </button>
          )}
        </div>
      </div>
    </div>
  );
}