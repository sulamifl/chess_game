'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import ChessboardComponent from '@/components/Chessboard';
import { Chess } from 'chess.js';

interface BroadcastViewProps {
  broadcastId: string;
}

export default function BroadcastView({ broadcastId }: BroadcastViewProps) {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState('start');
  const [messages, setMessages] = useState<{user: string, text: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [broadcastInfo, setBroadcastInfo] = useState<any>(null);
  const [playersInfo, setPlayersInfo] = useState<{white: any, black: any}>({white: null, black: null});
  const [loading, setLoading] = useState(true);
  const [gameRoomId, setGameRoomId] = useState<string | null>(null);
  const chatChannelRef = useRef<any>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Загрузка информации о трансляции
  useEffect(() => {
    const fetchBroadcast = async () => {
      const { data: broadcast, error } = await supabase
        .from('broadcast_rooms')
        .select('*')
        .eq('id', broadcastId)
        .single();
      
      if (error || !broadcast) {
        console.error('Трансляция не найдена');
        setLoading(false);
        return;
      }
      
      setBroadcastInfo(broadcast);
      setViewerCount(broadcast.viewer_count || 0);
      
      if (broadcast.game_room_id) {
        setGameRoomId(broadcast.game_room_id);
      }
      setLoading(false);
    };
    
    fetchBroadcast();
  }, [broadcastId]);

  // Загрузка информации об игре и игроках по gameRoomId
  useEffect(() => {
    if (!gameRoomId) return;

    const fetchGameData = async () => {
      const { data: gameRoom } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('id', gameRoomId)
        .single();
      
      if (gameRoom) {
        if (gameRoom.fen && gameRoom.fen !== 'start') {
          try {
            const newGame = new Chess();
            newGame.load(gameRoom.fen);
            setGame(newGame);
            setFen(gameRoom.fen);
          } catch (e) {}
        }
        
        if (gameRoom.player1_id) {
          const { data: whitePlayer } = await supabase
            .from('profiles')
            .select('username, elo')
            .eq('id', gameRoom.player1_id)
            .single();
          setPlayersInfo(prev => ({ ...prev, white: whitePlayer }));
        }
        
        if (gameRoom.player2_id) {
          const { data: blackPlayer } = await supabase
            .from('profiles')
            .select('username, elo')
            .eq('id', gameRoom.player2_id)
            .single();
          setPlayersInfo(prev => ({ ...prev, black: blackPlayer }));
        }
      }
    };
    
    fetchGameData();
  }, [gameRoomId]);

  // Polling для обновления позиции
  useEffect(() => {
    if (!gameRoomId) return;

    const fetchGameState = async () => {
      const { data: gameRoom } = await supabase
        .from('game_rooms')
        .select('fen')
        .eq('id', gameRoomId)
        .single();
      
      if (gameRoom?.fen && gameRoom.fen !== fen) {
        console.log('Обновляем доску, новый FEN:', gameRoom.fen.substring(0, 30));
        try {
          const newGame = new Chess();
          newGame.load(gameRoom.fen);
          setGame(newGame);
          setFen(gameRoom.fen);
        } catch (e) {}
      }
    };

    pollingIntervalRef.current = setInterval(fetchGameState, 2000);
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [gameRoomId, fen]);

  // Счётчик зрителей
  useEffect(() => {
    if (!broadcastId) return;

    const incrementViewer = async () => {
      try {
        await supabase.rpc('increment_viewer_count', { broadcast_id: broadcastId });
      } catch (e) {}
    };
    incrementViewer();
    
    return () => {
      supabase.rpc('decrement_viewer_count', { broadcast_id: broadcastId });
    };
  }, [broadcastId]);

  // Чат
  useEffect(() => {
    if (!broadcastId) return;

    const chatChannel = supabase.channel(`broadcast-chat-${broadcastId}`);
    chatChannel.on('broadcast', { event: 'message' }, ({ payload }) => {
      setMessages(prev => [...prev.slice(-49), { user: payload.user, text: payload.text }]);
    }).subscribe();
    chatChannelRef.current = chatChannel;

    return () => {
      if (chatChannelRef.current) chatChannelRef.current.unsubscribe();
    };
  }, [broadcastId]);

  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const username = user?.email?.split('@')[0] || 'Аноним';
    await chatChannelRef.current?.send({
      type: 'broadcast',
      event: 'message',
      payload: { user: username, text: chatInput },
    });
    setChatInput('');
  };

  const forceRefresh = async () => {
    if (!gameRoomId) {
      alert('Нет ID игровой комнаты. Трансляция не связана с игрой.');
      return;
    }
    const { data: gameRoom } = await supabase
      .from('game_rooms')
      .select('fen')
      .eq('id', gameRoomId)
      .single();
    if (gameRoom?.fen && gameRoom.fen !== fen) {
      const newGame = new Chess();
      newGame.load(gameRoom.fen);
      setGame(newGame);
      setFen(gameRoom.fen);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Загрузка трансляции...</div>;
  if (!broadcastInfo) return <div className="flex items-center justify-center min-h-screen text-red-600">Трансляция не найдена</div>;

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4 min-h-screen">
      <div className="flex-1">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
          <div className="flex justify-between mb-4">
            <div className="text-center">
              <div className="font-bold text-lg">⚪ {playersInfo.white?.username || 'Белые'}</div>
              <div className="text-sm text-gray-500">ELO: {playersInfo.white?.elo || '—'}</div>
            </div>
            <div className="text-2xl font-bold">VS</div>
            <div className="text-center">
              <div className="font-bold text-lg">⚫ {playersInfo.black?.username || 'Чёрные'}</div>
              <div className="text-sm text-gray-500">ELO: {playersInfo.black?.elo || '—'}</div>
            </div>
          </div>
          
          <ChessboardComponent position={fen} onPieceDrop={() => false} arePiecesDraggable={false} />
          
          <div className="flex justify-between items-center mt-3 text-sm text-gray-500">
            <div>📺 {broadcastInfo.name}</div>
            <div>👁️ {viewerCount} зрителей</div>
          </div>
          
          <div className="mt-3 pt-3 border-t text-xs flex justify-between">
            <span>ID комнаты: {gameRoomId || '❌ не указан'}</span>
            <button onClick={forceRefresh} className="bg-blue-600 text-white px-3 py-1 rounded">
              🔄 Обновить
            </button>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-96">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 h-[600px] flex flex-col">
          <h3 className="font-bold mb-3">💬 Чат трансляции</h3>
          <div className="flex-1 overflow-y-auto space-y-2 mb-3 text-sm">
            {messages.map((msg, idx) => (
              <div key={idx} className="border-b pb-1">
                <span className="font-bold text-blue-600">{msg.user}:</span> {msg.text}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              className="flex-1 border rounded-lg p-2 text-sm"
              placeholder="Написать..."
            />
            <button onClick={sendMessage} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">
              Отправить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}