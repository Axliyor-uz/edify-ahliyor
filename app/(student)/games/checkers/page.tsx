'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RotateCcw, Crown, Trophy, Users, Bot, Zap, Brain, Target, ShieldAlert, Skull, Loader2, Wifi, Hash, LogOut, Flag } from 'lucide-react';
import { useStudentLanguage } from '../../layout';
import { Button, Card, Tile, Page, cn, sToast } from '@/components/student-ui';

// Firebase
import { runTransaction, doc, increment, setDoc, onSnapshot, updateDoc, deleteDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { applyUserXp, mirrorLeaderboards, notifyLevelUp, GAMES_DAILY_XP_CAP } from '@/lib/xp';
import { xpDayKey } from '@/lib/xpDays';

// AI Core Imports (Make sure CheckersAI.ts has these exported!)
import { Player, Piece, BoardState, Position, Move, simulateMove, minimax, clearAI_Memory } from './_components/CheckersAI';

const INITIAL_ROWS = 8;
const INITIAL_COLS = 8;

// Losses pay NOTHING (a lose reward made every game farmable), wins are capped
// by GAMES_DAILY_XP_CAP per UTC day (lib/xp.ts), and online games decided by an
// early forfeit pay nothing either — see the XP effect below.
const XP_REWARDS = {
  lose: 0,
  pvp_win: 10,
  win: { 1: 2, 2: 4, 3: 6, 4: 8, 5: 10 }
};
/** An online game must have at least this many moves for forfeit XP to count. */
const MIN_MOVES_FOR_FORFEIT_XP = 10;

/**
 * BOARD INK — these hexes are board ink, NOT theme colors.
 *
 * A checkers board legitimately needs its own two-tone palette: the squares
 * must hold a hard contrast against each other and the red/black pieces have
 * to stay recognisable as red and black under every design.config.ts palette,
 * in both light and dark mode. Themed tokens can't guarantee either. Injected
 * as custom properties on the game root so the markup below stays declarative.
 */
const BOARD_INK = {
  '--bd-light': '#e9e4d8',
  '--bd-dark': '#4e5d6c',
  '--bd-dark-hover': '#5d6d7d',
  '--bd-selected': '#3b4753',
  '--bd-frame': '#242a31',
  '--bd-hi': '#ffc53d',
  '--bd-hi-edge': '#c68b00',
  '--bd-red': '#d7263d',
  '--bd-red-rim': '#f0596d',
  '--bd-red-edge': '#7d101f',
  '--bd-red-ink': '#ffd3d9',
  '--bd-black': '#20252c',
  '--bd-black-rim': '#48515c',
  '--bd-black-edge': '#05070a',
  '--bd-black-ink': '#aab3bf',
} as React.CSSProperties;

// ============================================================================
// TRANSLATIONS
// ============================================================================
const TRANSLATIONS = {
  uz: {
    title: "Shashka", back: "Orqaga", reset: "Qaytadan", setup: "O'yin Sozlamalari", backToGames: "O'yinlarga qaytish",
    mode: "Rejimni tanlang", pvp_local: "1 Qurilmada", pvp_online: "Do'st bilan", pve: "Botga qarshi", diff: "Qiyinchilik",
    levels: { 1: "Oson", 2: "Yengil", 3: "O'rtacha", 4: "Qiyin", 5: "Grosmeyster" },
    start: "Boshlash", botThinking: "O'ylamoqda...",
    youRed: "Siz (Qizil)", opponentBlack: "Raqib (Qora)", 
    resultTitleWin: "Ajoyib G'alaba!", resultTitleLose: "Mag'lubiyat...", 
    xpEarned: "XP Qo'lga kiritildi", playAgain: "Yana O'ynash", exit: "Chiqish",
    createRoom: "Xona Yaratish", joinRoom: "Xonaga Kirish", enterCode: "4 xonali kod", waiting: "Do'st kutilmoqda...", roomCode: "Xona KODI:",
    resign: "Taslim bo'lish", opponentResigned: "Raqib taslim bo'ldi!",
    turnIndicatorMine: "Sizning navbatingiz", turnIndicatorTheirs: "Raqib navbati"
  },
  en: {
    title: "Checkers", back: "Back", reset: "Restart", setup: "Game Setup", backToGames: "All Games",
    mode: "Select Mode", pvp_local: "Local 2P", pvp_online: "Play Online", pve: "vs AI Bot", diff: "Difficulty",
    levels: { 1: "Beginner", 2: "Easy", 3: "Medium", 4: "Hard", 5: "Grandmaster" },
    start: "Start Game", botThinking: "Thinking...",
    youRed: "You (Red)", opponentBlack: "Opponent (Black)", 
    resultTitleWin: "Epic Victory!", resultTitleLose: "Defeat...", 
    xpEarned: "XP Earned", playAgain: "Play Again", exit: "Exit",
    createRoom: "Create Room", joinRoom: "Join Room", enterCode: "4-digit code", waiting: "Waiting for friend...", roomCode: "ROOM CODE:",
    resign: "Resign Game", opponentResigned: "Opponent resigned!",
    turnIndicatorMine: "Your Turn", turnIndicatorTheirs: "Opponent's Turn"
  },
  ru: {
    title: "Шашки", back: "Назад", reset: "Заново", setup: "Настройки игры", backToGames: "Все игры",
    mode: "Выберите режим", pvp_local: "На 1 устройстве", pvp_online: "Онлайн с другом", pve: "Против бота", diff: "Сложность",
    levels: { 1: "Новичок", 2: "Легкий", 3: "Средний", 4: "Сложный", 5: "Гроссмейстер" },
    start: "Начать игру", botThinking: "Думает...",
    youRed: "Вы (Красный)", opponentBlack: "Противник (Черный)", 
    resultTitleWin: "Победа!", resultTitleLose: "Поражение...", 
    xpEarned: "Получено XP", playAgain: "Играть Снова", exit: "Выход",
    createRoom: "Создать комнату", joinRoom: "Войти в комнату", enterCode: "4-значный код", waiting: "Ожидание друга...", roomCode: "КОД:",
    resign: "Сдаться", opponentResigned: "Противник сдался!",
    turnIndicatorMine: "Ваш ход", turnIndicatorTheirs: "Ход противника"
  }
};

const AnimatedNumber = ({ value }: { value: number }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let startTime: number;
    const duration = 1200; 
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor((1 - Math.pow(2, -10 * progress)) * value));
      if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  }, [value]);
  return <>{count}</>;
};

const initializeBoard = (): BoardState => {
  const board: BoardState = Array(INITIAL_ROWS).fill(null).map(() => Array(INITIAL_COLS).fill(null));
  let id = 0;
  for (let r = 0; r < INITIAL_ROWS; r++) {
    for (let c = 0; c < INITIAL_COLS; c++) {
      if ((r + c) % 2 === 1) {
        if (r < 3) board[r][c] = { id: `p-${id++}`, player: 'black', isKing: false };
        else if (r > 4) board[r][c] = { id: `p-${id++}`, player: 'red', isKing: false };
      }
    }
  }
  return board;
};

export default function CheckersGame() {
  const router = useRouter();
  const { lang } = useStudentLanguage();
  const { user } = useAuth();
  const t = TRANSLATIONS[lang as keyof typeof TRANSLATIONS] || TRANSLATIONS['en'];

  const [appState, setAppState] = useState<'menu' | 'playing'>('menu');
  const [mode, setMode] = useState<'pve' | 'pvp_local' | 'pvp_online'>('pve');
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | 4 | 5>(3);

  const [board, setBoard] = useState<BoardState>(initializeBoard);
  const [turn, setTurn] = useState<Player>('red');
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [mustJumpPiece, setMustJumpPiece] = useState<Position | null>(null);
  const [winner, setWinner] = useState<Player | null>(null);
  const [isBotThinking, setIsBotThinking] = useState(false);

  // Online Multiplayer State
  const [roomCode, setRoomCode] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [myColor, setMyColor] = useState<Player>('red');
  const [isWaitingForOpponent, setIsWaitingForOpponent] = useState(false);

  // XP State
  const [hasSavedXP, setHasSavedXP] = useState(false);
  const [earnedXP, setEarnedXP] = useState(0);

  // Anti-collusion inputs: how the game ended and how many moves it had.
  const [moveCount, setMoveCount] = useState(0);
  const [endedByForfeit, setEndedByForfeit] = useState(false);

  const isMyWin = mode === 'pvp_online' ? winner === myColor : winner === 'red';

  // --- ONLINE MULTIPLAYER SYNC ---
  useEffect(() => {
    if (mode === 'pvp_online' && roomCode) {
      const unsub = onSnapshot(doc(db, 'active_games', roomCode), (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        
        // Flawless identity binding
        if (user?.uid === data.host) setMyColor('red');
        else if (user?.uid === data.guest) setMyColor('black');

        if (data.status === 'playing' && isWaitingForOpponent) setIsWaitingForOpponent(false);
        
        if (typeof data.moveCount === 'number') setMoveCount(data.moveCount);

        if (data.status === 'forfeit') {
          const winnerByForfeit = data.forfeitedBy === 'red' ? 'black' : 'red';
          setEndedByForfeit(true);
          setWinner(winnerByForfeit);
          if (data.forfeitedBy !== myColor) sToast.success(t.opponentResigned);
          return;
        }

        if (data.board) setBoard(JSON.parse(data.board));
        if (data.turn) setTurn(data.turn);
        if (data.winner) setWinner(data.winner);
        if (data.mustJumpPiece !== undefined) {
          setMustJumpPiece(data.mustJumpPiece ? JSON.parse(data.mustJumpPiece) : null);
        }
      });
      return () => unsub();
    }
  }, [mode, roomCode, isWaitingForOpponent, myColor, user?.uid, t.opponentResigned]);

  const handleCreateRoom = async () => {
    if (!user) return;
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    await setDoc(doc(db, 'active_games', code), {
      host: user.uid, guest: null, status: 'waiting', board: JSON.stringify(initializeBoard()), turn: 'red', winner: null, mustJumpPiece: null, moveCount: 0
    });
    setRoomCode(code);
    setMyColor('red');
    setIsWaitingForOpponent(true);
    setBoard(initializeBoard());
    setTurn('red');
    setMoveCount(0);
    setEndedByForfeit(false);
    setAppState('playing');
  };

  const handleJoinRoom = async () => {
    if (!user || joinCodeInput.length !== 4) return sToast.error(t.enterCode);
    const roomRef = doc(db, 'active_games', joinCodeInput);
    try {
      // Transactional join: get→check→update had a race where a second guest
      // could overwrite the first and lock them out (rules allow the write
      // while guest==null). Asserting inside the transaction closes it.
      const joined = await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(roomRef);
        if (!snap.exists() || snap.data().status !== 'waiting' || snap.data().guest) return null;
        transaction.update(roomRef, { guest: user.uid, status: 'playing' });
        return snap.data();
      });
      if (!joined) return sToast.error("Room not found or active.");

      setRoomCode(joinCodeInput);
      setMyColor('black');
      setIsWaitingForOpponent(false);
      setBoard(JSON.parse(joined.board));
      setTurn(joined.turn);
      setMoveCount(joined.moveCount || 0);
      setEndedByForfeit(false);
      setAppState('playing');
    } catch {
      sToast.error("Room not found or active.");
    }
  };

  const handleResign = async () => {
    if (mode === 'pvp_online' && roomCode) {
      await updateDoc(doc(db, 'active_games', roomCode), { status: 'forfeit', forfeitedBy: myColor });
    } else {
      setWinner(turn === 'red' ? 'black' : 'red');
    }
  };

  // Single exit path back to the menu. Online: an unstarted room is deleted, a
  // live game counts as a resignation (no silent ghost rooms), a finished one
  // is cleaned up best-effort (finished docs used to accumulate forever).
  const handleExitToMenu = () => {
    if (mode === 'pvp_online' && roomCode) {
      const ref = doc(db, 'active_games', roomCode);
      if (isWaitingForOpponent || winner) deleteDoc(ref).catch(() => {});
      else updateDoc(ref, { status: 'forfeit', forfeitedBy: myColor }).catch(() => {});
    }
    setAppState('menu'); setRoomCode(''); setWinner(null); setHasSavedXP(false);
    setEarnedXP(0); setMoveCount(0); setEndedByForfeit(false); setIsWaitingForOpponent(false);
    setBoard(initializeBoard()); setTurn('red'); setMustJumpPiece(null); setSelectedPos(null);
  };

  // --- VALID MOVES ENGINE ---
  const getValidMovesForPiece = useCallback((currentBoard: BoardState, r: number, c: number, piece: Piece): Move[] => {
    const moves: Move[] = [];
    if (!currentBoard || currentBoard.length === 0) return moves; 

    if (piece.isKing) {
      const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      dirs.forEach(([dr, dc]) => {
        let foundOpponent: Position | null = null;
        let step = 1;
        while (true) {
          const nr = r + step * dr; const nc = c + step * dc;
          if (nr < 0 || nr >= INITIAL_ROWS || nc < 0 || nc >= INITIAL_COLS) break;
          const targetPiece = currentBoard[nr][nc];
          if (!foundOpponent) {
            if (targetPiece === null) moves.push({ r: nr, c: nc });
            else if (targetPiece.player !== piece.player) foundOpponent = { r: nr, c: nc };
            else break; 
          } else {
            if (targetPiece === null) moves.push({ r: nr, c: nc, capture: foundOpponent });
            else break; 
          }
          step++;
        }
      });
    } else {
      const moveDirs = piece.player === 'red' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
      moveDirs.forEach(([dr, dc]) => {
        const nr = r + dr; const nc = c + dc;
        if (nr >= 0 && nr < INITIAL_ROWS && nc >= 0 && nc < INITIAL_COLS && currentBoard[nr][nc] === null) {
          moves.push({ r: nr, c: nc });
        }
      });
      const jumpDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      jumpDirs.forEach(([dr, dc]) => {
        const jr = r + dr; const jc = c + dc;
        const jnr = r + 2 * dr; const jnc = c + 2 * dc;
        if (jnr >= 0 && jnr < INITIAL_ROWS && jnc >= 0 && jnc < INITIAL_COLS) {
          const jumpedPiece = currentBoard[jr][jc];
          if (jumpedPiece && jumpedPiece.player !== piece.player && currentBoard[jnr][jnc] === null) {
            moves.push({ r: jnr, c: jnc, capture: { r: jr, c: jc } });
          }
        }
      });
    }
    return moves;
  }, []);

  const getAllValidMoves = useCallback((currentBoard: BoardState, activePlayer: Player, activeJumper: Position | null) => {
    let allMoves: { start: Position; move: Move }[] = [];
    if (!currentBoard || currentBoard.length === 0) return allMoves;
    if (activeJumper) {
      const piece = currentBoard[activeJumper.r][activeJumper.c]!;
      const moves = getValidMovesForPiece(currentBoard, activeJumper.r, activeJumper.c, piece).filter(m => m.capture);
      return moves.map(m => ({ start: activeJumper, move: m }));
    }
    for (let r = 0; r < INITIAL_ROWS; r++) {
      for (let c = 0; c < INITIAL_COLS; c++) {
        const piece = currentBoard[r][c];
        if (piece && piece.player === activePlayer) {
          const pieceMoves = getValidMovesForPiece(currentBoard, r, c, piece);
          pieceMoves.forEach(m => allMoves.push({ start: { r, c }, move: m }));
        }
      }
    }
    const hasJumps = allMoves.some(m => m.move.capture);
    if (hasJumps) allMoves = allMoves.filter(m => m.move.capture);
    return allMoves;
  }, [getValidMovesForPiece]);

  const currentTurnMoves = useMemo(() => getAllValidMoves(board, turn, mustJumpPiece), [board, turn, mustJumpPiece, getAllValidMoves]);

  useEffect(() => {
    if (appState !== 'playing' || !board || board.length === 0 || isWaitingForOpponent) return;
    let redCount = 0; let blackCount = 0;
    board.forEach(row => row.forEach(p => {
      if (p?.player === 'red') redCount++;
      if (p?.player === 'black') blackCount++;
    }));

    if (redCount === 0) handleWinner('black');
    else if (blackCount === 0) handleWinner('red');
    else if (currentTurnMoves.length === 0) handleWinner(turn === 'red' ? 'black' : 'red');
  }, [board, turn, currentTurnMoves.length, appState, isWaitingForOpponent]);

  const handleWinner = async (winPlayer: Player) => {
    setWinner(winPlayer);
    if (mode === 'pvp_online' && roomCode) {
      await updateDoc(doc(db, 'active_games', roomCode), { winner: winPlayer });
    }
  };

  // --- SAVE XP TRANSACTION LAYER ---
  // All user-doc math (streak advance + bonuses, daily-goal/level-up bonuses,
  // dailyHistory trim) and the leaderboard mirrors run through lib/xp.ts, in
  // ONE transaction. Guards: losses pay 0; online games decided by an early
  // forfeit pay 0 (two-account collusion farm); a per-UTC-day games-XP cap
  // (users.gamesDaily {date, xp}) bounds vs-AI grinding.
  useEffect(() => {
    if (winner && !hasSavedXP && user && (mode === 'pve' || mode === 'pvp_online')) {
      setHasSavedXP(true);

      const rawXp = isMyWin ? (mode === 'pvp_online' ? XP_REWARDS.pvp_win : XP_REWARDS.win[difficulty]) : XP_REWARDS.lose;
      const collusionGuard = mode === 'pvp_online' && endedByForfeit && moveCount < MIN_MOVES_FOR_FORFEIT_XP;
      const xpBase = collusionGuard ? 0 : rawXp;
      if (xpBase <= 0) { setEarnedXP(0); return; }

      const saveMatch = async () => {
        try {
          // Game XP must also land on every class leaderboard the student is on
          // (it used to be invisible there).
          const classSnap = await getDocs(query(collection(db, 'classes'), where('studentIds', 'array-contains', user.uid)));
          const classIds = classSnap.docs.map(d => d.id);
          const todayKey = xpDayKey();

          const result = await runTransaction(db, async (transaction) => {
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await transaction.get(userRef);
            const userData = userSnap.exists() ? userSnap.data()! : {};

            const gamesToday = userData.gamesDaily?.date === todayKey ? (userData.gamesDaily.xp || 0) : 0;
            const xpToAward = Math.min(xpBase, Math.max(0, GAMES_DAILY_XP_CAP - gamesToday));

            const applied = applyUserXp(transaction, userRef, userSnap, {
              xp: xpToAward,
              breakdown: xpToAward > 0 ? [`Checkers: +${xpToAward}`] : ['Daily games cap: +0'],
              activityEntry: { id: `chk_${Date.now()}`, game: 'Checkers', result: isMyWin ? 'win' : 'loss', xpEarned: xpToAward, timestamp: Date.now() },
              activityLimit: 10,
              extraUserFields: { gamesDaily: { date: todayKey, xp: gamesToday + xpToAward } },
            });

            mirrorLeaderboards(transaction, user.uid, applied.finalXp, {
              displayName: userData.displayName || user.displayName,
              avatar: userData.photoURL || user.photoURL || null,
            }, classIds);

            return applied;
          });

          setEarnedXP(result.finalXp);
          if (result.leveledUp) notifyLevelUp(user.uid, result.newLevel);
        } catch (error) { console.error("Error saving XP:", error); }
      };
      saveMatch();
    }
  }, [winner, mode, difficulty, hasSavedXP, user, myColor, isMyWin, endedByForfeit, moveCount]);

  // --- BOT ACTION CONTROLLER ---
  useEffect(() => {
    if (appState !== 'playing' || mode !== 'pve' || turn !== 'black' || winner) return;

    const initialDelay = setTimeout(() => {
      setIsBotThinking(true);

      setTimeout(() => {
        const moves = currentTurnMoves;
        if (moves.length === 0) { setIsBotThinking(false); return; }

        clearAI_Memory();
        
        const depths = { 1: 2, 2: 4, 3: 5, 4: 6, 5: 8 }; 
        const randomnessRates = { 1: 0.70, 2: 0.40, 3: 0.15, 4: 0.05, 5: 0.0 };
        const thresholdValues = { 1: Infinity, 2: 50, 3: 20, 4: 30, 5: 0 }; 
        
        const searchDepth = depths[difficulty];
        const isRandomMove = Math.random() < randomnessRates[difficulty];

        const scoredMoves: { move: { start: Position; move: Move }, score: number }[] = [];
        for (const m of moves) {
          const simBoard = simulateMove(board, m.start, m.move);
          const score = minimax(simBoard, searchDepth - 1, -Infinity, Infinity, false, difficulty);
          scoredMoves.push({ move: m, score });
        }

        const bestScore = Math.max(...scoredMoves.map(s => s.score));

        let candidatePool;
        if (isRandomMove && difficulty < 5) {
            const threshold = thresholdValues[difficulty];
            candidatePool = scoredMoves.filter(s => s.score >= bestScore - threshold);
        } else {
            candidatePool = scoredMoves.filter(s => s.score === bestScore);
        }

        if (candidatePool.length === 0) candidatePool = scoredMoves;

        const chosenMoveObj = candidatePool[Math.floor(Math.random() * candidatePool.length)];
        const chosenMove = chosenMoveObj.move;

        setTimeout(() => {
          setIsBotThinking(false);
          setSelectedPos(chosenMove.start);
          setTimeout(() => { executeMove(chosenMove.start, chosenMove.move); }, 300);
        }, 300);
      }, 50);
    }, 400);

    return () => clearTimeout(initialDelay);
  }, [appState, mode, difficulty, turn, mustJumpPiece, currentTurnMoves, winner, board]);

  const executeMove = async (start: Position, move: Move) => {
    const newBoard = board.map(row => [...row]);
    const piece = newBoard[start.r][start.c]!;

    newBoard[start.r][start.c] = null;
    newBoard[move.r][move.c] = piece;
    if (move.capture) newBoard[move.capture.r][move.capture.c] = null;

    let wasCrowned = false;
    if ((piece.player === 'red' && move.r === 0) || (piece.player === 'black' && move.r === INITIAL_ROWS - 1)) {
      if (!piece.isKing) { piece.isKing = true; wasCrowned = true; }
    }

    setBoard(newBoard);
    setSelectedPos(null);

    let nextTurn = turn;
    let newMustJump = null;

    if (move.capture && !wasCrowned) {
      const furtherJumps = getValidMovesForPiece(newBoard, move.r, move.c, piece).filter(m => m.capture);
      if (furtherJumps.length > 0) {
        newMustJump = { r: move.r, c: move.c };
        setMustJumpPiece(newMustJump);
        setSelectedPos(newMustJump);
      } else {
        setMustJumpPiece(null);
        nextTurn = turn === 'red' ? 'black' : 'red';
        setTurn(nextTurn);
      }
    } else {
      setMustJumpPiece(null);
      nextTurn = turn === 'red' ? 'black' : 'red';
      setTurn(nextTurn);
    }

    setMoveCount(c => c + 1);

    if (mode === 'pvp_online' && roomCode) {
      await updateDoc(doc(db, 'active_games', roomCode), {
        board: JSON.stringify(newBoard), turn: nextTurn, mustJumpPiece: newMustJump ? JSON.stringify(newMustJump) : null,
        moveCount: increment(1)
      });
    }
  };

  const handleSquareClick = (logicalR: number, logicalC: number) => {
    if (winner || isWaitingForOpponent) return;
    if (mode === 'pve' && turn === 'black') return;
    if (mode === 'pvp_online' && turn !== myColor) return;

    const clickedPiece = board[logicalR][logicalC];
    if (clickedPiece && clickedPiece.player === turn) {
      if (currentTurnMoves.some(m => m.start.r === logicalR && m.start.c === logicalC)) {
        setSelectedPos(selectedPos?.r === logicalR && selectedPos?.c === logicalC && !mustJumpPiece ? null : { r: logicalR, c: logicalC });
      }
      return;
    }
    if (selectedPos && board[logicalR][logicalC] === null) {
      const move = currentTurnMoves.find(m => m.start.r === selectedPos.r && m.start.c === selectedPos.c && m.move.r === logicalR && m.move.c === logicalC);
      if (move) executeMove(selectedPos, move.move);
      else if (!mustJumpPiece) setSelectedPos(null);
    }
  };

  // 💡 FIXED: Re-injected the activeTargets calculation so jump targets highlight instantly!
  const activeTargets = selectedPos ? currentTurnMoves.filter(m => m.start.r === selectedPos.r && m.start.c === selectedPos.c).map(m => m.move) : [];

  // ============================================================================
  // VIEW: SETUP MENU
  // ============================================================================
  if (appState === 'menu') {
    const modeButton = (active: boolean, accent: 'primary' | 'secondary') =>
      cn(
        'flex flex-col items-center justify-center gap-2 rounded-m3-sm border-[1.5px] p-3 s-press transition-colors',
        active
          ? accent === 'primary'
            ? 'border-primary bg-primary-container text-on-primary-container'
            : 'border-secondary bg-secondary-container text-on-secondary-container'
          : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-state-hover',
      );

    return (
      <Page className="flex min-h-[calc(100dvh_-_var(--s-topbar-h)_-_var(--s-dock-h)_-_var(--s-safe-b)_-_16px)] flex-col items-center justify-center md:min-h-[calc(100dvh_-_var(--s-topbar-h)_-_2rem)]">

        {/* Permanent Back Button to All Games */}
        <div className="mb-4 w-full max-w-[440px]">
          <Button
            variant="outlined"
            size="sm"
            icon={<ArrowLeft size={18} strokeWidth={3} />}
            onClick={() => router.push('/games')}
          >
            {t.backToGames}
          </Button>
        </div>

        <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="w-full max-w-[440px]">
          <Card className="w-full sm:p-8">
            <Tile tone="error" size="lg" className="mx-auto mb-4">
              <Crown size={32} strokeWidth={2.5} />
            </Tile>
            <h1 className="s-display mb-8 text-center text-[clamp(22px,5vw,28px)] font-bold leading-tight">{t.setup}</h1>

            <div className="mb-6">
              <h3 className="mb-3 text-[12px] font-black uppercase tracking-widest text-on-surface-variant">{t.mode}</h3>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" aria-pressed={mode === 'pve'} onClick={() => setMode('pve')} className={modeButton(mode === 'pve', 'primary')}>
                  <Bot size={24} strokeWidth={2.5} /><span className="text-center text-[11px] font-black">{t.pve}</span>
                </button>
                <button type="button" aria-pressed={mode === 'pvp_local'} onClick={() => setMode('pvp_local')} className={modeButton(mode === 'pvp_local', 'primary')}>
                  <Users size={24} strokeWidth={2.5} /><span className="text-center text-[11px] font-black">{t.pvp_local}</span>
                </button>
                <button type="button" aria-pressed={mode === 'pvp_online'} onClick={() => setMode('pvp_online')} className={modeButton(mode === 'pvp_online', 'secondary')}>
                  <Wifi size={24} strokeWidth={2.5} /><span className="text-center text-[11px] font-black">{t.pvp_online}</span>
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {mode === 'pve' && (
                <motion.div key="pve" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-8 overflow-hidden">
                  <h3 className="mb-3 pt-2 text-[12px] font-black uppercase tracking-widest text-on-surface-variant">{t.diff}</h3>
                  <div className="grid grid-cols-5 gap-1 rounded-m3-sm bg-surface-container-high p-1.5">
                    {[{ l: 1 as const, icon: Zap, c: 'text-success' }, { l: 2 as const, icon: Brain, c: 'text-success' }, { l: 3 as const, icon: Target, c: 'text-gold' }, { l: 4 as const, icon: ShieldAlert, c: 'text-warning' }, { l: 5 as const, icon: Skull, c: 'text-error' }].map((level) => (
                      <button
                        key={level.l}
                        type="button"
                        aria-pressed={difficulty === level.l}
                        onClick={() => setDifficulty(level.l)}
                        className={cn(
                          'relative flex flex-col items-center justify-center gap-1.5 rounded-m3-xs py-3 transition-all duration-m3-fast',
                          difficulty === level.l
                            ? cn('z-10 scale-105 bg-surface shadow-elev-1', level.c)
                            : 'text-on-surface-variant',
                        )}
                      >
                        <level.icon size={18} strokeWidth={difficulty === level.l ? 3 : 2} /><span className="text-[9px] font-black uppercase tracking-tighter">{t.levels[level.l]}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {mode === 'pvp_online' && (
                <motion.div key="online" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-8 space-y-3 overflow-hidden pt-2">
                  <Button tone="secondary" size="lg" fullWidth icon={<Wifi size={18} strokeWidth={3} />} onClick={handleCreateRoom}>
                    {t.createRoom}
                  </Button>
                  <div className="flex items-center gap-2">
                    <div className="relative min-w-0 flex-1">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="XXXX"
                        aria-label={t.enterCode}
                        value={joinCodeInput}
                        onChange={(e)=>setJoinCodeInput(e.target.value.replace(/\D/g, ''))}
                        className="h-14 w-full rounded-m3-sm border-[1.5px] border-outline-variant bg-surface-container pl-10 pr-4 font-mono text-xl font-black tracking-[0.4em] text-on-surface outline-none transition-colors focus:border-primary focus:bg-surface-container-lowest"
                      />
                    </div>
                    <Button size="lg" onClick={handleJoinRoom} disabled={joinCodeInput.length !== 4} className="h-14 shrink-0">
                      {t.joinRoom}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {mode !== 'pvp_online' && (
              <Button
                size="lg"
                fullWidth
                trailingIcon={<ArrowLeft size={20} className="rotate-180" strokeWidth={3} />}
                onClick={() => { setBoard(initializeBoard()); setAppState('playing'); setTurn('red'); setWinner(null); setHasSavedXP(false); }}
              >
                {t.start}
              </Button>
            )}
          </Card>
        </motion.div>
      </Page>
    );
  }

  // ============================================================================
  // VIEW: MAIN BOARD INTERFACE (Co-existing flawlessly inside StudentLayout)
  // ============================================================================
  
  const isMyTurn = turn === myColor || (mode === 'pve' && turn === 'red') || mode === 'pvp_local';

  const visualBoard = [];
  for (let visualR = 0; visualR < INITIAL_ROWS; visualR++) {
    for (let visualC = 0; visualC < INITIAL_COLS; visualC++) {
      const logicalR = (mode === 'pvp_online' && myColor === 'black') ? 7 - visualR : visualR;
      const logicalC = (mode === 'pvp_online' && myColor === 'black') ? 7 - visualC : visualC;
      
      const piece = board[logicalR][logicalC];
      const isDark = (logicalR + logicalC) % 2 === 1; 
      const isSelected = selectedPos?.r === logicalR && selectedPos?.c === logicalC;
      const isMoveTarget = activeTargets.some(m => m.r === logicalR && m.c === logicalC);

      const isMyOwnPiece = 
        mode === 'pve' ? piece?.player === 'red' :
        mode === 'pvp_online' ? piece?.player === myColor :
        true; 

      const hasAnyMove = currentTurnMoves.some(m => m.start.r === logicalR && m.start.c === logicalC);
      const isLegallyMovable = 
        !winner && 
        !isWaitingForOpponent && 
        turn === piece?.player && 
        isMyOwnPiece && 
        (mustJumpPiece ? (mustJumpPiece.r === logicalR && mustJumpPiece.c === logicalC) : hasAnyMove);

      const isDimmedByMandatoryJump = mustJumpPiece && piece && piece.player === turn && !(mustJumpPiece.r === logicalR && mustJumpPiece.c === logicalC);

      visualBoard.push({ logicalR, logicalC, piece, isDark, isSelected, isMoveTarget, isLegallyMovable, isDimmedByMandatoryJump });
    }
  }

  return (
    // Responsive container that naturally respects your layout headers and footers
    <div
      style={BOARD_INK}
      className="flex w-full select-none flex-col overflow-hidden bg-background min-h-[calc(100dvh_-_var(--s-topbar-h)_-_var(--s-dock-h)_-_var(--s-safe-b)_-_16px)] md:min-h-[calc(100dvh_-_var(--s-topbar-h)_-_2rem)] lg:flex-row"
    >

      {/* WAITING OVERLAY */}
      {isWaitingForOpponent && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-[color-mix(in_oklab,var(--m3-scrim)_60%,transparent)] p-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-m3-lg bg-surface-container-high p-8 text-center shadow-elev-3">
             <Tile tone="secondary" size="lg" className="mx-auto mb-4 animate-pulse">
               <Wifi size={32} />
             </Tile>
             <h2 className="s-display mb-1 text-[20px] font-bold">{t.waiting}</h2>
             <p className="mb-4 text-[12px] font-bold text-on-surface-variant">{t.roomCode}</p>
             <div className="mb-6 rounded-m3-sm border border-outline-variant bg-surface-container py-3 font-mono text-3xl font-black tracking-[0.2em] text-on-surface">
               {roomCode}
             </div>
             <Button variant="text" size="sm" onClick={handleExitToMenu}>{t.back}</Button>
          </div>
        </div>
      )}

      {/* 📱 MOBILE TOP HEADER (Permanent Back button & Status) */}
      <header className="z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-outline-variant bg-surface-container px-3 lg:hidden">
        <Button variant="tonal" size="sm" icon={<ArrowLeft size={16} />} onClick={handleExitToMenu} className="shrink-0">
          {t.setup}
        </Button>

        <div className={cn(
          'flex min-w-0 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider',
          isMyTurn ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant',
        )}>
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', isMyTurn ? 'animate-ping bg-on-primary' : 'bg-outline')} />
          <span className="truncate">{isMyTurn ? t.turnIndicatorMine : t.turnIndicatorTheirs}</span>
        </div>

        <Button variant="tonal" tone="error" size="sm" icon={<Flag size={14} />} onClick={handleResign} className="shrink-0">
          Taslim
        </Button>
      </header>

      {/* MATRIX TILE LAYER (Centered felt board) */}
      <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center bg-background p-2 sm:p-6">

        <div className="relative flex aspect-square w-full max-w-[min(100vw-1rem,500px)] items-center justify-center rounded-m3-lg border-b-[10px] border-[var(--bd-frame)] bg-[var(--bd-frame)] p-2 shadow-elev-3 sm:p-4 lg:max-w-[min(100vh-3rem,680px)]">

          {/* 🛑 layoutRoot completely absorbs inline transform matrices to eliminate screen shaking */}
          <motion.div layoutRoot className="relative grid h-full w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-m3-sm border-4 border-[var(--bd-frame)] bg-[var(--bd-light)]">

            {visualBoard.map(({ logicalR, logicalC, piece, isDark, isSelected, isMoveTarget, isLegallyMovable, isDimmedByMandatoryJump }) => (
              <div
                key={`sq-${logicalR}-${logicalC}`}
                onClick={() => isDark && handleSquareClick(logicalR, logicalC)}
                className={`relative w-full h-full flex items-center justify-center select-none
                  ${isDark ? 'bg-[var(--bd-dark)]' : 'bg-[var(--bd-light)]'}
                  ${isDark && isLegallyMovable && !isSelected ? 'hover:bg-[var(--bd-dark-hover)]' : ''}
                  ${isSelected ? 'bg-[var(--bd-selected)] shadow-[inset_0_0_0_4px_var(--bd-hi)]' : ''}
                `}
              >
                {isMoveTarget && <motion.div layoutId="target" className="absolute z-10 h-[28%] w-[28%] rounded-full border-2 border-[var(--bd-hi-edge)] bg-[var(--bd-hi)] shadow-elev-1" />}

                <AnimatePresence>
                  {piece && (
                    <motion.div
                      key={piece.id}
                      layoutId={piece.id}
                      layout
                      initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0, opacity: 0 }}
                      transition={{ layout: { type: "spring", stiffness: 180, damping: 22 }, default: { duration: 0.2 } }}
                      // Absolute inline sizing stops grid layout recalculation loops during animation frames
                      style={{ width: '82%', height: '82%', position: 'absolute', zIndex: isSelected ? 30 : 20 }}
                      className={`
                        rounded-full shadow-[0_6px_12px_rgba(0,0,0,0.4)] flex items-center justify-center cursor-grab active:cursor-grabbing
                        ${piece.player === 'red'
                          ? 'bg-[var(--bd-red)] border-2 border-[var(--bd-red-rim)] border-b-[6px] border-b-[var(--bd-red-edge)]'
                          : 'bg-[var(--bd-black)] border-2 border-[var(--bd-black-rim)] border-b-[6px] border-b-[var(--bd-black-edge)]'}

                        /* Movable Aura */
                        ${isLegallyMovable && !isSelected ? 'ring-4 ring-[var(--bd-hi)] ring-offset-2 ring-offset-[var(--bd-dark)] animate-pulse cursor-pointer hover:-translate-y-0.5 transition-transform' : ''}

                        /* Mandatory jump dimming */
                        ${isDimmedByMandatoryJump ? 'opacity-30 grayscale' : ''}

                        ${isSelected ? 'ring-4 ring-[var(--bd-hi)] ring-offset-2 ring-offset-[var(--bd-selected)]' : ''}
                        ${!isLegallyMovable && !isSelected ? 'cursor-default' : ''}
                      `}
                    >
                      <div className={`w-[56%] h-[56%] rounded-full border flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] ${piece.player === 'red' ? 'border-[var(--bd-red-edge)] bg-[var(--bd-red-edge)]' : 'border-[var(--bd-black-edge)] bg-[var(--bd-black-edge)]'}`}>
                        {piece.isKing && <Crown size={20} strokeWidth={3} className={piece.player === 'red' ? 'text-[var(--bd-red-ink)]' : 'text-[var(--bd-black-ink)]'} />}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* 📱 MOBILE BOTTOM VS BAR (Sits safely above your global mobile nav bar) */}
      <footer className="z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-t border-outline-variant bg-surface-container px-6 lg:hidden">
         <div className={cn('flex min-w-0 items-center gap-2 transition-opacity', turn !== myColor ? 'font-bold text-on-surface opacity-100' : 'text-on-surface-variant opacity-50')}>
            <div className="grid h-6 w-6 shrink-0 place-items-center rounded border border-[var(--bd-black-rim)] bg-[var(--bd-black)] text-[10px] font-black text-[var(--bd-black-ink)]">
               {mode === 'pve' ? <Bot size={14}/> : 'P2'}
            </div>
            <span className="truncate text-xs">{mode === 'pve' ? t.opponentBlack : mode === 'pvp_online' ? (myColor === 'red' ? "Raqib (Qora)" : "Raqib (Qizil)") : "Raqib"}</span>
         </div>

         <span className="shrink-0 text-[10px] font-black tracking-widest text-outline">VS</span>

         <div className={cn('flex min-w-0 items-center gap-2 transition-opacity', turn === myColor ? 'font-bold text-on-surface opacity-100' : 'text-on-surface-variant opacity-50')}>
            <span className="truncate text-xs">{mode === 'pvp_online' && myColor === 'black' ? "Siz (Qora)" : "Siz (Qizil)"}</span>
            <div className="grid h-6 w-6 shrink-0 place-items-center rounded border border-[var(--bd-red-rim)] bg-[var(--bd-red)] text-[10px] font-black text-[var(--bd-red-ink)]">
               <Crown size={14}/>
            </div>
         </div>
      </footer>

      {/* 💻 PC RIGHT SIDEBAR (Permanent Back & Actions) */}
      <div className="z-20 hidden w-[380px] shrink-0 flex-col border-l border-outline-variant bg-surface p-6 shadow-elev-2 lg:flex">

        <div className="mb-8 flex gap-2">
          <Button variant="outlined" fullWidth icon={<ArrowLeft size={16} strokeWidth={3} />} onClick={handleExitToMenu}>
            {t.setup}
          </Button>
          <Button variant="tonal" tone="error" fullWidth icon={<Flag size={16} strokeWidth={3} />} onClick={handleResign}>
            {t.resign}
          </Button>
        </div>

        <div className={cn(
          'mb-8 flex w-full flex-col items-center justify-center gap-1 rounded-m3-md py-4 transition-colors duration-m3-med',
          isMyTurn ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface-variant',
        )}>
           <span className="text-[18px] font-black uppercase tracking-wider">
             {isMyTurn ? t.turnIndicatorMine : t.turnIndicatorTheirs}
           </span>
           {!isMyTurn && <Loader2 size={16} className="mt-1 animate-spin" />}
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <Card variant="outlined" className={cn('transition-all duration-m3-med', turn !== myColor ? 'border-gold' : 'opacity-60')}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-m3-sm border-b-4 border-[var(--bd-black-edge)] bg-[var(--bd-black)] text-lg font-black text-[var(--bd-black-ink)]">
                  {mode === 'pve' ? <Bot size={28}/> : 'P2'}
                </div>
                <div className="min-w-0">
                  <h3 className="s-display truncate text-[16px] font-bold">
                    {mode === 'pve' ? t.opponentBlack : mode === 'pvp_online' ? (myColor === 'red' ? "Raqib (Qora)" : "Raqib (Qizil)") : "Raqib (Qora)"}
                  </h3>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">{mode === 'pve' ? t.levels[difficulty] : 'Online'}</span>
                </div>
              </div>
              {turn !== myColor && <span className="h-3.5 w-3.5 shrink-0 animate-pulse rounded-full bg-gold"/>}
            </div>
          </Card>

          <Card variant="outlined" className={cn('transition-all duration-m3-med', turn === myColor ? 'border-primary' : 'opacity-60')}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-m3-sm border-b-4 border-[var(--bd-red-edge)] bg-[var(--bd-red)] text-lg font-black text-[var(--bd-red-ink)]">
                  <Crown size={28}/>
                </div>
                <div className="min-w-0">
                  <h3 className="s-display truncate text-[16px] font-bold">
                    {mode === 'pvp_online' && myColor === 'black' ? "Siz (Qora)" : "Siz (Qizil)"}
                  </h3>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Siz</span>
                </div>
              </div>
              {turn === myColor && <span className="h-3.5 w-3.5 shrink-0 animate-pulse rounded-full bg-primary"/>}
            </div>
          </Card>
        </div>

        <div className="mt-auto border-t border-outline-variant pt-6 text-center text-[11px] font-black uppercase tracking-widest text-outline">
          {t.title} Engine Pro Edition
        </div>
      </div>

      {/* 🟢 RESULTS MODAL */}
      <AnimatePresence>
        {winner && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[color-mix(in_oklab,var(--m3-scrim)_60%,transparent)] p-4 backdrop-blur-md">

            {isMyWin && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                 <motion.div initial={{ y: "100vh", x: "20vw", opacity: 0 }} animate={{ y: "-20vh", opacity: [0, 1, 0], rotate: 360 }} transition={{ duration: 3, ease: "easeOut" }} className="absolute text-6xl">🔥</motion.div>
                 <motion.div initial={{ y: "100vh", x: "80vw", opacity: 0 }} animate={{ y: "-10vh", opacity: [0, 1, 0], rotate: -180 }} transition={{ duration: 3.5, ease: "easeOut", delay: 0.2 }} className="absolute text-6xl">🎉</motion.div>
                 <motion.div initial={{ y: "100vh", x: "50vw", opacity: 0 }} animate={{ y: "-30vh", opacity: [0, 1, 0], rotate: 90 }} transition={{ duration: 4, ease: "easeOut", delay: 0.4 }} className="absolute text-7xl">🏆</motion.div>
              </div>
            )}

            <motion.div initial={{ scale: 0.9, opacity: 0, y: 15 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="w-full max-w-sm rounded-m3-lg bg-surface-container-high p-8 text-center shadow-elev-3">
               <div className={cn(
                 'mx-auto mb-5 grid h-20 w-20 place-items-center rounded-m3-md',
                 isMyWin ? 'bg-gold-container text-on-gold-container' : 'bg-surface-container-highest text-on-surface-variant',
               )}>
                  {isMyWin ? <Trophy size={40} strokeWidth={2.5} /> : <Skull size={40} strokeWidth={2.5} />}
               </div>

               <h2 className="s-display text-[clamp(24px,6vw,30px)] font-bold leading-tight">
                  {isMyWin ? t.resultTitleWin : t.resultTitleLose}
               </h2>

               {(mode === 'pve' || mode === 'pvp_online') && earnedXP > 0 && isMyWin && (
                  <div className="mt-6 rounded-m3-md bg-gold p-4 text-on-gold">
                     <div className="mb-0.5 flex items-center justify-center gap-1 text-[11px] font-black uppercase tracking-widest"><Zap size={14} fill="currentColor"/> {t.xpEarned}</div>
                     <span className="text-4xl font-black tracking-tighter">+<AnimatedNumber value={earnedXP} /></span>
                  </div>
               )}

               <div className="mt-6">
                 <Button size="lg" fullWidth tone={isMyWin ? 'gold' : 'primary'} onClick={handleExitToMenu}>
                    {t.playAgain}
                 </Button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}