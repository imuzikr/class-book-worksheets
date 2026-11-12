"use client";
// =============================================================
// 책 광장의 걷는 그림 한 칸 — 시트(288×288 · 3×3칸)에서 지금 칸을 캔버스에 그립니다
// -------------------------------------------------------------
// 방향 · 걷는 그림은 초당 여러 번 바뀌므로 React가 다시 그리지 않고, 부모(ReadingPlaza의 걸음 루프)가
// ref.current.show(방향, 칸)으로 곧바로 바꿉니다. 같은 칸이면 아무것도 안 합니다.
//
// 왜 <img>가 아니라 캔버스인가 — 그림이 도트(96px 칸)인데, 광장은 맵이 화면을 가득 채우느라 배율이 화면마다
// 어중간합니다(1.13배 · 0.87배 …). 도트 그림을 그런 배율로 그대로 키우면 뭉개지거나(부드럽게) 점의 굵기가
// 들쭉날쭉해집니다(pixelated). 그래서 **정수 배로 또렷하게 키운 뒤 필요한 크기로 부드럽게 줄입니다** —
// 점마다 굵기가 같고 가장자리만 살짝 다듬어져 어떤 배율에서도 깨끗합니다. 딱 정수 배면 다듬지 않습니다.
// 원본(96px 칸)보다 한참 작게 그릴 때는(작은 펫 · 폰) 반씩 줄여 갑니다.
// 그림을 못 받으면 onMissing을 부릅니다(부모가 예전 그림으로 바꿈).
// =============================================================
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { SPRITE_CELL, SPRITE_IDLE, plazaSpriteCell } from "@/lib/readingPlazaSprites";

// 임시 캔버스 둘 — 광장의 모든 그림이 함께 씁니다(한 번에 하나씩 그리므로). 하나는 정수 배로 키운 그림,
// 다른 하나는 많이 줄일 때 반씩 줄여 가며 번갈아 씁니다.
let scratchA = null;
let scratchB = null;

// 한 변이 size인 빈 캔버스로 맞추고 붓을 돌려줍니다(크기 · 뒤집기 · 그림을 모두 처음으로)
function blank(canvas, size) {
  if (canvas.width !== size || canvas.height !== size) { canvas.width = size; canvas.height = size; }
  const pen = canvas.getContext("2d");
  if (!pen) return null;
  pen.setTransform(1, 0, 0, 1, 0, 0);
  pen.clearRect(0, 0, size, size);
  return pen;
}

function paint(canvas, image, cell, cssSize) {
  const ratio = Math.min(3, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
  const target = Math.max(1, Math.round(cssSize * ratio));
  const ctx = blank(canvas, target);
  if (!ctx || !image) return;
  if (!scratchA) { scratchA = document.createElement("canvas"); scratchB = document.createElement("canvas"); }
  // ① 정수 배로 또렷하게 키웁니다(점마다 같은 굵기)
  let size = SPRITE_CELL * Math.max(1, Math.ceil(target / SPRITE_CELL));
  let from = scratchA;
  const pen = blank(from, size);
  if (!pen) return;
  pen.imageSmoothingEnabled = false;
  // 왼쪽을 볼 때는 오른쪽 그림을 좌우로 뒤집어 그립니다
  if (cell.mirror) pen.setTransform(-1, 0, 0, 1, size, 0);
  pen.drawImage(image, cell.col * SPRITE_CELL, cell.row * SPRITE_CELL, SPRITE_CELL, SPRITE_CELL, 0, 0, size, size);
  // ② 절반 아래로 줄여야 하면(작은 펫 · 작은 화면) 반씩 줄여 갑니다 — 한 번에 많이 줄이면 점을 건너뛰어 거칠어집니다
  //    (브라우저마다 줄이는 솜씨가 달라, 어디서나 같게 보이도록)
  while (size % 2 === 0 && size >= target * 2) {
    const to = from === scratchA ? scratchB : scratchA;
    const next = size / 2;
    const step = blank(to, next);
    if (!step) break;
    step.imageSmoothingEnabled = true;
    step.drawImage(from, 0, 0, size, size, 0, 0, next, next);
    from = to;
    size = next;
  }
  // ③ 필요한 크기로 — 딱 맞으면 다듬지 않습니다
  ctx.imageSmoothingEnabled = size !== target;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(from, 0, 0, size, size, 0, 0, target, target);
}

// src — 시트 주소 · size — 한 칸을 화면에 그릴 한 변(px) · style — 놓을 자리(발 기준점을 뺀 left/top)
const PlazaSprite = forwardRef(function PlazaSprite({ src, size, className = "", style, onMissing }, ref) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const shown = useRef({ facing: "down", frame: SPRITE_IDLE });
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const missingRef = useRef(onMissing);
  missingRef.current = onMissing;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) paint(canvas, imageRef.current, plazaSpriteCell(shown.current.facing, shown.current.frame), sizeRef.current);
  }, []);

  useImperativeHandle(ref, () => ({
    show(facing, frame) {
      if (shown.current.facing === facing && shown.current.frame === frame) return;
      shown.current = { facing, frame };
      draw();
    },
  }), [draw]);

  useEffect(() => {
    let alive = true;
    imageRef.current = null;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => { if (alive) { imageRef.current = image; draw(); } };
    image.onerror = () => { if (alive) missingRef.current?.(); };
    image.src = src;
    return () => { alive = false; };
  }, [src, draw]);

  // 크기가 바뀌면(창 크기 · 펫의 단계) 지금 칸을 새 크기로 다시 그립니다
  useEffect(() => { draw(); }, [size, draw]);

  return <canvas ref={canvasRef} className={`plaza-sprite ${className}`.trim()} style={{ width: size, height: size, ...style }} aria-hidden="true" />;
});

export default PlazaSprite;
