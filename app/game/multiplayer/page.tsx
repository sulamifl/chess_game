'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ChessboardComponent from '@/components/Chessboard';
import { Chess } from 'chess.js';
import { updateRatings, saveGame } from '@/lib/db';
import VoiceMove from '@/components/VoiceMove';

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
  const [player1Info, setPlayer1Info] = useState<any>(null);
  const [player2Info, setPlayer2Info] = useState<any>(null);
  const [messages, setMessages] = useState<{ user: string; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [coachAdvice, setCoachAdvice] = useState('');
  const [showCoachModal, setShowCoachModal] = useState(false);
  const channelRef = useRef<any>(null);
  const chatChannelRef = useRef<any>(null);
  const gameRef = useRef(game);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id || null));
  }, []);

  const getTitleByElo = (elo: number): string => {
    if (elo >= 2500) return 'GM';
    if (elo >= 2400) return 'IM';
    if (elo >= 2300) return 'FM';
    if (elo >= 2200) return 'NM';
    if (elo >= 2000) return 'КМС';
    return '';
  };

  const handleGameOver = async (resultCode: string) => {
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
    channelRef.current?.send({ type: 'broadcast', event: 'game_over', payload: { result: resultCode } });
  };

  const offerDraw = async () => {
    if (gameOver || drawOfferSent) return;
    setDrawOfferSent(true);
    channelRef.current?.send({ type: 'broadcast', event: 'draw_offer', payload: { from: userId } });
  };

  const acceptDraw = async () => handleGameOver('1/2-1/2');
  const declineDraw = () => setDrawOfferReceived(false);

  // Инициализация комнаты
  useEffect(() => {
    if (!roomId || !userId) return;
    const initRoom = async () => {
      let { data: room, error } = await supabase.from('game_rooms').select('*').eq('id', roomId).single();
      if (error || !room) return;
      const isPlayer1 = room.player1_id === userId;
      const isPlayer2 = room.player2_id === userId;
      if (!isPlayer1 && !isPlayer2 && room.status === 'waiting' && !room.player2_id) {
        await supabase.from('game_rooms').update({ player2_id: userId, status: 'playing' }).eq('id', roomId);
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
        } catch {}
      }
      const currentTurn = room.current_turn || 'w';
      setIsMyTurn((myColor === 'w' && currentTurn === 'w') || (myColor === 'b' && currentTurn === 'b'));
      if (room.status === 'finished') {
        setGameOver(true);
        setResultMessage('Игра завершена');
      }
    };
    initRoom();

    const checkInterval = setInterval(async () => {
      if (opponentJoined) return;
      const { data: room } = await supabase.from('game_rooms').select('player2_id').eq('id', roomId).single();
      if (room?.player2_id) setOpponentJoined(true);
    }, 1000);

    const channel = supabase.channel(`room-${roomId}`);
    channel
      .on('broadcast', { event: 'move' }, ({ payload }) => {
        if (gameOver) return;
        const { from, to } = payload;
        const testGame = new Chess(gameRef.current.fen());
        try {
          const move = testGame.move({ from, to, promotion: 'q' });
          if (move) {
            gameRef.current.move({ from, to, promotion: 'q' });
            const newGame = new Chess(gameRef.current.fen());
            setGame(newGame);
            setFen(newGame.fen());
            setIsMyTurn(true);
            if (gameRef.current.isGameOver()) {
              const resCode = gameRef.current.turn() === 'w' ? '0-1' : '1-0';
              handleGameOver(resCode);
            }
          }
        } catch (e) {}
      })
      .on('broadcast', { event: 'draw_offer' }, ({ payload }) => {
        if (payload.from !== userId && !gameOver) setDrawOfferReceived(true);
      })
      .on('broadcast', { event: 'game_over' }, ({ payload }) => {
        setGameOver(true);
        setResultMessage(payload.result === '1-0' ? 'Победили белые!' : payload.result === '0-1' ? 'Победили чёрные!' : 'Ничья!');
      })
      .on('postgres_changes', { schema: 'public', table: 'game_rooms', event: 'UPDATE', filter: `id=eq.${roomId}` }, (payload) => {
        const updated = payload.new;
        if (updated.fen && updated.fen !== gameRef.current.fen() && !gameOver) {
          try {
            const newGame = new Chess();
            newGame.load(updated.fen);
            setGame(newGame);
            setFen(updated.fen);
          } catch {}
        }
        if (updated.current_turn && myColor) {
          setIsMyTurn((myColor === 'w' && updated.current_turn === 'w') || (myColor === 'b' && updated.current_turn === 'b'));
        }
        if (updated.status === 'finished') {
          setGameOver(true);
        }
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      clearInterval(checkInterval);
      channel.unsubscribe();
    };
  }, [roomId, userId, opponentJoined, myColor, gameOver]);

  // Чат
  useEffect(() => {
    if (!roomId) return;
    const chatChannel = supabase.channel(`chat-${roomId}`);
    chatChannel.on('broadcast', { event: 'message' }, ({ payload }) => {
      setMessages(prev => [...prev.slice(-49), { user: payload.user, text: payload.text }]);
    }).subscribe();
    chatChannelRef.current = chatChannel;
    return () => {
      if (chatChannelRef.current) chatChannelRef.current.unsubscribe();
    };
  }, [roomId]);

  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const username = user?.email?.split('@')[0] || 'Аноним';
    await chatChannelRef.current?.send({ type: 'broadcast', event: 'message', payload: { user: username, text: chatInput } });
    setChatInput('');
  };

  // Загрузка информации об игроках
  useEffect(() => {
    if (!roomData) return;
    const fetchPlayersInfo = async () => {
      const { data: p1 } = await supabase.from('profiles').select('username, elo, avatar_url').eq('id', roomData.player1_id).single();
      const { data: p2 } = await supabase.from('profiles').select('username, elo, avatar_url').eq('id', roomData.player2_id).single();
      setPlayer1Info(p1);
      setPlayer2Info(p2);
    };
    fetchPlayersInfo();
  }, [roomData]);

  const onPieceDrop = (source: string, target: string) => {
    if (!isMyTurn || gameOver) return false;
    const testGame = new Chess(game.fen());
    try {
      const move = testGame.move({ from: source, to: target, promotion: 'q' });
      if (move) {
        gameRef.current.move({ from: source, to: target, promotion: 'q' });
        const newGame = new Chess(gameRef.current.fen());
        setGame(newGame);
        setFen(newGame.fen());
        setIsMyTurn(false);
        channelRef.current?.send({ type: 'broadcast', event: 'move', payload: { from: source, to: target } });
        supabase.from('game_rooms').update({
          fen: gameRef.current.fen(),
          current_turn: gameRef.current.turn()
        }).eq('id', roomId);
        if (gameRef.current.isGameOver()) {
          const resultCode = gameRef.current.turn() === 'w' ? '0-1' : '1-0';
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

  const handleAnalyze = async () => {
    if (!gameOver) return;
    setAnalyzing(true);
    try {
      const pgn = gameRef.current.pgn();
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pgn }),
      });
      const data = await response.json();
      setCoachAdvice(data.advice || 'Анализ не дал результатов.');
    } catch (err) {
      setCoachAdvice('Ошибка при анализе партии.');
    }
    setAnalyzing(false);
    setShowCoachModal(true);
  };

  if (!roomId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl mb-4">Мультиплеер</h1>
        <button onClick={createRoom} className="bg-blue-600 text-white px-6 py-3 rounded">Создать комнату</button>
      </div>
    );
  }

  if (!opponentJoined && userId && !gameOver) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h2>Комната: {roomId}</h2>
        <p>Ожидаем подключения второго игрока...</p>
        <input readOnly value={window.location.href} className="border p-2 w-full max-w-md" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-[800px]">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className={`text-center p-2 rounded ${!gameOver && myColor === 'w' && isMyTurn ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-700'}`}>
              <div className="font-bold text-lg">⚪ {player1Info?.username || 'Белые'}</div>
              <div className="text-sm">ELO: {player1Info?.elo || 1200} {getTitleByElo(player1Info?.elo || 1200)}</div>
            </div>
            <div className={`text-center p-2 rounded ${!gameOver && myColor === 'b' && isMyTurn ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-700'}`}>
              <div className="font-bold text-lg">⚫ {player2Info?.username || 'Чёрные'}</div>
              <div className="text-sm">ELO: {player2Info?.elo || 1200} {getTitleByElo(player2Info?.elo || 1200)}</div>
            </div>
          </div>
          <div className="text-center mb-2 font-bold">
            {gameOver ? <span className="text-red-600">{resultMessage}</span> : <span>{isMyTurn ? '🎯 Ваш ход' : '⏳ Ход противника'}</span>}
          </div>
          <ChessboardComponent position={fen} onPieceDrop={onPieceDrop} arePiecesDraggable={isMyTurn && !gameOver} />
          <div className="mt-4">
            <div className="flex gap-2 mb-2 flex-wrap">
              <VoiceMove onMove={(from, to) => onPieceDrop(from, to)} enabled={isMyTurn && !gameOver && voiceEnabled} />
              <button onClick={() => setVoiceEnabled(!voiceEnabled)} className="px-2 py-1 bg-gray-500 text-white rounded text-sm">{voiceEnabled ? '🔊 Вкл' : '🔇 Выкл'}</button>
              {!gameOver && <button onClick={offerDraw} disabled={drawOfferSent} className="px-2 py-1 bg-yellow-600 text-white rounded text-sm">{drawOfferSent ? 'Предложение отправлено' : '🤝 Ничья'}</button>}
            </div>
            <div className="border rounded p-2 h-32 overflow-y-auto bg-gray-50 dark:bg-gray-900">
              {messages.map((msg, idx) => <div key={idx} className="text-sm"><span className="font-bold">{msg.user}:</span> {msg.text}</div>)}
            </div>
            <div className="flex gap-2 mt-2">
              <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} className="flex-1 border p-1 rounded" placeholder="Чат..." />
              <button onClick={sendMessage} className="bg-blue-600 text-white px-3 py-1 rounded">Отправить</button>
            </div>
          </div>
          {gameOver && (
            <button onClick={handleAnalyze} disabled={analyzing} className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded">
              {analyzing ? 'Анализ...' : '🧠 AI Coach (анализ ошибок)'}
            </button>
          )}
        </div>
      </div>

      {drawOfferReceived && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold mb-4">Предложение ничьей</h3>
            <p>Соперник предлагает ничью. Принимаете?</p>
            <div className="flex gap-3 mt-4">
              <button onClick={acceptDraw} className="flex-1 bg-green-600 text-white py-2 rounded">Принять</button>
              <button onClick={declineDraw} className="flex-1 bg-red-600 text-white py-2 rounded">Отклонить</button>
            </div>
          </div>
        </div>
      )}

      {showCoachModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-2">Советы AI-коуча</h3>
            <div className="whitespace-pre-wrap mb-4">{coachAdvice}</div>
            <button onClick={() => setShowCoachModal(false)} className="bg-blue-600 text-white px-4 py-2 rounded">Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
}