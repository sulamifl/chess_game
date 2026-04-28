'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ChessboardComponent from '@/components/Chessboard';
import { Chess } from 'chess.js';
import { updateRatings, saveGame } from '@/lib/db';

export default function MultiplayerPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomId = searchParams.get('room');
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [opponentJoined, setOpponentJoined] = useState(false);
  const [myColor, setMyColor] = useState<'w' | 'b' | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [drawOfferSent, setDrawOfferSent] = useState(false);
  const [drawOfferReceived, setDrawOfferReceived] = useState(false);
  const [roomData, setRoomData] = useState<any>(null);
  const channelRef = useRef<any>(null);
  const gameRef = useRef(game);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  // Получаем текущего пользователя
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  // Функция окончания игры
  const handleGameOver = async (resultCode: string, winnerIs?: 'w' | 'b') => {
    if (gameOver) return;
    setGameOver(true);
    
    let msg = '';
    if (resultCode === '1-0') msg = 'Победили белые!';
    else if (resultCode === '0-1') msg = 'Победили чёрные!';
    else msg = 'Ничья!';
    setResultMessage(msg);

    if (!roomData) return;
    const { player1_id, player2_id } = roomData;
    const pgn = gameRef.current.pgn();

    if (resultCode !== '1/2-1/2') {
      const winnerId = resultCode === '1-0' ? player1_id : player2_id;
      const loserId = resultCode === '1-0' ? player2_id : player1_id;
      await updateRatings(winnerId, loserId, false);
    } else {
      await updateRatings(player1_id, player2_id, true);
    }

    await saveGame(player1_id, pgn, resultCode);
    await saveGame(player2_id, pgn, resultCode);
    await supabase.from('game_rooms').update({ status: 'finished' }).eq('id', roomId);
    
    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_over',
      payload: { result: resultCode },
    });
  };

  // Предложение ничьи
  const offerDraw = async () => {
    if (gameOver || drawOfferSent) return;
    setDrawOfferSent(true);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'draw_offer',
      payload: { from: userId },
    });
  };

  const acceptDraw = async () => {
    await handleGameOver('1/2-1/2');
  };

  const declineDraw = () => {
    setDrawOfferReceived(false);
  };

  // Инициализация комнаты и подписки
  useEffect(() => {
    if (!roomId || !userId) return;

    const initRoom = async () => {
      let { data: room, error } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('id', roomId)
        .single();
      if (error || !room) return;

      const isPlayer1 = room.player1_id === userId;
      const isPlayer2 = room.player2_id === userId;

      if (!isPlayer1 && !isPlayer2 && room.status === 'waiting' && !room.player2_id) {
        await supabase
          .from('game_rooms')
          .update({ player2_id: userId, status: 'playing' })
          .eq('id', roomId);
        room = { ...room, player2_id: userId, status: 'playing' };
        setOpponentJoined(true);
        setMyColor('b');
      } else if (isPlayer1) {
        setMyColor('w');
        if (room.player2_id) setOpponentJoined(true);
      } else if (isPlayer2) {
        setMyColor('b');
        setOpponentJoined(true);
      }

      setRoomData({ player1_id: room.player1_id, player2_id: room.player2_id });
      if (room.fen && room.fen !== 'start') {
        try {
          const newGame = new Chess();
          newGame.load(room.fen);
          setGame(newGame);
          setFen(room.fen);
        } catch (e) {}
      }
      const currentTurn = room.current_turn || 'w';
      setIsMyTurn((myColor === 'w' && currentTurn === 'w') || (myColor === 'b' && currentTurn === 'b'));
    };

    initRoom();

    // Принудительная проверка каждые 3 секунды (чтобы первый игрок увидел подключение)
    const checkInterval = setInterval(async () => {
      if (opponentJoined) return;
      const { data: room } = await supabase
        .from('game_rooms')
        .select('player2_id, status')
        .eq('id', roomId)
        .single();
      if (room?.player2_id && !opponentJoined) {
        setOpponentJoined(true);
        // Обновляем доску
        const { data: fullRoom } = await supabase.from('game_rooms').select('*').eq('id', roomId).single();
        if (fullRoom?.fen && fullRoom.fen !== 'start') {
          const newGame = new Chess();
          newGame.load(fullRoom.fen);
          setGame(newGame);
          setFen(fullRoom.fen);
        }
        clearInterval(checkInterval);
      }
    }, 1000);

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
            if (gameCopy.isGameOver()) {
              let resultCode = '1/2-1/2';
              if (gameCopy.isCheckmate()) resultCode = gameCopy.turn() === 'w' ? '0-1' : '1-0';
              handleGameOver(resultCode);
            }
          }
        } catch (e) {}
      })
      .on('broadcast', { event: 'draw_offer' }, ({ payload }) => {
        if (payload.from !== userId && !gameOver) {
          setDrawOfferReceived(true);
        }
      })
      .on('broadcast', { event: 'game_over' }, ({ payload }) => {
        setGameOver(true);
        setResultMessage(payload.result === '1-0' ? 'Победили белые!' : payload.result === '0-1' ? 'Победили чёрные!' : 'Ничья!');
      })
      .on('postgres_changes', {
        schema: 'public',
        table: 'game_rooms',
        event: 'UPDATE',
        filter: `id=eq.${roomId}`,
      }, (payload) => {
        const updated = payload.new;
        if (updated.player2_id && !opponentJoined) setOpponentJoined(true);
        if (updated.fen && updated.fen !== gameRef.current.fen() && !gameOver) {
          try {
            const newGame = new Chess();
            newGame.load(updated.fen);
            setGame(newGame);
            setFen(updated.fen);
          } catch (e) {}
        }
        if (updated.current_turn && myColor) {
          setIsMyTurn((myColor === 'w' && updated.current_turn === 'w') || (myColor === 'b' && updated.current_turn === 'b'));
        }
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      clearInterval(checkInterval);
      channel.unsubscribe();
    };
  }, [roomId, userId, opponentJoined, myColor, gameOver]);

  const onPieceDrop = (source: string, target: string) => {
    if (!isMyTurn || gameOver) return false;
    const gameCopy = new Chess(game.fen());
    try {
      const move = gameCopy.move({ from: source, to: target, promotion: 'q' });
      if (move) {
        setGame(gameCopy);
        setFen(gameCopy.fen());
        setIsMyTurn(false);
        channelRef.current?.send({
          type: 'broadcast',
          event: 'move',
          payload: { from: source, to: target },
        });
        supabase.from('game_rooms').update({
          fen: gameCopy.fen(),
          current_turn: gameCopy.turn(),
        }).eq('id', roomId);
        if (gameCopy.isGameOver()) {
          let resultCode = '1/2-1/2';
          if (gameCopy.isCheckmate()) resultCode = gameCopy.turn() === 'w' ? '0-1' : '1-0';
          handleGameOver(resultCode);
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const createRoom = async () => {
    if (!userId) return;
    const res = await fetch('/api/create-room', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
    const { roomId: newRoomId } = await res.json();
    const link = `${window.location.origin}/game/multiplayer?room=${newRoomId}`;
    navigator.clipboard.writeText(link);
    alert('Ссылка скопирована!');
    window.location.href = `/game/multiplayer?room=${newRoomId}`;
  };

  if (!roomId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl mb-4">Мультиплеер</h1>
        <button onClick={createRoom} className="bg-blue-600 text-white px-6 py-3 rounded">Создать комнату</button>
      </div>
    );
  }

  if (!opponentJoined && userId) {
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
          <div className="text-center mb-2 text-xl font-semibold">
            {gameOver ? <span className="text-red-600">{resultMessage}</span> : <span>{isMyTurn ? 'Ваш ход' : 'Ход противника'}</span>}
          </div>
          <div className="text-center mb-2 text-sm text-gray-500">Вы играете {myColor === 'w' ? '⚪ белыми' : '⚫ чёрными'}</div>
          <ChessboardComponent position={fen} onPieceDrop={onPieceDrop} arePiecesDraggable={isMyTurn && !gameOver} />
          <div className="flex gap-2 mt-4">
            {!gameOver && (
              <button onClick={offerDraw} disabled={drawOfferSent} className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded">
                {drawOfferSent ? 'Предложение отправлено' : '🤝 Предложить ничью'}
              </button>
            )}
            {gameOver && (
              <button onClick={() => router.push('/')} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded">
                На главную
              </button>
            )}
          </div>
        </div>
      </div>

      {drawOfferReceived && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold mb-4">Предложение ничьей</h3>
            <p>Соперник предлагает ничью. Принимаете?</p>
            <div className="flex gap-3 mt-4">
              <button onClick={acceptDraw} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded">Принять</button>
              <button onClick={declineDraw} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded">Отклонить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}