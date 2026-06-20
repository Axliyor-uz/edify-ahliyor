export type Player = 'red' | 'black';
export type Piece = { id: string; player: Player; isKing: boolean };
export type BoardState = (Piece | null)[][];
export type Position = { r: number; c: number };
export type Move = Position & { capture?: Position };

const INITIAL_ROWS = 8;
const INITIAL_COLS = 8;

const transpositionTable = new Map<string, { depth: number, score: number }>();

// 🟢 NEW: Advanced Evaluation Framework based on Difficulty Level
export const evaluateBoard = (board: BoardState, level: number): number => {
  if (!board || board.length === 0) return 0;
  let score = 0;

  for (let r = 0; r < INITIAL_ROWS; r++) {
    for (let c = 0; c < INITIAL_COLS; c++) {
      const p = board[r][c];
      if (!p) continue;

      // 1. MATERIAL (All Levels)
      let val = p.isKing ? 210 : 100; // King = 2.1 Men

      // 2. ADVANCEMENT (Level 2+)
      if (level >= 2 && !p.isKing) {
        // Red moves UP the board (r goes from 7 to 0), Black moves DOWN (r goes from 0 to 7)
        const rowsAdvanced = p.player === 'black' ? r : (7 - r);
        val += rowsAdvanced * 15;
      }

      // 3. POSITIONAL UNDERSTANDING (Level 3+)
      if (level >= 3) {
        // Centre Control (Squares in rows 3-4, cols 2-5)
        if (c >= 2 && c <= 5 && r >= 3 && r <= 4) val += 8;

        // Back-Row Shield (Defensive stability)
        if (r === 0 && p.player === 'red') val += 20;
        if (r === 7 && p.player === 'black') val += 20;

        // Bridge/Formation (Adjacent men on diagonal)
        if (!p.isKing) {
           const dr = p.player === 'black' ? -1 : 1;
           if (r+dr >= 0 && r+dr < INITIAL_ROWS) {
               if (c-1 >= 0 && board[r+dr][c-1]?.player === p.player) val += 5;
               if (c+1 < INITIAL_COLS && board[r+dr][c+1]?.player === p.player) val += 5;
           }
        }
      }

      // 4. EXPERT NUANCES (Level 4+)
      if (level >= 4 && p.isKing) {
         // Exposed King Penalty (Sitting on edge doing nothing)
         if (c === 0 || c === 7 || r === 0 || r === 7) val -= 30;
      }

      score += p.player === 'black' ? val : -val;
    }
  }
  return score;
};

const hashBoard = (board: BoardState, isMaximizing: boolean) => {
  let s = isMaximizing ? '1' : '0';
  for (let r = 0; r < INITIAL_ROWS; r++) {
    for (let c = 0; c < INITIAL_COLS; c++) {
      const p = board[r][c];
      s += p ? (p.player === 'red' ? 'r' : 'b') + (p.isKing ? 'k' : 'p') : '.';
    }
  }
  return s;
};

export const getSimulatedMoves = (board: BoardState, player: Player): { start: Position; move: Move }[] => {
  let allMoves: { start: Position; move: Move }[] = [];
  if (!board || board.length === 0) return allMoves;

  for (let r = 0; r < INITIAL_ROWS; r++) {
    for (let c = 0; c < INITIAL_COLS; c++) {
      const piece = board[r][c];
      if (!piece || piece.player !== player) continue;

      if (piece.isKing) {
        const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        dirs.forEach(([dr, dc]) => {
          let foundOpponent: Position | null = null;
          let step = 1;
          while (true) {
            const nr = r + step * dr; const nc = c + step * dc;
            if (nr < 0 || nr >= INITIAL_ROWS || nc < 0 || nc >= INITIAL_COLS) break;
            const target = board[nr][nc];
            if (!foundOpponent) {
              if (target === null) allMoves.push({ start: { r, c }, move: { r: nr, c: nc } });
              else if (target.player !== player) foundOpponent = { r: nr, c: nc };
              else break;
            } else {
              if (target === null) allMoves.push({ start: { r, c }, move: { r: nr, c: nc, capture: foundOpponent } });
              else break;
            }
            step++;
          }
        });
      } else {
        const moveDirs = player === 'red' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
        moveDirs.forEach(([dr, dc]) => {
          const nr = r + dr; const nc = c + dc;
          if (nr >= 0 && nr < INITIAL_ROWS && nc >= 0 && nc < INITIAL_COLS && board[nr][nc] === null) {
            allMoves.push({ start: { r, c }, move: { r: nr, c: nc } });
          }
        });
        const jumpDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        jumpDirs.forEach(([dr, dc]) => {
          const jr = r + dr; const jc = c + dc;
          const jnr = r + 2 * dr; const jnc = c + 2 * dc;
          if (jnr >= 0 && jnr < INITIAL_ROWS && jnc >= 0 && jnc < INITIAL_COLS) {
            const jumped = board[jr][jc];
            if (jumped && jumped.player !== player && board[jnr][jnc] === null) {
              allMoves.push({ start: { r, c }, move: { r: jnr, c: jnc, capture: { r: jr, c: jc } } });
            }
          }
        });
      }
    }
  }

  const hasJumps = allMoves.some(m => m.move.capture);
  const finalMoves = hasJumps ? allMoves.filter(m => m.move.capture) : allMoves;
  return finalMoves.sort((a, b) => (b.move.capture ? 1 : 0) - (a.move.capture ? 1 : 0));
};

export const simulateMove = (board: BoardState, start: Position, move: Move): BoardState => {
  const newBoard = board.map(row => [...row]);
  const p = newBoard[start.r][start.c]!;
  newBoard[start.r][start.c] = null;
  newBoard[move.r][move.c] = { ...p };
  if (move.capture) newBoard[move.capture.r][move.capture.c] = null;
  if ((p.player === 'red' && move.r === 0) || (p.player === 'black' && move.r === INITIAL_ROWS - 1)) {
    newBoard[move.r][move.c]!.isKing = true;
  }
  return newBoard;
};

// 🟢 NEW: Passes 'level' down through the recursive tree
export const minimax = (board: BoardState, depth: number, alpha: number, beta: number, isMaximizing: boolean, level: number): number => {
  const hash = hashBoard(board, isMaximizing);
  if (transpositionTable.has(hash)) {
    const cached = transpositionTable.get(hash)!;
    if (cached.depth >= depth) return cached.score;
  }

  if (depth === 0) {
    const score = evaluateBoard(board, level);
    transpositionTable.set(hash, { depth, score });
    return score;
  }

  const moves = getSimulatedMoves(board, isMaximizing ? 'black' : 'red');
  if (moves.length === 0) return isMaximizing ? -99999 : 99999;

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const m of moves) {
      const evalScore = minimax(simulateMove(board, m.start, m.move), depth - 1, alpha, beta, false, level);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    transpositionTable.set(hash, { depth, score: maxEval });
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const m of moves) {
      const evalScore = minimax(simulateMove(board, m.start, m.move), depth - 1, alpha, beta, true, level);
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    transpositionTable.set(hash, { depth, score: minEval });
    return minEval;
  }
};

export const clearAI_Memory = () => {
  transpositionTable.clear();
};