'use client';

import { useState, useEffect } from 'react';
import ChessboardComponent from '@/components/Chessboard';
import { Chess } from 'chess.js';
import { supabase } from '@/lib/supabase';
import { saveGame } from '@/lib/db';
import { deductTokens, getTokens } from '@/lib/tokens';

export default function LocalGame() {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [coachAdvice, setCoachAdvice] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
  }, []);

  useEffect(() => {
    const saveIfOver = async () => {
      if (gameOver && currentUserId) {
        const pgn = game.pgn();
        let resultCode = '1/2-1/2';
        if (game.isCheckmate()) {
          resultCode = game.turn() === 'w' ? '0-1' : '1-0';
        } else if (game.isStalemate()) resultCode = '1/2-1/2';
        await saveGame(currentUserId, pgn, resultCode);
      }
    };
    saveIfOver();
  }, [gameOver, game, currentUserId]);

  const checkGameOver = (currentGame: Chess) => {
    if (currentGame.isGameOver()) {
      setGameOver(true);
      if (currentGame.isCheckmate()) {
        const loser = currentGame.turn() === 'w' ? 'Белые' : 'Чёрные';
        setResult(`Мат! Победили ${loser === 'Белые' ? 'Чёрные' : 'Белые'}`);
      } else if (currentGame.isStalemate()) setResult('Пат! Ничья');
      else setResult('Игра окончена');
      return true;
    }
    return false;
  };

  const onPieceDrop = (source: string, target: string) => {
    if (gameOver) return false;
    const gameCopy = new Chess(game.fen());
    try {
      const move = gameCopy.move({
        from: source,
        to: target,
        promotion: 'q',
      });
      if (move) {
        setGame(gameCopy);
        setFen(gameCopy.fen());
        checkGameOver(gameCopy);
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
    setShowModal(false);
  };

  const handleAnalyze = async () => {
    if (!gameOver) return;
    if (!currentUserId) {
      setCoachAdvice('Войдите в аккаунт, чтобы использовать AI Coach.');
      setShowModal(true);
      return;
    }
    const tokens = await getTokens(currentUserId);
    if (tokens < 1) {
      setCoachAdvice('Недостаточно токенов. Сыграйте партию против ИИ и выиграйте, чтобы получить токены.');
      setShowModal(true);
      return;
    }
    const deducted = await deductTokens(currentUserId, 1);
    if (!deducted) {
      setCoachAdvice('Ошибка списания токенов.');
      setShowModal(true);
      return;
    }
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
      console.error(err);
      setCoachAdvice('Ошибка при анализе партии.');
    }
    setAnalyzing(false);
    setShowModal(true);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-[600px]">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 mb-4">
          <div className="text-center text-xl font-semibold mb-2">
            {gameOver ? (
              <span className="text-red-600">{result}</span>
            ) : (
              <span>Ход: {game.turn() === 'w' ? '⚪ Белые' : '⚫ Чёрные'}</span>
            )}
          </div>
          <ChessboardComponent
            position={fen}
            onPieceDrop={onPieceDrop}
            arePiecesDraggable={!gameOver}
          />
          <div className="mt-4 space-y-2">
            {gameOver && (
              <>
                <button
                  onClick={resetGame}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Новая игра
                </button>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                >
                  {analyzing ? 'Анализ партии...' : '🧠 AI Coach (1 токен)'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-2">Советы AI-коуча</h3>
            <div className="whitespace-pre-wrap mb-4">{coachAdvice}</div>
            <button
              onClick={() => setShowModal(false)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}