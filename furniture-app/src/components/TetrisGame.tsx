"use client";

import { useEffect, useReducer, useRef } from "react";

const ROWS = 20;
const COLS = 10;

type PieceType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
type Matrix = number[][];
type Board = (PieceType | null)[][];

const SHAPES: Record<PieceType, Matrix> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

// All cat emoji, all pink/fuchsia/rose backgrounds — every piece reads as
// "part of the same pink game" while still being tellable apart.
const PIECE_STYLE: Record<PieceType, { emoji: string; bg: string }> = {
  I: { emoji: "🐈", bg: "bg-pink-400" },
  O: { emoji: "🐱", bg: "bg-pink-300" },
  T: { emoji: "😺", bg: "bg-fuchsia-400" },
  S: { emoji: "😸", bg: "bg-rose-400" },
  Z: { emoji: "😹", bg: "bg-pink-500" },
  J: { emoji: "😻", bg: "bg-fuchsia-300" },
  L: { emoji: "😼", bg: "bg-rose-300" },
};

const PIECE_TYPES = Object.keys(SHAPES) as PieceType[];

function randomPieceType(): PieceType {
  return PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
}

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<PieceType | null>(COLS).fill(null));
}

function rotateMatrix(matrix: Matrix): Matrix {
  const n = matrix.length;
  const rotated: Matrix = Array.from({ length: n }, () => Array(n).fill(0));
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      rotated[x][n - 1 - y] = matrix[y][x];
    }
  }
  return rotated;
}

function spawnPosition(type: PieceType) {
  const size = SHAPES[type].length;
  return { row: -2, col: Math.floor((COLS - size) / 2) };
}

type ActivePiece = { type: PieceType; matrix: Matrix; row: number; col: number };

function collides(board: Board, matrix: Matrix, row: number, col: number): boolean {
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      if (!matrix[y][x]) continue;
      const boardRow = row + y;
      const boardCol = col + x;
      if (boardCol < 0 || boardCol >= COLS || boardRow >= ROWS) return true;
      if (boardRow >= 0 && board[boardRow][boardCol]) return true;
    }
  }
  return false;
}

const LINE_SCORE = [0, 100, 300, 500, 800];

type GameState = {
  board: Board;
  active: ActivePiece;
  next: PieceType;
  score: number;
  lines: number;
  level: number;
  gameOver: boolean;
  paused: boolean;
};

function newActive(type: PieceType): ActivePiece {
  const { row, col } = spawnPosition(type);
  return { type, matrix: SHAPES[type], row, col };
}

function initialState(): GameState {
  return {
    board: emptyBoard(),
    active: newActive(randomPieceType()),
    next: randomPieceType(),
    score: 0,
    lines: 0,
    level: 1,
    gameOver: false,
    paused: false,
  };
}

function lockActivePiece(state: GameState): GameState {
  const board = state.board.map((row) => [...row]);
  const { active } = state;
  for (let y = 0; y < active.matrix.length; y++) {
    for (let x = 0; x < active.matrix[y].length; x++) {
      if (!active.matrix[y][x]) continue;
      const boardRow = active.row + y;
      const boardCol = active.col + x;
      if (boardRow >= 0) board[boardRow][boardCol] = active.type;
    }
  }

  const remaining = board.filter((row) => row.some((cell) => cell === null));
  const clearedCount = ROWS - remaining.length;
  while (remaining.length < ROWS) remaining.unshift(Array<PieceType | null>(COLS).fill(null));

  const lines = state.lines + clearedCount;
  const level = 1 + Math.floor(lines / 10);
  const score = state.score + LINE_SCORE[clearedCount] * state.level;

  const spawned = newActive(state.next);
  const gameOver = collides(remaining, spawned.matrix, spawned.row, spawned.col);

  return {
    board: remaining,
    active: spawned,
    next: randomPieceType(),
    score,
    lines,
    level,
    gameOver,
    paused: state.paused,
  };
}

type Action =
  | { type: "TICK" }
  | { type: "MOVE"; dx: number }
  | { type: "ROTATE" }
  | { type: "SOFT_DROP" }
  | { type: "HARD_DROP" }
  | { type: "TOGGLE_PAUSE" }
  | { type: "RESTART" };

function reducer(state: GameState, action: Action): GameState {
  if (action.type === "RESTART") return initialState();
  if (state.gameOver) return state;

  if (action.type === "TOGGLE_PAUSE") return { ...state, paused: !state.paused };
  if (state.paused) return state;

  switch (action.type) {
    case "TICK":
    case "SOFT_DROP": {
      const { active, board } = state;
      if (!collides(board, active.matrix, active.row + 1, active.col)) {
        const bonus = action.type === "SOFT_DROP" ? 1 : 0;
        return { ...state, score: state.score + bonus, active: { ...active, row: active.row + 1 } };
      }
      return lockActivePiece(state);
    }
    case "HARD_DROP": {
      let { active } = state;
      let dropped = 0;
      while (!collides(state.board, active.matrix, active.row + 1, active.col)) {
        active = { ...active, row: active.row + 1 };
        dropped++;
      }
      return lockActivePiece({ ...state, active, score: state.score + dropped * 2 });
    }
    case "MOVE": {
      const { active, board } = state;
      const col = active.col + action.dx;
      if (collides(board, active.matrix, active.row, col)) return state;
      return { ...state, active: { ...active, col } };
    }
    case "ROTATE": {
      const { active, board } = state;
      const rotated = rotateMatrix(active.matrix);
      for (const kick of [0, -1, 1, -2, 2]) {
        const col = active.col + kick;
        if (!collides(board, rotated, active.row, col)) {
          return { ...state, active: { ...active, matrix: rotated, col } };
        }
      }
      return state;
    }
    default:
      return state;
  }
}

function tickDelayMs(level: number): number {
  return Math.max(120, 800 - (level - 1) * 70);
}

function renderableBoard(state: GameState): Board {
  const board = state.board.map((row) => [...row]);
  const { active } = state;
  for (let y = 0; y < active.matrix.length; y++) {
    for (let x = 0; x < active.matrix[y].length; x++) {
      if (!active.matrix[y][x]) continue;
      const row = active.row + y;
      const col = active.col + x;
      if (row >= 0 && row < ROWS && col >= 0 && col < COLS) board[row][col] = active.type;
    }
  }
  return board;
}

function Cell({ type }: { type: PieceType | null }) {
  if (!type) {
    return <div className="aspect-square rounded-sm bg-pink-50 dark:bg-neutral-900" />;
  }
  const { emoji, bg } = PIECE_STYLE[type];
  return (
    <div className={`flex aspect-square items-center justify-center rounded-sm ${bg} text-[10px] leading-none sm:text-xs`}>
      {emoji}
    </div>
  );
}

function NextPreview({ type }: { type: PieceType }) {
  const matrix = SHAPES[type];
  const { emoji, bg } = PIECE_STYLE[type];
  return (
    <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${matrix.length}, minmax(0, 1fr))` }}>
      {matrix.map((row, y) =>
        row.map((cell, x) => (
          <div
            key={`${y}-${x}`}
            className={`flex aspect-square w-4 items-center justify-center rounded-sm text-[10px] ${cell ? bg : ""}`}
          >
            {cell ? emoji : ""}
          </div>
        ))
      )}
    </div>
  );
}

export function TetrisGame() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (state.gameOver || state.paused) return;
    const id = setInterval(() => dispatch({ type: "TICK" }), tickDelayMs(state.level));
    return () => clearInterval(id);
  }, [state.level, state.gameOver, state.paused]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          dispatch({ type: "MOVE", dx: -1 });
          break;
        case "ArrowRight":
          e.preventDefault();
          dispatch({ type: "MOVE", dx: 1 });
          break;
        case "ArrowUp":
          e.preventDefault();
          dispatch({ type: "ROTATE" });
          break;
        case "ArrowDown":
          e.preventDefault();
          dispatch({ type: "SOFT_DROP" });
          break;
        case " ":
          e.preventDefault();
          dispatch({ type: "HARD_DROP" });
          break;
        case "p":
        case "P":
          dispatch({ type: "TOGGLE_PAUSE" });
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const board = renderableBoard(state);

  return (
    <div className="mx-auto flex max-w-xs flex-col items-center gap-2 rounded-2xl bg-gradient-to-b from-pink-100 to-fuchsia-100 p-3 shadow-sm dark:from-neutral-900 dark:to-neutral-950">
      <h1 className="text-base font-bold text-pink-700 dark:text-pink-300">🐾 Pink Cat Tetris 🐾</h1>

      <div className="flex w-full items-start justify-center gap-3">
        <div className="grid w-full max-w-[180px] grid-cols-10 gap-0.5 rounded-lg border-4 border-pink-300 bg-white p-1 dark:border-pink-800 dark:bg-neutral-950">
          {board.map((row, y) =>
            row.map((cell, x) => <Cell key={`${y}-${x}`} type={cell} />)
          )}
        </div>

        <div className="flex flex-col gap-1.5 text-xs text-pink-800 dark:text-pink-200">
          <div>
            <div className="font-semibold">Score</div>
            <div>{state.score}</div>
          </div>
          <div>
            <div className="font-semibold">Lines</div>
            <div>{state.lines}</div>
          </div>
          <div>
            <div className="font-semibold">Level</div>
            <div>{state.level}</div>
          </div>
          <div>
            <div className="font-semibold">Next</div>
            <NextPreview type={state.next} />
          </div>
        </div>
      </div>

      {state.gameOver && (
        <div className="text-center">
          <p className="text-sm font-semibold text-pink-700 dark:text-pink-300">Game over! Final score: {state.score}</p>
        </div>
      )}
      {state.paused && !state.gameOver && (
        <p className="text-sm font-semibold text-pink-700 dark:text-pink-300">Paused</p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button
          onClick={() => dispatch({ type: "MOVE", dx: -1 })}
          className="rounded-lg bg-pink-400 px-2 py-1 text-sm text-white hover:bg-pink-500"
        >
          ←
        </button>
        <button
          onClick={() => dispatch({ type: "ROTATE" })}
          className="rounded-lg bg-pink-400 px-2 py-1 text-sm text-white hover:bg-pink-500"
        >
          ↻
        </button>
        <button
          onClick={() => dispatch({ type: "MOVE", dx: 1 })}
          className="rounded-lg bg-pink-400 px-2 py-1 text-sm text-white hover:bg-pink-500"
        >
          →
        </button>
        <button
          onClick={() => dispatch({ type: "SOFT_DROP" })}
          className="rounded-lg bg-pink-400 px-2 py-1 text-sm text-white hover:bg-pink-500"
        >
          ↓
        </button>
        <button
          onClick={() => dispatch({ type: "HARD_DROP" })}
          className="rounded-lg bg-fuchsia-500 px-2 py-1 text-sm text-white hover:bg-fuchsia-600"
        >
          Drop
        </button>
        <button
          onClick={() => dispatch({ type: "TOGGLE_PAUSE" })}
          className="rounded-lg bg-pink-200 px-2 py-1 text-sm text-pink-800 hover:bg-pink-300 dark:bg-pink-900 dark:text-pink-200"
        >
          {state.paused ? "Resume" : "Pause"}
        </button>
        <button
          onClick={() => dispatch({ type: "RESTART" })}
          className="rounded-lg bg-pink-200 px-2 py-1 text-sm text-pink-800 hover:bg-pink-300 dark:bg-pink-900 dark:text-pink-200"
        >
          Restart
        </button>
      </div>

      <p className="text-center text-xs text-pink-500 dark:text-pink-400">
        Arrow keys to move/rotate/soft-drop, Space to hard-drop, P to pause.
      </p>
    </div>
  );
}
