'use client';

import { useState, useEffect, useRef } from 'react';
import ChessboardComponent from '@/components/Chessboard';
import { Chess } from 'chess.js';
import { StockfishPlayer } from '@/lib/stockfish';
import { supabase } from '@/lib/supabase';
import { saveGame } from '@/lib/db';
import { addTokens, deductTokens, getTokens } from '@/lib/tokens';

export default function AIGame() {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [isAIPlaying, setIsAIPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [coachAdvice, setCoachAdvice] = useState('');
  const [showModal, setShowModal] = useState(false);
  const stockfishRef = useRef<StockfishPlayer | null>(null);
  const gameRef = useRef(game);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const userColor = 'w'; // игрок всегда белые

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
  }, []);

  useEffect(() => {
    stockfishRef.current = new StockfishPlayer();
    return () => stockfishRef.current?.stop();
  }, []);

  const checkGameOver = async (currentGame: Chess) => {
    if (currentGame.isGameOver()) {
      setGameOver(true);
      if (currentGame.isCheckmate()) {
        const winner = currentGame.turn() === 'w' ? 'Чёрные' : 'Белые';
        setResult(`Мат! Победили ${winner}`);
        // Начисляем токен победителю, если это игрок (белые)
        if (currentUserId && winner === 'Белые') {
          await addTokens(currentUserId, 1);
          // обновим отображение токенов в профиле позже при перезагрузке, но не критично
        }
      } else if (currentGame.isStalemate()) setResult('Пат! Ничья');
      else setResult('Игра окончена');
      // Сохраняем партию
      if (currentUserId) {
        const pgn = currentGame.pgn();
        let resultCode = '1/2-1/2';
        if (currentGame.isCheckmate()) {
          resultCode = currentGame.turn() === 'w' ? '0-1' : '1-0';
        } else if (currentGame.isStalemate()) resultCode = '1/2-1/2';
        await saveGame(currentUserId, pgn, resultCode);
      }
      return true;
    }
    return false;
  };

  const makeAIMove = async () => {
    if (!stockfishRef.current || gameOver) return;
    const currentGame = gameRef.current;
    if (currentGame.turn() !== 'b') return;
    if (currentGame.isGameOver()) return;

    setIsAIPlaying(true);
    const bestMove = await stockfishRef.current.getBestMove(currentGame.fen(), 12);
    if (bestMove && !currentGame.isGameOver()) {
      const move = currentGame.move(bestMove);
      if (move) {
        const newGame = new Chess(currentGame.fen());
        setGame(newGame);
        setFen(newGame.fen());
        await checkGameOver(newGame);
      }
    }
    setIsAIPlaying(false);
  };

  useEffect(() => {
    if (!gameOver && !isAIPlaying && game.turn() === 'b') {
      const timer = setTimeout(() => makeAIMove(), 100);
      return () => clearTimeout(timer);
    }
  }, [game, gameOver, isAIPlaying]);

  const onPieceDrop = (source: string, target: string) => {
    if (gameOver) return false;
    if (isAIPlaying) return false;
    if (game.turn() !== userColor) return false;

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
    setIsAIPlaying(false);
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
      setCoachAdvice('Недостаточно токенов. Выиграйте партию, чтобы получить токены, или купите Pro.');
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
          <div className="text-center text-xl mb-2">
            {gameOver ? (
              <span className="text-red-600">{result}</span>
            ) : (
              <span>
                {isAIPlaying
                  ? '🤖 ИИ думает...'
                  : game.turn() === 'w'
                  ? '🧑 Ваш ход (белые)'
                  : '🤖 Ход ИИ (чёрные)'}
              </span>
            )}
          </div>
          <ChessboardComponent
            position={fen}
            onPieceDrop={onPieceDrop}
            arePiecesDraggable={!isAIPlaying && !gameOver && game.turn() === 'w'}
          />
          <div className="mt-4 space-y-2">
            <button
              onClick={resetGame}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Новая игра
            </button>
            {gameOver && (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
              >
                {analyzing ? 'Анализ партии...' : '🧠 AI Coach (1 токен)'}
              </button>
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