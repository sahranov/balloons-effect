"use client";

import { useEffect, useRef } from "react";

const STAGE_WIDTH = 1440;
const STAGE_HEIGHT = 800;
const BALLOON_COLUMNS = 9;
const BALLOON_ROWS = 7;
const BALLOON_WIDTH = 178;
const BALLOON_HEIGHT = 356;

const BALLOON_SOURCES = [
  "/assets/balloon-blue.png",
  "/assets/balloon-purple.png",
  "/assets/balloon-white.png",
] as const;

type Balloon = {
  imageIndex: number;
  x: number;
  startY: number;
  endY: number;
  width: number;
  height: number;
  delay: number;
  duration: number;
  sway: number;
  swayCycles: number;
  drift: number;
  curveX1: number;
  curveX2: number;
  looseX1: number;
  looseX2: number;
  liftX1: number;
  liftX2: number;
  phase: number;
  secondPhase: number;
  secondSway: number;
  secondSwayCycles: number;
  opacity: number;
};

type Wave = {
  balloons: Balloon[];
  startsAt: number;
};

function seededRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function cubicBezier(
  start: number,
  control1: number,
  control2: number,
  end: number,
  progress: number,
) {
  const remaining = 1 - progress;
  return (
    remaining * remaining * remaining * start +
    3 * remaining * remaining * progress * control1 +
    3 * remaining * progress * progress * control2 +
    progress * progress * progress * end
  );
}

function createBalloons(seed: number): Balloon[] {
  const random = seededRandom(seed);
  const count = BALLOON_COLUMNS * BALLOON_ROWS;
  const columnStep = STAGE_WIDTH / BALLOON_COLUMNS;

  return Array.from({ length: count }, (_, index) => {
    const column = (index * 5 + Math.floor(random() * 3)) % BALLOON_COLUMNS;
    const laneCenter = columnStep * (column + 0.5);
    const streamDepth = random() * 1_360 + random() * 420;
    const startY = STAGE_HEIGHT + 24 + streamDepth;
    const endY = -BALLOON_HEIGHT - 80 - random() * 520;
    const speed = 900 + random() * 260;
    const drift = (random() - 0.5) * 132;

    return {
      imageIndex: Math.floor(random() * BALLOON_SOURCES.length),
      x: laneCenter + (random() - 0.5) * 92,
      startY,
      endY,
      width: BALLOON_WIDTH,
      height: BALLOON_HEIGHT,
      delay: random() * 360 + random() * 140,
      duration: ((startY - endY) / speed) * 1_000,
      sway: 5 + random() * 13,
      swayCycles: 0.35 + random() * 0.7,
      drift,
      curveX1: (random() - 0.5) * 92,
      curveX2: drift + (random() - 0.5) * 86,
      looseX1: (random() - 0.5) * 22,
      looseX2: (random() - 0.5) * 18,
      liftX1: 0.16 + random() * 0.2,
      liftX2: 0.58 + random() * 0.24,
      phase: random() * Math.PI * 2,
      secondPhase: random() * Math.PI * 2,
      secondSway: 2 + random() * 6,
      secondSwayCycles: 0.9 + random() * 0.85,
      opacity: 0.9 + random() * 0.1,
    };
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function loadImages() {
  return Promise.all(
    BALLOON_SOURCES.map(
      (source) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = source;
        }),
    ),
  );
}

export function BalloonEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const playRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let disposed = false;
    let waveNumber = 0;
    let waves: Wave[] = [];

    const draw = (now: number) => {
      context.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

      waves = waves.filter((wave) => {
        let waveFinished = true;

        for (const balloon of wave.balloons) {
          const rawProgress =
            (now - wave.startsAt - balloon.delay) / balloon.duration;

          if (rawProgress < 0) {
            waveFinished = false;
            continue;
          }

          if (rawProgress >= 1) continue;
          waveFinished = false;

          const liftProgress = cubicBezier(
            0,
            balloon.liftX1,
            balloon.liftX2,
            1,
            rawProgress,
          );
          const pathDrift = cubicBezier(
            0,
            balloon.curveX1,
            balloon.curveX2,
            balloon.drift,
            rawProgress,
          );
          const swayEnvelope = Math.sin(Math.PI * rawProgress);
          const looseDrift =
            Math.sin(rawProgress * Math.PI + balloon.secondPhase) *
              balloon.looseX1 +
            Math.sin(rawProgress * Math.PI * 2.2 + balloon.phase) *
              balloon.looseX2 *
              swayEnvelope;
          const x =
            balloon.x +
            pathDrift +
            looseDrift +
            Math.sin(
              rawProgress * Math.PI * 2 * balloon.swayCycles + balloon.phase,
            ) *
              balloon.sway *
              swayEnvelope +
            Math.sin(
              rawProgress * Math.PI * 2 * balloon.secondSwayCycles +
                balloon.secondPhase,
            ) *
              balloon.secondSway *
              swayEnvelope;
          const y =
            balloon.startY +
            (balloon.endY - balloon.startY) * liftProgress;
          const rotation =
            Math.sin(rawProgress * Math.PI * 2 + balloon.phase) *
            0.022 *
            swayEnvelope;
          const enterAlpha = clamp((STAGE_HEIGHT - y + 18) / 170, 0, 1);
          const exitAlpha = clamp((y + balloon.height + 70) / 180, 0, 1);

          context.save();
          context.globalAlpha = balloon.opacity * enterAlpha * exitAlpha;
          context.translate(x, y);
          context.rotate(rotation);
          context.drawImage(
            imagesRef.current[balloon.imageIndex],
            -balloon.width / 2,
            0,
            balloon.width,
            balloon.height,
          );
          context.restore();
        }

        return !waveFinished;
      });

      if (waves.length === 0) {
        context.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
        animationFrameRef.current = null;
        return;
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    const play = () => {
      if (!imagesRef.current.length || disposed) return;

      waveNumber += 1;
      waves.push({
        balloons: createBalloons(Date.now() ^ (waveNumber * 1_013)),
        startsAt: performance.now(),
      });

      if (animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(draw);
      }
    };

    playRef.current = play;

    loadImages()
      .then((images) => {
        if (disposed) return;
        imagesRef.current = images;
      })
      .catch(() => {
        context.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
      });

    const replayFromKeyboard = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "r") play();
    };

    window.addEventListener("keydown", replayFromKeyboard);

    return () => {
      disposed = true;
      window.removeEventListener("keydown", replayFromKeyboard);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="balloon-layer"
      width={STAGE_WIDTH}
      height={STAGE_HEIGHT}
      role="button"
      tabIndex={0}
      aria-label="Запустить эффект воздушных шариков"
      onClick={() => playRef.current()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          playRef.current();
        }
      }}
    />
  );
}
