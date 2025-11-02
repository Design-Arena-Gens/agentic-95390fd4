'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Platform = Rect & {
  type: 'solid' | 'bounce';
  strength?: number;
};

type Coin = Rect & {
  active: boolean;
  spinOffset: number;
};

type Goal = Rect;

type Player = {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  onGround: boolean;
};

type GameStatus = 'idle' | 'running' | 'won' | 'lost';

const GAME_CONFIG = {
  width: 960,
  height: 540,
  gravity: 2200,
  moveSpeed: 320,
  jumpSpeed: 840,
  bounceBonus: 1080,
  timeLimit: 75,
};

const createPlatforms = (): Platform[] => [
  { x: 0, y: 500, width: 960, height: 40, type: 'solid' },
  { x: 80, y: 420, width: 200, height: 16, type: 'solid' },
  { x: 340, y: 360, width: 160, height: 16, type: 'solid' },
  { x: 620, y: 320, width: 220, height: 16, type: 'solid' },
  { x: 220, y: 260, width: 140, height: 16, type: 'solid' },
  { x: 460, y: 210, width: 160, height: 16, type: 'solid' },
  { x: 120, y: 160, width: 120, height: 16, type: 'solid' },
  { x: 760, y: 180, width: 160, height: 16, type: 'solid' },
  { x: 640, y: 90, width: 140, height: 16, type: 'solid' },
  { x: 340, y: 120, width: 120, height: 16, type: 'solid' },
  { x: 540, y: 420, width: 120, height: 16, type: 'bounce', strength: GAME_CONFIG.bounceBonus },
  { x: 820, y: 260, width: 100, height: 16, type: 'bounce', strength: GAME_CONFIG.bounceBonus + 220 },
];

const createCoins = (): Coin[] =>
  [
    { x: 120, y: 370, width: 24, height: 24 },
    { x: 400, y: 310, width: 24, height: 24 },
    { x: 680, y: 270, width: 24, height: 24 },
    { x: 260, y: 210, width: 24, height: 24 },
    { x: 500, y: 160, width: 24, height: 24 },
    { x: 820, y: 120, width: 24, height: 24 },
    { x: 360, y: 70, width: 24, height: 24 },
    { x: 680, y: 40, width: 24, height: 24 },
  ].map((coin, index) => ({
    ...coin,
    active: true,
    spinOffset: (index * Math.PI) / 4,
  }));

const GOAL: Goal = {
  x: 840,
  y: 20,
  width: 80,
  height: 100,
};

const rectsOverlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);

  const [status, setStatus] = useState<GameStatus>('idle');
  const [timeLeft, setTimeLeft] = useState<number>(GAME_CONFIG.timeLimit);
  const [coins, setCoins] = useState<Coin[]>(() => createCoins());
  const [collected, setCollected] = useState<number>(0);

  const platforms = useMemo(() => createPlatforms(), []);

  const playerRef = useRef<Player>({
    x: 40,
    y: 420,
    width: 36,
    height: 42,
    vx: 0,
    vy: 0,
    onGround: false,
  });

  const inputsRef = useRef({
    left: false,
    right: false,
    jump: false,
    jumpBuffer: false,
  });

  const timeRef = useRef<number>(GAME_CONFIG.timeLimit);

  const resetGame = useCallback(() => {
    playerRef.current = {
      x: 40,
      y: 420,
      width: 36,
      height: 42,
      vx: 0,
      vy: 0,
      onGround: false,
    };
    inputsRef.current = {
      left: false,
      right: false,
      jump: false,
      jumpBuffer: false,
    };
    setCoins(createCoins());
    setCollected(0);
    setTimeLeft(GAME_CONFIG.timeLimit);
    timeRef.current = GAME_CONFIG.timeLimit;
    lastTickRef.current = null;
  }, []);

  const startGame = useCallback(() => {
    resetGame();
    setStatus('running');
  }, [resetGame]);

  const stopGame = useCallback((nextStatus: GameStatus) => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    setStatus(nextStatus);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      switch (event.key.toLowerCase()) {
        case 'arrowleft':
        case 'a':
          inputsRef.current.left = true;
          break;
        case 'arrowright':
        case 'd':
          inputsRef.current.right = true;
          break;
        case 'arrowup':
        case 'w':
        case ' ':
          inputsRef.current.jump = true;
          inputsRef.current.jumpBuffer = true;
          break;
        default:
          break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case 'arrowleft':
        case 'a':
          inputsRef.current.left = false;
          break;
        case 'arrowright':
        case 'd':
          inputsRef.current.right = false;
          break;
        case 'arrowup':
        case 'w':
        case ' ':
          inputsRef.current.jump = false;
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawBackground = () => {
      // background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, GAME_CONFIG.height);
      gradient.addColorStop(0, '#1f2a63');
      gradient.addColorStop(1, '#0d0f1d');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);

      // decorative grids
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < GAME_CONFIG.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, GAME_CONFIG.height);
        ctx.stroke();
      }
      for (let y = 0; y < GAME_CONFIG.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(GAME_CONFIG.width, y);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawPlatforms = () => {
      platforms.forEach((platform) => {
        if (platform.type === 'solid') {
          ctx.fillStyle = '#4f46e5';
          ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
          ctx.fillStyle = '#6366f1';
          ctx.fillRect(platform.x, platform.y, platform.width, 6);
        } else {
          ctx.fillStyle = '#fb923c';
          ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
          ctx.fillStyle = '#f97316';
          ctx.fillRect(platform.x, platform.y, platform.width, 6);
        }
      });
    };

    const drawGoal = () => {
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(GOAL.x, GOAL.y, GOAL.width, GOAL.height);
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(GOAL.x, GOAL.y, GOAL.width, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(GOAL.x + 12, GOAL.y + 16, GOAL.width - 24, GOAL.height - 32);
    };

    const drawCoins = (time: number) => {
      coins.forEach((coin) => {
        if (!coin.active) return;
        const bounce = Math.sin(time * 4 + coin.spinOffset) * 4;
        const shimmer = (Math.sin(time * 6 + coin.spinOffset) + 1) / 2;
        const width = coin.width * (0.7 + shimmer * 0.3);

        ctx.save();
        ctx.translate(coin.x + coin.width / 2, coin.y + bounce);
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.ellipse(0, 0, width / 2, coin.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.ellipse(0, 0, (width / 2) * 0.6, (coin.height / 2) * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    };

    const drawPlayer = () => {
      const player = playerRef.current;
      ctx.save();
      ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
      ctx.fillStyle = '#f472b6';
      drawRoundedRect(
        ctx,
        -player.width / 2,
        -player.height / 2,
        player.width,
        player.height,
        12,
      );
      ctx.fill();

      ctx.fillStyle = '#1f2937';
      ctx.beginPath();
      ctx.arc(-6, -6, 5, 0, Math.PI * 2);
      ctx.arc(6, -6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const render = (time: number) => {
      drawBackground();
      drawPlatforms();
      drawGoal();
      drawCoins(time);
      drawPlayer();
    };

    render(0);
  }, [coins, platforms]);

  useEffect(() => {
    if (status !== 'running') {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const activeCoins = coins;
    const player = playerRef.current;

    const update = (timestamp: number) => {
      if (status !== 'running') return;

      if (lastTickRef.current === null) {
        lastTickRef.current = timestamp;
      }

      const delta = (timestamp - (lastTickRef.current ?? timestamp)) / 1000;
      lastTickRef.current = timestamp;

      timeRef.current -= delta;
      if (timeRef.current <= 0) {
        setTimeLeft(0);
        stopGame('lost');
        return;
      }
      setTimeLeft(timeRef.current);

      const input = inputsRef.current;

      if (input.left === input.right) {
        player.vx = 0;
      } else if (input.left) {
        player.vx = -GAME_CONFIG.moveSpeed;
      } else if (input.right) {
        player.vx = GAME_CONFIG.moveSpeed;
      }

      player.vy += GAME_CONFIG.gravity * delta;
      player.vy = Math.min(player.vy, GAME_CONFIG.gravity);

      // Horizontal movement
      player.x += player.vx * delta;
      if (player.x < 0) {
        player.x = 0;
      }
      if (player.x + player.width > GAME_CONFIG.width) {
        player.x = GAME_CONFIG.width - player.width;
      }

      platforms.forEach((platform) => {
        const intersects = rectsOverlap(
          {
            x: player.x,
            y: player.y,
            width: player.width,
            height: player.height,
          },
          platform,
        );
        if (!intersects) return;

        if (player.vx > 0) {
          player.x = platform.x - player.width;
        } else if (player.vx < 0) {
          player.x = platform.x + platform.width;
        }
        player.vx = 0;
      });

      // Vertical movement
      player.y += player.vy * delta;
      player.onGround = false;

      if (player.y + player.height >= GAME_CONFIG.height) {
        player.y = GAME_CONFIG.height - player.height;
        player.vy = 0;
        player.onGround = true;
      }

      platforms.forEach((platform) => {
        const intersects = rectsOverlap(
          {
            x: player.x,
            y: player.y,
            width: player.width,
            height: player.height,
          },
          platform,
        );
        if (!intersects) return;

        const wasFalling = player.vy > 0;
        const wasJumping = player.vy < 0;

        if (wasFalling) {
          player.y = platform.y - player.height;
          player.vy = 0;
          player.onGround = true;
          if (platform.type === 'bounce') {
            player.vy = -(
              platform.strength ?? GAME_CONFIG.bounceBonus
            );
            player.onGround = false;
          }
        } else if (wasJumping) {
          player.y = platform.y + platform.height;
          player.vy = 0;
        }
      });

      // Jump handling
      if (input.jumpBuffer) {
        if (player.onGround) {
          player.vy = -GAME_CONFIG.jumpSpeed;
          player.onGround = false;
          input.jumpBuffer = false;
        }
      } else if (!input.jump) {
        input.jumpBuffer = false;
      }

      // Coin collection
      let newlyCollected = 0;
      const updatedCoins = activeCoins.map((coin) => {
        if (!coin.active) {
          return coin;
        }
        if (
          rectsOverlap(
            {
              x: player.x,
              y: player.y,
              width: player.width,
              height: player.height,
            },
            coin,
          )
        ) {
          newlyCollected += 1;
          return { ...coin, active: false };
        }
        return coin;
      });

      if (newlyCollected > 0) {
        setCoins(updatedCoins);
        setCollected((prev) => prev + newlyCollected);
      }

      // Goal check
      if (
        rectsOverlap(
          {
            x: player.x,
            y: player.y,
            width: player.width,
            height: player.height,
          },
          GOAL,
        )
      ) {
        stopGame('won');
        return;
      }

      // Respawn if falling
      if (player.y > GAME_CONFIG.height + 200) {
        player.x = 40;
        player.y = 420;
        player.vx = 0;
        player.vy = 0;
        player.onGround = false;
        timeRef.current = Math.max(0, timeRef.current - 5);
      }

      // Render
      const time = timestamp / 1000;
      ctx.clearRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
      const gradient = ctx.createLinearGradient(0, 0, 0, GAME_CONFIG.height);
      gradient.addColorStop(0, '#1f2a63');
      gradient.addColorStop(1, '#0d0f1d');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);

      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < GAME_CONFIG.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, GAME_CONFIG.height);
        ctx.stroke();
      }
      for (let y = 0; y < GAME_CONFIG.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(GAME_CONFIG.width, y);
        ctx.stroke();
      }
      ctx.restore();

      platforms.forEach((platform) => {
        if (platform.type === 'solid') {
          ctx.fillStyle = '#4f46e5';
          ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
          ctx.fillStyle = '#6366f1';
          ctx.fillRect(platform.x, platform.y, platform.width, 6);
        } else {
          ctx.fillStyle = '#fb923c';
          ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
          ctx.fillStyle = '#f97316';
          ctx.fillRect(platform.x, platform.y, platform.width, 6);
        }
      });

      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(GOAL.x, GOAL.y, GOAL.width, GOAL.height);
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(GOAL.x, GOAL.y, GOAL.width, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(GOAL.x + 12, GOAL.y + 16, GOAL.width - 24, GOAL.height - 32);

      updatedCoins.forEach((coin) => {
        if (!coin.active) return;
        const bounce = Math.sin(time * 4 + coin.spinOffset) * 4;
        const shimmer = (Math.sin(time * 6 + coin.spinOffset) + 1) / 2;
        const width = coin.width * (0.7 + shimmer * 0.3);
        ctx.save();
        ctx.translate(coin.x + coin.width / 2, coin.y + bounce);
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.ellipse(0, 0, width / 2, coin.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.ellipse(0, 0, (width / 2) * 0.6, (coin.height / 2) * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      ctx.save();
      ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
      ctx.fillStyle = '#f472b6';
      drawRoundedRect(
        ctx,
        -player.width / 2,
        -player.height / 2,
        player.width,
        player.height,
        12,
      );
      ctx.fill();
      ctx.fillStyle = '#1f2937';
      ctx.beginPath();
      ctx.arc(-6, -6, 5, 0, Math.PI * 2);
      ctx.arc(6, -6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      requestRef.current = requestAnimationFrame(update);
    };

    requestRef.current = requestAnimationFrame(update);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [coins, platforms, status, stopGame]);

  useEffect(() => {
    if (status !== 'running') {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      lastTickRef.current = null;
    }
  }, [status]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16">
        <header className="flex flex-col items-center justify-between gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur lg:flex-row">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Bun Run
            </h1>
            <p className="mt-3 max-w-xl text-lg text-slate-300">
              Dash across neon platforms, grab shimmering data coins, and rocket off
              bounce pads to reach the exit portal before the clock hits zero.
            </p>
          </div>
          <div className="flex items-center gap-6 rounded-2xl border border-white/10 bg-black/30 px-6 py-4 shadow-lg">
            <div className="text-center">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Time Left
              </p>
              <p className="text-3xl font-semibold text-cyan-300">
                {Math.max(0, timeLeft).toFixed(1)}s
              </p>
            </div>
            <div className="h-12 w-px bg-white/10" aria-hidden />
            <div className="text-center">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Coins
              </p>
              <p className="text-3xl font-semibold text-amber-300">
                {collected} / {coins.length}
              </p>
            </div>
          </div>
        </header>

        <main className="flex flex-col items-center gap-6">
          <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-2xl">
            <canvas
              ref={canvasRef}
              width={GAME_CONFIG.width}
              height={GAME_CONFIG.height}
              className="h-auto w-full"
            />
            <div className="pointer-events-none absolute inset-0 rounded-3xl border border-white/5 shadow-inner shadow-cyan-500/10" />

            {status !== 'running' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/80 backdrop-blur-sm">
                <h2 className="text-3xl font-semibold">
                  {status === 'idle' && 'Ready to Run?'}
                  {status === 'won' && 'Goal Reached!'}
                  {status === 'lost' && 'Out of Time!'}
                </h2>
                <p className="max-w-md text-center text-base text-slate-300">
                  {status === 'idle' &&
                    'Use arrow keys or WASD to move and jump. Bounce pads launch you higher and coins boost your score.'}
                  {status === 'won' &&
                    `You reached the exit with ${collected} coin${collected === 1 ? '' : 's'}!`}
                  {status === 'lost' &&
                    'Try to collect faster or find those bounce pads to reach the exit in time.'}
                </p>
                <button
                  onClick={startGame}
                  className="rounded-full bg-cyan-400 px-6 py-2 text-lg font-semibold text-slate-900 shadow-lg shadow-cyan-400/40 transition hover:bg-cyan-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                >
                  {status === 'idle' ? 'Start Run' : 'Play Again'}
                </button>
              </div>
            )}
          </div>

          <section className="grid w-full gap-6 text-sm text-slate-300 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-semibold text-white">Controls</h3>
              <p className="mt-2">
                Move with <span className="font-semibold text-white">A / D</span> or{' '}
                <span className="font-semibold text-white">◀︎ / ▶︎</span>. Jump with{' '}
                <span className="font-semibold text-white">W</span>,{' '}
                <span className="font-semibold text-white">▲</span>, or{' '}
                <span className="font-semibold text-white">Space</span>.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-semibold text-white">Bounce Pads</h3>
              <p className="mt-2">
                Glowing launch pads catapult you skyward. Chain them with platforms to
                reach hidden coin clusters and the exit gateway.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-semibold text-white">Win Condition</h3>
              <p className="mt-2">
                Dive into the cyan portal before the timer drains. Collecting every coin
                isn&apos;t required, but it maxes out your run score.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
