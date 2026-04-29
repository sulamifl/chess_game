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

  setSkillLevel(level: number) {
    if (!this.worker) return;
    const skillLevel = Math.min(20, Math.max(0, level));
    this.worker.postMessage(`setoption name Skill Level value ${skillLevel}`);
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

export async function analyzeGameWithStockfish(
  pgn: string,
  userColor: 'w' | 'b',
  onProgress?: (current: number, total: number) => void
): Promise<Array<{ moveNumber: number; userMove: string; bestMove: string; fen: string }>> {
  const { Chess } = await import('chess.js');
  const game = new Chess();
  game.loadPgn(pgn);
  const history = game.history({ verbose: true });
  const totalMoves = history.length;
  const errors: Array<{ moveNumber: number; userMove: string; bestMove: string; fen: string }> = [];

  const worker = new Worker('/stockfish.js');
  await new Promise<void>((resolve) => {
    const handler = (e: MessageEvent) => {
      if (e.data === 'uciok') {
        worker.removeEventListener('message', handler);
        resolve();
      }
    };
    worker.addEventListener('message', handler);
    worker.postMessage('uci');
  });

  function getBestMoveFromWorker(fen: string, depth: number): Promise<string> {
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

  const tempGame = new Chess();
  for (let i = 0; i < totalMoves; i++) {
    const moveObj = history[i];
    const isUserMove = (userColor === 'w' && i % 2 === 0) || (userColor === 'b' && i % 2 === 1);
    if (isUserMove) {
      const bestMove = await getBestMoveFromWorker(tempGame.fen(), 12);
      const userMoveStr = moveObj.from + moveObj.to;
      if (bestMove !== userMoveStr) {
        errors.push({
          moveNumber: Math.floor(i / 2) + 1,
          userMove: userMoveStr,
          bestMove,
          fen: tempGame.fen(),
        });
      }
    }
    tempGame.move({ from: moveObj.from, to: moveObj.to, promotion: 'q' });
    if (onProgress) onProgress(i + 1, totalMoves);
  }
  worker.terminate();
  return errors;
}