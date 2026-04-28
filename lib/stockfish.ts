import { Chess } from 'chess.js';

export class StockfishPlayer {
  private worker: Worker | null = null;
  private onBestMoveCallback: ((move: string) => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.worker = new Worker('/stockfish.js');
      this.worker.postMessage('uci');
      this.worker.onmessage = (e) => {
        const data = e.data;
        if (typeof data === 'string' && data.startsWith('bestmove') && this.onBestMoveCallback) {
          const move = data.split(' ')[1];
          this.onBestMoveCallback(move);
          this.onBestMoveCallback = null;
        }
      };
      this.worker.postMessage('isready');
    }
  }

  async getBestMove(fen: string, depth: number = 12): Promise<string> {
    if (!this.worker) return '';
    return new Promise((resolve) => {
      this.onBestMoveCallback = (move) => resolve(move);
      this.worker!.postMessage(`position fen ${fen}`);
      this.worker!.postMessage(`go depth ${depth}`);
    });
  }

  stop() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

// Создаём worker для анализа (отдельный экземпляр)
async function createAnalysisWorker(): Promise<Worker> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('/stockfish.js');
    worker.onmessage = (e) => {
      if (e.data === 'uciok') {
        resolve(worker);
      }
    };
    worker.onerror = (err) => reject(err);
    worker.postMessage('uci');
  });
}

async function getBestMoveFromWorker(worker: Worker, fen: string, depth: number = 12): Promise<string> {
  return new Promise((resolve) => {
    const handler = (e: MessageEvent) => {
      if (typeof e.data === 'string' && e.data.startsWith('bestmove')) {
        const move = e.data.split(' ')[1];
        worker.removeEventListener('message', handler);
        resolve(move);
      }
    };
    worker.addEventListener('message', handler);
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage(`go depth ${depth}`);
  });
}

export async function analyzeGameWithStockfish(
  pgn: string,
  userColor: 'w' | 'b',
  onProgress?: (current: number, total: number) => void
): Promise<Array<{ moveNumber: number; userMove: string; bestMove: string; fen: string }>> {
  // Загружаем партию
  const game = new Chess();
  game.loadPgn(pgn);
  const history = game.history({ verbose: true });
  const totalMoves = history.length;
  const errors: Array<{ moveNumber: number; userMove: string; bestMove: string; fen: string }> = [];

  // Создаём worker для анализа
  let worker: Worker;
  try {
    worker = await createAnalysisWorker();
  } catch (err) {
    console.error('Не удалось инициализировать Stockfish для анализа:', err);
    return errors; // возвращаем пустой массив, чтобы не ломать UI
  }

  // Воспроизводим партию и сравниваем ходы
  const replay = new Chess();
  for (let i = 0; i < totalMoves; i++) {
    const moveObj = history[i];
    const isUserMove = (userColor === 'w' && i % 2 === 0) || (userColor === 'b' && i % 2 === 1);
    if (isUserMove) {
      const beforeFen = replay.fen();
      const bestMove = await getBestMoveFromWorker(worker, beforeFen, 12);
      const userMoveStr = moveObj.from + moveObj.to;
      if (bestMove && bestMove !== userMoveStr) {
        errors.push({
          moveNumber: Math.floor(i / 2) + 1,
          userMove: userMoveStr,
          bestMove,
          fen: beforeFen,
        });
      }
    }
    // Применяем ход
    replay.move({ from: moveObj.from, to: moveObj.to, promotion: 'q' });
    if (onProgress) onProgress(i + 1, totalMoves);
  }
  worker.terminate();
  return errors;
}