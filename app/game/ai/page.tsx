'use client';

import { useState, useEffect, useRef } from 'react';
import ChessboardComponent from '@/components/Chessboard';
import { Chess } from 'chess.js';
import { supabase } from '@/lib/supabase';
import { saveGame } from '@/lib/db';

declare global {
  interface Window {
    Stockfish: any;
  }
}

export default function AIGame() {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [isAIPlaying, setIsAIPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState(10);
  const [difficultyOpen, setDifficultyOpen] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [coachAdvice, setCoachAdvice] = useState('');
  const [showCoachModal, setShowCoachModal] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const gameRef = useRef(game);
  const pendingAIMoveRef = useRef(false);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const worker = new Worker('/stockfish.js');
    worker.postMessage('uci');
    worker.onmessage = (e) => {
      const message = e.data;
      if (typeof message === 'string') {
        if (message === 'uciok') {
          worker.postMessage('isready');
        } else if (message === 'readyok') {
          setAiReady(true);
        } else if (message.startsWith('bestmove')) {
          const bestMove = message.split(' ')[1];
          if (bestMove && pendingAIMoveRef.current) {
            pendingAIMoveRef.current = false;
            makeMove(bestMove);
          }
        }
      }
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  useEffect(() => {
    if (!workerRef.current || !aiReady) return;
    const skillLevel = Math.min(20, Math.max(0, difficulty));
    workerRef.current.postMessage(`setoption name Skill Level value ${skillLevel}`);
    workerRef.current.postMessage('isready');
  }, [difficulty, aiReady]);

  const makeMove = (moveStr: string) => {
    if (!moveStr || gameOver) return;
    const currentGame = gameRef.current;
    try {
      const from = moveStr.substring(0, 2);
      const to = moveStr.substring(2, 4);
      const promotion = moveStr.length === 5 ? moveStr[4] : 'q';
      const move = currentGame.move({ from, to, promotion });
      if (move) {
        setGame(currentGame);
        setFen(currentGame.fen());
        setIsAIPlaying(false);
        if (currentGame.isGameOver()) handleGameOver(currentGame);
      } else {
        setIsAIPlaying(false);
      }
    } catch (e) {
      console.error(e);
      setIsAIPlaying(false);
    }
  };

  const handleGameOver = async (currentGame: Chess) => {
    setGameOver(true);
    let resultText = '';
    let resultCode = '1/2-1/2';
    if (currentGame.isCheckmate()) {
      const winner = currentGame.turn() === 'w' ? 'Чёрные' : 'Белые';
      resultText = `Мат! Победили ${winner}`;
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
  };

  const requestAIMove = () => {
    if (!workerRef.current || !aiReady || gameOver) return;
    const currentGame = gameRef.current;
    if (currentGame.turn() !== 'b') return;
    if (currentGame.isGameOver()) return;
    setIsAIPlaying(true);
    pendingAIMoveRef.current = true;
    workerRef.current.postMessage(`position fen ${currentGame.fen()}`);
    workerRef.current.postMessage('go depth 12');
  };

  useEffect(() => {
    if (!gameOver && !isAIPlaying && game.turn() === 'b' && aiReady) {
      const timer = setTimeout(() => requestAIMove(), 100);
      return () => clearTimeout(timer);
    }
  }, [game, gameOver, isAIPlaying, aiReady]);

  const onPieceDrop = (source: string, target: string) => {
    if (gameOver) return false;
    if (isAIPlaying) return false;
    if (game.turn() !== 'w') return false;

    const gameCopy = new Chess(game.fen());
    try {
      const move = gameCopy.move({ from: source, to: target, promotion: 'q' });
      if (move) {
        const currentGame = gameRef.current;
        currentGame.move({ from: source, to: target, promotion: 'q' });
        setGame(currentGame);
        setFen(currentGame.fen());
        if (currentGame.isGameOver()) {
          handleGameOver(currentGame);
        } else {
          setTimeout(() => requestAIMove(), 50);
        }
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
    pendingAIMoveRef.current = false;
    if (workerRef.current && aiReady) {
      workerRef.current.postMessage('stop');
      workerRef.current.postMessage('isready');
    }
  };

  const handleAnalyze = async () => {
    if (!gameOver) return;
    setAnalyzing(true);
    try {
      const pgn = game.pgn(); // полный PGN
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

  const getDifficultyLabel = (level: number) => {
    if (level <= 3) return 'Новичок 🍼';
    if (level <= 6) return 'Любитель 🎯';
    if (level <= 10) return 'Средний ⚔️';
    if (level <= 15) return 'Сильный 🔥';
    return 'Эксперт 🏆';
  };

  const isGameActive = game.history().length > 0 && !gameOver;

  if (!aiReady) {
    return <div className="flex items-center justify-center min-h-screen">Загрузка шахматного движка...</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-[600px]">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
          <div className="mb-4">
            <button onClick={() => setDifficultyOpen(!difficultyOpen)} className="w-full bg-gray-200 dark:bg-gray-700 rounded-lg p-2 flex justify-between items-center">
              <span className="font-semibold">🤖 Сложность ИИ:</span>
              <span className="text-blue-600 dark:text-blue-400">{getDifficultyLabel(difficulty)} ({difficulty}/20)</span>
              <span>{difficultyOpen ? '▲' : '▼'}</span>
            </button>
            {difficultyOpen && (
              <div className="mt-3 space-y-3">
                <input type="range" min="1" max="20" value={difficulty} onChange={(e) => setDifficulty(parseInt(e.target.value))} className="w-full" disabled={isGameActive} />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>1 (Слабый)</span><span>5</span><span>10 (Средний)</span><span>15</span><span>20 (Максимум)</span>
                </div>
              </div>
            )}
          </div>

          <div className="text-center text-xl mb-2">
            {gameOver ? <span className="text-red-600">{result}</span> : <span>{isAIPlaying ? '🤖 ИИ думает...' : game.turn() === 'w' ? '🧑 Ваш ход (белые)' : '🤖 Ход ИИ (чёрные)'}</span>}
          </div>

          <ChessboardComponent position={fen} onPieceDrop={onPieceDrop} arePiecesDraggable={!isAIPlaying && !gameOver && game.turn() === 'w'} />

          <div className="mt-4 space-y-2">
            <button onClick={resetGame} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Новая игра</button>
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