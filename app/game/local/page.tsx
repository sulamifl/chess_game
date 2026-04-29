'use client';

import { useState, useEffect } from 'react';
import ChessboardComponent from '@/components/Chessboard';
import { Chess } from 'chess.js';
import { supabase } from '@/lib/supabase';
import { saveGame } from '@/lib/db';

export default function LocalGame() {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [coachAdvice, setCoachAdvice] = useState('');
  const [showCoachModal, setShowCoachModal] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
  }, []);

  const checkGameOver = async (currentGame: Chess) => {
    if (currentGame.isGameOver()) {
      setGameOver(true);
      let resultText = '';
      let resultCode = '1/2-1/2';
      if (currentGame.isCheckmate()) {
        const loser = currentGame.turn() === 'w' ? 'Белые' : 'Чёрные';
        resultText = `Мат! Победили ${loser === 'Белые' ? 'Чёрные' : 'Белые'}`;
        resultCode = currentGame.turn() === 'w' ? '0-1' : '1-0';
      } else if (currentGame.isStalemate()) {
        resultText = 'Пат! Ничья';
      } else {
        resultText = 'Игра окончена';
      }
      setResult(resultText);

      if (currentUserId) {
        const pgn = currentGame.pgn();
        await saveGame(currentUserId, pgn, resultCode);
      }
      return true;
    }
    return false;
  };

  const onPieceDrop = (source: string, target: string) => {
    if (gameOver) return false;
    const gameCopy = new Chess(game.fen());
    try {
      const move = gameCopy.move({ from: source, to: target, promotion: 'q' });
      if (move) {
        game.move({ from: source, to: target, promotion: 'q' });
        setGame(game);
        setFen(game.fen());
        checkGameOver(game);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const resetGame = () => {
    const newGame = new Chess();
    setGame(newGame);
    setFen(newGame.fen());
    setGameOver(false);
    setResult('');
  };

  const handleAnalyze = async () => {
    if (!gameOver) return;
    setAnalyzing(true);
    try {
      const pgn = game.pgn();
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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-[600px]">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
          <div className="text-center text-xl font-semibold mb-2">
            {gameOver ? <span className="text-red-600">{result}</span> : <span>Ход: {game.turn() === 'w' ? '⚪ Белые' : '⚫ Чёрные'}</span>}
          </div>
          <ChessboardComponent position={fen} onPieceDrop={onPieceDrop} arePiecesDraggable={!gameOver} />
          <div className="mt-4 space-y-2">
            {gameOver && (
              <button onClick={resetGame} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Новая игра</button>
            )}
            {gameOver && (
              <button onClick={handleAnalyze} disabled={analyzing} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
                {analyzing ? 'Анализ...' : '🧠 AI Coach (анализ партии)'}
              </button>
            )}
          </div>
        </div>
      </div>

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