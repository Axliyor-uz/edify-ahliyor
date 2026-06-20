'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RotateCcw, Crown, Trophy, Users, Bot, Zap, Brain, Target, ShieldAlert, Skull, Loader2, Wifi, Hash, LogOut, Flag } from 'lucide-react';
import { useStudentLanguage } from '../../layout';
import toast from 'react-hot-toast';

// Firebase
import { runTransaction, doc, writeBatch, increment, serverTimestamp, setDoc, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';

// AI Core Imports (Make sure CheckersAI.ts has these exported!)
import { Player, Piece, BoardState, Position, Move, simulateMove, minimax, clearAI_Memory } from './_components/CheckersAI';

const INITIAL_ROWS = 8;
const INITIAL_COLS = 8;

const XP_REWARDS = {
  lose: 1,
  pvp_win: 10,
  win: { 1: 2, 2: 4, 3: 6, 4: 8, 5: 10 }
};

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
        
        if (data.status === 'forfeit') {
          const winnerByForfeit = data.forfeitedBy === 'red' ? 'black' : 'red';
          setWinner(winnerByForfeit);
          if (data.forfeitedBy !== myColor) toast.success(t.opponentResigned);
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
      host: user.uid, guest: null, status: 'waiting', board: JSON.stringify(initializeBoard()), turn: 'red', winner: null, mustJumpPiece: null
    });
    setRoomCode(code);
    setMyColor('red');
    setIsWaitingForOpponent(true);
    setBoard(initializeBoard());
    setTurn('red');
    setAppState('playing');
  };

  const handleJoinRoom = async () => {
    if (!user || joinCodeInput.length !== 4) return toast.error(t.enterCode);
    const roomRef = doc(db, 'active_games', joinCodeInput);
    const snap = await getDoc(roomRef);
    if (!snap.exists() || snap.data().status !== 'waiting') return toast.error("Room not found or active.");
    
    await updateDoc(roomRef, { guest: user.uid, status: 'playing' });
    setRoomCode(joinCodeInput);
    setMyColor('black');
    setIsWaitingForOpponent(false);
    setBoard(JSON.parse(snap.data().board));
    setTurn(snap.data().turn);
    setAppState('playing');
  };

  const handleResign = async () => {
    if (mode === 'pvp_online' && roomCode) {
      await updateDoc(doc(db, 'active_games', roomCode), { status: 'forfeit', forfeitedBy: myColor });
    } else {
      setWinner(turn === 'red' ? 'black' : 'red');
    }
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
  useEffect(() => {
    if (winner && !hasSavedXP && user && (mode === 'pve' || mode === 'pvp_online')) {
      setHasSavedXP(true);
      
      const xpToAward = isMyWin ? (mode === 'pvp_online' ? XP_REWARDS.pvp_win : XP_REWARDS.win[difficulty]) : XP_REWARDS.lose;
      setEarnedXP(xpToAward);

      if (xpToAward > 0) {
        const saveMatch = async () => {
          try {
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            const yesterday = new Date(now); yesterday.setUTCDate(now.getUTCDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            const year = now.getUTCFullYear();
            const month = String(now.getUTCMonth() + 1).padStart(2, '0');
            const day = String(now.getUTCDate()).padStart(2, '0');
            const weekNum = Math.ceil((Math.floor((now.getTime() - new Date(Date.UTC(year, 0, 1)).getTime()) / 86400000) + new Date(Date.UTC(year, 0, 1)).getUTCDay() + 1) / 7);

            await runTransaction(db, async (transaction) => {
              const userRef = doc(db, 'users', user.uid);
              const userDoc = await transaction.get(userRef);
              const userData = userDoc.exists() ? userDoc.data() : {};
              let currentStreak = userData.currentStreak || 0;
              const lastActive = userData.lastActiveDate || "";
              
              if (lastActive === todayStr) { if (currentStreak === 0) currentStreak = 1; } 
              else if (lastActive === yesterdayStr) { currentStreak += 1; } 
              else { currentStreak = 1; }

              let dailyHistory = userData.dailyHistory || {};
              dailyHistory[todayStr] = (dailyHistory[todayStr] || 0) + xpToAward;

              const existingActivity = Array.isArray(userData.recentActivity) ? userData.recentActivity : [];
              transaction.set(userRef, {
                totalXP: increment(xpToAward), currentStreak, dailyHistory, lastActiveDate: todayStr,
                recentActivity: [{ id: `chk_${Date.now()}`, game: 'Checkers', result: isMyWin ? 'win' : 'loss', xpEarned: xpToAward, timestamp: Date.now() }, ...existingActivity].slice(0, 10),
                lastActiveTimestamp: serverTimestamp()
              }, { merge: true });
            });

            const batch = writeBatch(db);
            const lbData = { uid: user.uid, displayName: user.displayName || 'Student', avatar: user.photoURL || null, xp: increment(xpToAward), lastActive: serverTimestamp() };
            [`day_${year}_${month}_${day}`, `week_${year}_${String(weekNum).padStart(2, '0')}`, `month_${year}_${month}`, `all_time`].forEach(pid => {
              batch.set(doc(db, 'leaderboards', pid, 'users', user.uid), lbData, { merge: true });
            });
            await batch.commit();
          } catch (error) { console.error("Error saving XP:", error); }
        };
        saveMatch();
      }
    }
  }, [winner, mode, difficulty, hasSavedXP, user, myColor, isMyWin]);

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

    if (mode === 'pvp_online' && roomCode) {
      await updateDoc(doc(db, 'active_games', roomCode), {
        board: JSON.stringify(newBoard), turn: nextTurn, mustJumpPiece: newMustJump ? JSON.stringify(newMustJump) : null
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
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-hidden w-full h-full min-h-[calc(100vh-80px)]">
        
        {/* Permanent Back Button to All Games */}
        <div className="w-full max-w-[440px] mb-4">
          <button onClick={() => router.push('/games')} className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-zinc-200 border-b-4 active:border-b-2 active:translate-y-[2px] rounded-2xl text-zinc-600 font-black text-[14px] shadow-sm transition-all">
            <ArrowLeft size={18} strokeWidth={3} /> <span>{t.backToGames}</span>
          </button>
        </div>

        <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="bg-white border-2 border-zinc-200 border-b-8 rounded-[2rem] p-6 sm:p-8 max-w-[440px] w-full shadow-2xl">
          <div className="w-16 h-16 bg-gradient-to-br from-rose-100 to-rose-200 rounded-[1.2rem] flex items-center justify-center border-2 border-rose-300 text-rose-600 mx-auto mb-4 shadow-inner">
            <Crown size={32} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-center text-zinc-900 mb-8 tracking-tight">{t.setup}</h1>

          <div className="mb-6">
            <h3 className="text-[12px] font-black text-zinc-400 uppercase tracking-widest mb-3">{t.mode}</h3>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setMode('pve')} className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all border-b-4 active:border-b-2 active:translate-y-[2px] ${mode === 'pve' ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm' : 'bg-white border-zinc-200 text-zinc-500'}`}>
                <Bot size={24} strokeWidth={2.5} /><span className="font-black text-[11px] text-center">{t.pve}</span>
              </button>
              <button onClick={() => setMode('pvp_local')} className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all border-b-4 active:border-b-2 active:translate-y-[2px] ${mode === 'pvp_local' ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm' : 'bg-white border-zinc-200 text-zinc-500'}`}>
                <Users size={24} strokeWidth={2.5} /><span className="font-black text-[11px] text-center">{t.pvp_local}</span>
              </button>
              <button onClick={() => setMode('pvp_online')} className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all border-b-4 active:border-b-2 active:translate-y-[2px] ${mode === 'pvp_online' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'bg-white border-zinc-200 text-zinc-500'}`}>
                <Wifi size={24} strokeWidth={2.5} /><span className="font-black text-[11px] text-center">{t.pvp_online}</span>
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {mode === 'pve' && (
              <motion.div key="pve" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-8">
                <h3 className="text-[12px] font-black text-zinc-400 uppercase tracking-widest mb-3 pt-2">{t.diff}</h3>
                <div className="grid grid-cols-5 bg-zinc-100 p-1.5 rounded-2xl border-2 border-zinc-200/50 shadow-inner">
                  {[{ l: 1 as const, icon: Zap, c: 'text-green-600' }, { l: 2 as const, icon: Brain, c: 'text-lime-600' }, { l: 3 as const, icon: Target, c: 'text-amber-600' }, { l: 4 as const, icon: ShieldAlert, c: 'text-orange-600' }, { l: 5 as const, icon: Skull, c: 'text-rose-700' }].map((level) => (
                    <button key={level.l} onClick={() => setDifficulty(level.l)} className={`relative flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-all ${difficulty === level.l ? `bg-white shadow-md border border-zinc-200/50 ${level.c} scale-105 z-10` : 'text-zinc-400'}`}>
                      <level.icon size={18} strokeWidth={difficulty === level.l ? 3 : 2} /><span className="text-[9px] font-black tracking-tighter uppercase">{t.levels[level.l]}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {mode === 'pvp_online' && (
              <motion.div key="online" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-8 space-y-3 pt-2">
                <button onClick={handleCreateRoom} className="w-full py-4 bg-blue-600 text-white font-black text-[15px] uppercase tracking-widest rounded-xl border-b-4 border-blue-800 active:border-b-0 active:translate-y-[4px] transition-all flex items-center justify-center gap-2">
                  <Wifi size={18} strokeWidth={3}/> {t.createRoom}
                </button>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input type="text" maxLength={4} placeholder="XXXX" value={joinCodeInput} onChange={(e)=>setJoinCodeInput(e.target.value.replace(/\D/g, ''))} className="w-full h-14 bg-zinc-100 border-2 border-zinc-200 rounded-xl pl-10 pr-4 font-mono font-black text-xl tracking-[0.5em] text-zinc-700 outline-none focus:border-blue-500 focus:bg-white transition-all"/>
                  </div>
                  <button onClick={handleJoinRoom} disabled={joinCodeInput.length !== 4} className="h-14 px-6 bg-zinc-800 text-white font-black text-[14px] uppercase tracking-widest rounded-xl border-b-4 border-black active:border-b-0 active:translate-y-[4px] transition-all">
                    {t.joinRoom}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {mode !== 'pvp_online' && (
            <button onClick={() => { setBoard(initializeBoard()); setAppState('playing'); setTurn('red'); setWinner(null); setHasSavedXP(false); }} className="w-full bg-rose-600 text-white font-black text-[16px] py-4 rounded-2xl border-2 border-rose-800 border-b-[6px] active:border-b-2 active:translate-y-[4px] transition-all flex items-center justify-center gap-2 shadow-lg">
              {t.start} <ArrowLeft size={20} className="rotate-180" strokeWidth={3}/>
            </button>
          )}
        </motion.div>
      </div>
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
    <div className="flex-1 flex flex-col lg:flex-row w-full h-full min-h-[calc(100vh-140px)] md:min-h-[calc(100vh-80px)] overflow-hidden select-none font-sans bg-[#16181a] lg:bg-transparent">
      
      {/* WAITING OVERLAY */}
      {isWaitingForOpponent && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-zinc-950/80 backdrop-blur-md p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full text-center shadow-2xl">
             <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
               <Wifi size={32} />
             </div>
             <h2 className="text-xl font-black text-zinc-900 mb-1">{t.waiting}</h2>
             <p className="text-zinc-400 font-bold text-[12px] mb-4">{t.roomCode}</p>
             <div className="bg-zinc-100 rounded-xl py-3 font-mono font-black text-3xl tracking-[0.2em] text-zinc-800 mb-6 border-2 border-zinc-200">
               {roomCode}
             </div>
             <button onClick={() => { setAppState('menu'); setRoomCode(''); }} className="text-zinc-400 font-black text-[12px] uppercase hover:text-zinc-600 underline">{t.back}</button>
          </div>
        </div>
      )}

      {/* 📱 MOBILE TOP HEADER (Permanent Back button & Status) */}
      <header className="flex lg:hidden items-center justify-between px-4 h-14 bg-[#1e2124] border-b border-[#2a2e33] text-white z-30 shrink-0">
        <button onClick={() => setAppState('menu')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2a2e33] text-zinc-200 font-bold text-xs active:scale-95 transition-all">
          <ArrowLeft size={16} /> <span>{t.setup}</span>
        </button>

        <div className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${isMyTurn ? 'bg-rose-600 text-white' : 'bg-[#2a2e33] text-zinc-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isMyTurn ? 'bg-white animate-ping' : 'bg-zinc-500'}`} />
          {isMyTurn ? t.turnIndicatorMine : t.turnIndicatorTheirs}
        </div>

        <button onClick={handleResign} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 font-bold text-xs border border-rose-500/30 active:scale-95 transition-all">
          <Flag size={14} /> <span>Taslim</span>
        </button>
      </header>

      {/* MATRIX TILE LAYER (Centered OLED felt board) */}
      <div className="flex-1 min-w-0 min-h-0 flex items-center justify-center p-2 sm:p-6 relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1e2124] to-[#121315] lg:from-zinc-200 lg:to-zinc-300">
        
        <div className="relative w-full max-w-[min(100vw-1rem,500px)] lg:max-w-[min(100vh-3rem,680px)] aspect-square bg-[#282c30] lg:bg-zinc-800 p-2 sm:p-4 rounded-[1.5rem] sm:rounded-[2.5rem] border-b-[10px] border-[#101113] lg:border-zinc-900 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] flex items-center justify-center">
          
          {/* 🛑 layoutRoot completely absorbs inline transform matrices to eliminate screen shaking */}
          <motion.div layoutRoot className="w-full h-full grid grid-cols-8 grid-rows-8 border-4 border-[#101113] lg:border-zinc-900 rounded-xl overflow-hidden bg-[#dee3e6] relative">
            
            {visualBoard.map(({ logicalR, logicalC, piece, isDark, isSelected, isMoveTarget, isLegallyMovable, isDimmedByMandatoryJump }) => (
              <div 
                key={`sq-${logicalR}-${logicalC}`} 
                onClick={() => isDark && handleSquareClick(logicalR, logicalC)} 
                className={`relative w-full h-full flex items-center justify-center select-none
                  ${isDark ? 'bg-[#788a94]' : 'bg-[#dee3e6]'} 
                  ${isDark && isLegallyMovable && !isSelected ? 'hover:bg-[#6c7d87]' : ''} 
                  ${isSelected ? 'bg-[#61737c] shadow-[inset_0_0_0_4px_#fbbf24]' : ''}
                `}
              >
                {isMoveTarget && <motion.div layoutId="target" className="absolute w-[28%] h-[28%] bg-amber-400 border-2 border-amber-500 rounded-full z-10 shadow-md" />}
                
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
                        ${piece.player === 'red' ? 'bg-rose-600 border-2 border-rose-500 border-b-[6px] border-b-rose-800' : 'bg-zinc-900 border-2 border-zinc-700 border-b-[6px] border-b-black'} 
                        
                        /* Movable Aura */
                        ${isLegallyMovable && !isSelected ? 'ring-4 ring-amber-400/80 ring-offset-2 ring-offset-[#788a94] animate-pulse cursor-pointer hover:-translate-y-0.5 transition-transform' : ''}
                        
                        /* Mandatory jump dimming */
                        ${isDimmedByMandatoryJump ? 'opacity-30 grayscale' : ''}

                        ${isSelected ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-[#788a94]' : ''}
                        ${!isLegallyMovable && !isSelected ? 'cursor-default' : ''}
                      `}
                    >
                      <div className={`w-[56%] h-[56%] rounded-full border flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] ${piece.player === 'red' ? 'border-rose-800 bg-rose-700/40' : 'border-black bg-black/40'}`}>
                        {piece.isKing && <Crown size={20} strokeWidth={3} className={piece.player === 'red' ? 'text-rose-200' : 'text-zinc-400'} />}
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
      <footer className="flex lg:hidden items-center justify-between px-6 h-14 bg-[#1e2124] border-t border-[#2a2e33] text-white z-30 shrink-0">
         <div className={`flex items-center gap-2 transition-opacity ${turn !== myColor ? 'opacity-100 text-amber-400 font-bold' : 'opacity-50 text-zinc-400'}`}>
            <div className="w-6 h-6 rounded bg-zinc-900 flex items-center justify-center text-[10px] font-black border border-zinc-700">
               {mode === 'pve' ? <Bot size={14}/> : 'P2'}
            </div>
            <span className="text-xs">{mode === 'pve' ? t.opponentBlack : mode === 'pvp_online' ? (myColor === 'red' ? "Raqib (Qora)" : "Raqib (Qizil)") : "Raqib"}</span>
         </div>

         <span className="text-[10px] font-black tracking-widest text-zinc-600">VS</span>

         <div className={`flex items-center gap-2 transition-opacity ${turn === myColor ? 'opacity-100 text-rose-400 font-bold' : 'opacity-50 text-zinc-400'}`}>
            <span className="text-xs">{mode === 'pvp_online' && myColor === 'black' ? "Siz (Qora)" : "Siz (Qizil)"}</span>
            <div className="w-6 h-6 rounded bg-rose-600 flex items-center justify-center text-[10px] font-black border border-rose-400">
               <Crown size={14}/>
            </div>
         </div>
      </footer>

      {/* 💻 PC RIGHT SIDEBAR (Permanent Back & Actions) */}
      <div className="hidden lg:flex w-[380px] bg-white border-l-2 border-zinc-200 p-6 flex-col shadow-xl z-20 shrink-0">
        
        <div className="flex gap-2 mb-8">
          <button onClick={() => setAppState('menu')} className="flex-1 flex items-center justify-center gap-1.5 h-12 bg-white border-2 border-zinc-200 border-b-4 active:border-b-2 active:translate-y-[2px] rounded-xl text-zinc-600 font-black text-[13px] transition-all">
            <ArrowLeft size={16} strokeWidth={3} /> {t.setup}
          </button>
          <button onClick={handleResign} className="flex-1 flex items-center justify-center gap-1.5 h-12 bg-rose-50 border-2 border-rose-200 border-b-4 active:border-b-2 active:translate-y-[2px] rounded-xl text-rose-600 font-black text-[13px] transition-all">
            <Flag size={16} strokeWidth={3} /> {t.resign}
          </button>
        </div>

        <div className={`w-full py-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 mb-8 shadow-sm transition-all duration-300 ${isMyTurn ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-zinc-100 border-zinc-300 text-zinc-500'}`}>
           <span className="font-black text-[18px] uppercase tracking-wider">
             {isMyTurn ? t.turnIndicatorMine : t.turnIndicatorTheirs}
           </span>
           {!isMyTurn && <Loader2 size={16} className="animate-spin opacity-50 mt-1" />}
        </div>

        <div className="flex-1 flex flex-col gap-4">
          <div className={`p-5 rounded-3xl border-2 transition-all duration-300 ${turn !== myColor ? 'bg-white border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.15)]' : 'bg-zinc-50 border-zinc-200 opacity-60'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-zinc-900 rounded-[1.2rem] flex items-center justify-center text-white border-b-4 border-black font-black text-lg">
                  {mode === 'pve' ? <Bot size={28}/> : 'P2'}
                </div>
                <div>
                  <h3 className="font-black text-zinc-800 text-[16px]">
                    {mode === 'pve' ? t.opponentBlack : mode === 'pvp_online' ? (myColor === 'red' ? "Raqib (Qora)" : "Raqib (Qizil)") : "Raqib (Qora)"}
                  </h3>
                  <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">{mode === 'pve' ? t.levels[difficulty] : 'Online'}</span>
                </div>
              </div>
              {turn !== myColor && <span className="w-3.5 h-3.5 rounded-full bg-amber-400 animate-pulse"/>}
            </div>
          </div>

          <div className={`p-5 rounded-3xl border-2 transition-all duration-300 ${turn === myColor ? 'bg-white border-rose-400 shadow-[0_0_20px_rgba(225,29,72,0.15)]' : 'bg-zinc-50 border-zinc-200 opacity-60'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-rose-600 rounded-[1.2rem] flex items-center justify-center text-white border-b-4 border-rose-800 font-black text-lg">
                  <Crown size={28}/>
                </div>
                <div>
                  <h3 className="font-black text-zinc-800 text-[16px]">
                    {mode === 'pvp_online' && myColor === 'black' ? "Siz (Qora)" : "Siz (Qizil)"}
                  </h3>
                  <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Siz</span>
                </div>
              </div>
              {turn === myColor && <span className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-pulse"/>}
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-zinc-100 text-center font-black text-[11px] tracking-widest text-zinc-300 uppercase mt-auto">
          {t.title} Engine Pro Edition
        </div>
      </div>

      {/* 🟢 RESULTS MODAL */}
      <AnimatePresence>
        {winner && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-950/80 backdrop-blur-md p-4">
            
            {isMyWin && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                 <motion.div initial={{ y: "100vh", x: "20vw", opacity: 0 }} animate={{ y: "-20vh", opacity: [0, 1, 0], rotate: 360 }} transition={{ duration: 3, ease: "easeOut" }} className="absolute text-6xl">🔥</motion.div>
                 <motion.div initial={{ y: "100vh", x: "80vw", opacity: 0 }} animate={{ y: "-10vh", opacity: [0, 1, 0], rotate: -180 }} transition={{ duration: 3.5, ease: "easeOut", delay: 0.2 }} className="absolute text-6xl">🎉</motion.div>
                 <motion.div initial={{ y: "100vh", x: "50vw", opacity: 0 }} animate={{ y: "-30vh", opacity: [0, 1, 0], rotate: 90 }} transition={{ duration: 4, ease: "easeOut", delay: 0.4 }} className="absolute text-7xl">🏆</motion.div>
              </div>
            )}

            <motion.div initial={{ scale: 0.9, opacity: 0, y: 15 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="max-w-sm w-full bg-white rounded-[2.5rem] p-8 text-center shadow-2xl border-2 border-b-8 border-zinc-200">
               <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center border-4 mb-5 shadow-inner ${isMyWin ? 'bg-amber-100 border-amber-300 text-amber-500' : 'bg-zinc-100 border-zinc-300 text-zinc-400'}`}>
                  {isMyWin ? <Trophy size={40} strokeWidth={2.5} /> : <Skull size={40} strokeWidth={2.5} />}
               </div>

               <h2 className="text-3xl font-black text-zinc-900 tracking-tight">
                  {isMyWin ? t.resultTitleWin : t.resultTitleLose}
               </h2>

               {(mode === 'pve' || mode === 'pvp_online') && earnedXP > 0 && isMyWin && (
                  <div className="mt-6 bg-amber-500 rounded-2xl p-4 text-white border-b-4 border-amber-600">
                     <div className="text-[11px] font-black uppercase tracking-widest opacity-80 flex items-center justify-center gap-1 mb-0.5"><Zap size={14} fill="currentColor"/> {t.xpEarned}</div>
                     <span className="text-4xl font-black tracking-tighter">+<AnimatedNumber value={earnedXP} /></span>
                  </div>
               )}

               <div className="mt-6">
                 <button onClick={() => { setAppState('menu'); setWinner(null); setHasSavedXP(false); }} className={`w-full py-4 text-white font-black text-[14px] uppercase tracking-widest rounded-xl border-b-4 active:border-b-0 active:translate-y-[4px] transition-all ${isMyWin ? 'bg-amber-500 border-amber-700 hover:bg-amber-400' : 'bg-zinc-800 border-black hover:bg-zinc-700'}`}>
                    {t.playAgain}
                 </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}