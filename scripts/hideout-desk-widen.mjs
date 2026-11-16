// =============================================================
// 돌린 책상(의자가 앞에 놓인 모습)을 옆으로 넓히기 — scripts/prepare-hideout-turn.mjs가 시트에서 자른 뒤 부릅니다.
// -------------------------------------------------------------
// 선생님 요청(2026년 11월): "책상 가로 길이가 옆으로 놓여 있을 때보다 더 짧게 나온 것 같아서" — 그림 AI가 그린 돌린 책상은
// 윗면이 가파른 사다리꼴(뒤 모서리가 앞모습 책상보다 좁음)이고 다리 사이를 의자가 다 가려, 옆모습 책상보다 짧은 탁자로 읽혔습니다.
// 의자는 그대로 두고 책상만 좌우로 n px씩 늘립니다(줄마다 끊어 가운데 · 오른쪽을 밀고, 벌어진 틈을 채움).
//   · 윗면 · 앞 띠(다리가 나오기 전 줄): 그 줄의 나무 칸 하나를 되풀이합니다. 나뭇결이 가로라 이음매가 보이지 않습니다.
//     자르는 칸은 테마마다 표(cuts)로 줍니다 — 비스듬한 윤곽 · 책 · 의자 등받이 · 금속 장식을 비켜 가는 칸(그림을 보고 잼).
//     칸 하나 대신 [[칸, 몫], …]으로 여럿을 주면 몫만큼 나눠 벌립니다(탐험가의 금속 장식 — 리벳 양옆을 벌려 리벳이 가운데에 남게).
//   · 다리가 있는 줄: 다리 안쪽 바깥선 바로 뒤에서 끊고 틈은 투명입니다(책상 밑으로 바닥이 보임). 의자가 다리에 붙어 그려져
//     바깥선을 나눠 쓰던 줄은 의자 쪽 테두리가 얇아지므로 잉크(그림의 바깥선 색)로 채우고, 의자 앞판이 다리 바깥선을 가린 줄은
//     가린 칸을 의자 쪽으로 보내고 다리 바깥선을 잉크로 되살립니다. 의자 테두리의 짧은 돌기(7줄 미만)는 걷습니다.
//   · 다리 아래 줄(의자 다리만): 투명 틈.
// 알파는 0 또는 255(시트에 반투명 점이 없음 — prepare-hideout-turn.mjs). 돌려주는 그림은 폭이 width + 2n입니다.
// =============================================================

const T_CHAIR = 5;   // 의자 쪽 테두리 두께(px) — 의자 다른 곳의 바깥선과 같은 굵기
const OPEN_ROWS = 7; // 의자 테두리에서 이 줄 수보다 짧게 튀어나온 곳은 걷음(등받이 아래 몇 줄만 보이는 방석 귀퉁이 따위)

function mode(values) {
  const counts = new Map();
  let best = null, bestCount = 0;
  for (const v of values) {
    const c = (counts.get(v) ?? 0) + 1;
    counts.set(v, c);
    if (c > bestCount) { best = v; bestCount = c; }
  }
  // 같은 수면 먼저 나온 값(파이썬 Counter.most_common과 같은 차례)
  if (best !== null) for (const [v, c] of counts) if (c === bestCount) return v;
  return best;
}

/**
 * @param {Buffer|Uint8Array} pixels RGBA(알파 0 또는 255), width × height
 * @param {{ L: Array<[number, Array<[number, number]>]>, R: Array<[number, Array<[number, number]>]> }} cuts
 *        윗면 · 앞 띠 줄의 자르는 칸 — [이 줄 앞까지(마지막은 Infinity), [[칸, 몫], …]]
 * @param {number} n 한쪽에 넓힐 px
 * @returns {{ pixels: Buffer, width: number, info: object }}
 */
export function widenTurnedDesk(pixels, width, height, cuts, n) {
  const W = width, H = height;
  const at = (x, y) => (y * W + x) * 4;
  const A = new Uint8Array(W * H), lum = new Int32Array(W * H);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const i = at(x, y);
    A[y * W + x] = pixels[i + 3] >= 128 ? 1 : 0;
    lum[y * W + x] = Math.floor((pixels[i] * 299 + pixels[i + 1] * 587 + pixels[i + 2] * 114) / 1000);
  }
  const op = (x, y) => x >= 0 && x < W && A[y * W + x] === 1;
  // 바깥선 색 — 아주 어두운 칸의 가운데 값(채널마다)
  const dark = [[], [], []];
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!A[y * W + x] || lum[y * W + x] >= 45) continue;
    const i = at(x, y);
    dark[0].push(pixels[i]); dark[1].push(pixels[i + 1]); dark[2].push(pixels[i + 2]);
  }
  const median = (list) => {
    const s = [...list].sort((a, b) => a - b), m = s.length >> 1;
    return s.length % 2 ? s[m] : Math.trunc((s[m - 1] + s[m]) / 2);
  };
  const ink = dark.map(median);
  const INK = new Uint8Array(W * H), EDGE = new Uint8Array(W * H), BODY = new Uint8Array(W * H);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const k = y * W + x;
    if (!A[k]) continue;
    const i = at(x, y);
    const dist = Math.sqrt((pixels[i] - ink[0]) ** 2 + (pixels[i + 1] - ink[1]) ** 2 + (pixels[i + 2] - ink[2]) ** 2);
    const warm = pixels[i] > pixels[i + 2] + 10;
    INK[k] = dist < 45 ? 1 : 0;                                                  // 바깥선(진한 밤색)
    EDGE[k] = dist < 70 || lum[k] < 60 || (lum[k] < 110 && warm) ? 1 : 0;        // 바깥선 + 둘레의 섞인 밤색 칸
    BODY[k] = INK[k] ? 0 : 1;                                                    // 바깥선이 아닌 속
  }
  const isEdge = (x, y) => x >= 0 && x < W && EDGE[y * W + x] === 1;
  const isBody = (x, y) => x >= 0 && x < W && BODY[y * W + x] === 1;
  const first = [], last = [];
  for (let y = 0; y < H; y += 1) {
    let f = W, l = -1;
    for (let x = 0; x < W; x += 1) if (A[y * W + x]) { if (f === W) f = x; l = x; }
    first.push(f); last.push(l);
  }
  // 다리: 그림 아래쪽(60~78%) 줄에서 가장 흔한 바깥 끝
  const lo = Math.floor(H * 0.6), hi = Math.floor(H * 0.78);
  const legL0 = mode(first.slice(lo, hi)), legR0 = mode(last.slice(lo, hi));
  const startY = Math.floor(H * 0.4);
  const findRow = (from, test) => { for (let y = from; y < H; y += 1) if (test(y)) return y; throw Error("돌린 책상: 다리를 찾지 못했어요 — 그림을 확인하세요"); };
  const outerL = findRow(startY, (y) => !op(legL0 - 2, y));
  const outerR = findRow(startY, (y) => !op(legR0 + 2, y));
  let botL = -1, botR = -1;
  for (let y = 0; y < H; y += 1) { if (first[y] <= legL0 + 15) botL = y; if (last[y] >= legR0 - 15) botR = y; }
  const edgeL = (y, c0) => { if (!isBody(c0, y)) return null; let x = c0; while (x + 1 < W && isBody(x + 1, y)) x += 1; return x; };
  const edgeR = (y, c0) => { if (!isBody(c0, y)) return null; let x = c0; while (x - 1 >= 0 && isBody(x - 1, y)) x -= 1; return x; };
  const collect = (from, to, fn) => { const out = []; for (let y = from; y < to; y += 1) { const v = fn(y); if (v !== null) out.push(v); } return out; };
  const EL = mode(collect(outerL + 10, botL - 15, (y) => edgeL(y, legL0 + 14)));   // 왼쪽 다리 속의 오른쪽 끝
  const FR = mode(collect(outerR + 10, botR - 15, (y) => edgeR(y, legR0 - 14)));   // 오른쪽 다리 속의 왼쪽 끝
  if (EL === null || FR === null) throw Error("돌린 책상: 다리 속을 찾지 못했어요 — 그림을 확인하세요");
  const legTopL = findRow(outerL, (y) => { for (let x = legL0 + 10; x < EL - 1; x += 1) if (isBody(x, y)) return true; return false; });
  const legTopR = findRow(outerR, (y) => { for (let x = FR + 2; x < legR0 - 9; x += 1) if (isBody(x, y)) return true; return false; });
  // 다리 안쪽 바깥선이 끝나는 칸 — 다리와 의자 사이 틈이 보이는 줄에서 가장 흔한 자리
  const gapL = collect(legTopL + 5, botL - 12, (y) => { for (let x = EL + 1; x < EL + 16; x += 1) if (!op(x, y)) return x; return null; });
  const gapR = collect(legTopR + 5, botR - 12, (y) => { for (let x = FR - 1; x > FR - 16; x -= 1) if (!op(x, y)) return x + 1; return null; });
  const cutL0 = gapL.length ? mode(gapL) : EL + 10;
  const cutR0 = gapR.length ? mode(gapR) : FR - 9;
  const runEdge = (y, x, step) => { let k = 0; while (x >= 0 && x < W && isEdge(x, y)) { k += 1; x += step; } return [k, x]; };

  // 1차: 다리 줄마다 자르는 칸 · 의자 쪽 / 다리 쪽 잉크
  const plan = { L: new Map(), R: new Map() };
  for (const side of ["L", "R"]) {
    const legTop = side === "L" ? legTopL : legTopR, bot = side === "L" ? botL : botR;
    for (let y = legTop; y <= bot; y += 1) {
      let found = null;
      if (side === "L") { for (let x = EL + 1; x < cutL0 + 3; x += 1) if (!op(x, y)) { found = x; break; } }
      else { for (let x = FR - 1; x > cutR0 - 4; x -= 1) if (!op(x, y)) { found = x + 1; break; } }
      let cut = found ?? (side === "L" ? cutL0 : cutR0);
      let legInk = 0;
      if (found === null) {
        // 의자 앞판이 다리 바깥선을 가린 줄 — 의자 속 칸은 의자 쪽으로, 가려진 다리 바깥선은 잉크로 되살림
        if (side === "L") { while (cut > EL + 1 && op(cut - 1, y) && !isEdge(cut - 1, y)) cut -= 1; legInk = Math.max(0, cutL0 - cut); }
        else { while (cut < FR && op(cut, y) && !isEdge(cut, y)) cut += 1; legInk = Math.max(0, cut - cutR0); }
      }
      // 의자 쪽 테두리 — 의자 바깥선이 다리와 붙어 있던 줄은 얇아졌으므로 T_CHAIR까지 채움(한두 칸짜리 부스러기는 뺌)
      const [chairX, step] = side === "L" ? [cut, 1] : [cut - 1, -1];
      let chairInk = 0;
      if (op(chairX, y) && op(chairX + step, y) && op(chairX + 2 * step, y)) {
        const [k, xend] = runEdge(y, chairX, step);
        const closed = k > 0 && xend >= 0 && xend < W && !op(xend, y);   // 바깥선 뒤가 투명 — 이미 닫힌 테두리
        if (!closed) chairInk = k === 0 ? T_CHAIR : Math.max(0, T_CHAIR - k);
      }
      // 의자 쪽 바깥 끝(원래 그림 좌표) — 오른쪽은 큰 값, 왼쪽은 작은 값이 튀어나온 것
      let edge;
      if (side === "R") { let m = -1; for (let x = cutR0 - 30; x < cut; x += 1) if (op(x, y)) m = x; edge = (m >= 0 ? m + 1 : cut) + chairInk; }
      else { let m = -1; for (let x = cut; x < cutL0 + 30; x += 1) if (op(x, y)) { m = x; break; } edge = (m >= 0 ? m : cut) - chairInk; }
      plan[side].set(y, { cut, chairInk, legInk: Math.min(legInk, n >> 1), edge });
    }
  }
  // 2차: 의자 테두리의 짧은 돌기를 걷음 — 열림(침식 뒤 팽창), 줄여 주기만 함
  const h = OPEN_ROWS >> 1;
  for (const side of ["L", "R"]) {
    const sign = side === "R" ? 1 : -1;
    const ys = [...plan[side].keys()].sort((a, b) => a - b);
    const e = new Map(ys.map((y) => [y, sign * plan[side].get(y).edge]));
    const window = (map, y, pick) => { let v = null; for (let t = y - h; t <= y + h; t += 1) if (map.has(t)) v = v === null ? map.get(t) : pick(v, map.get(t)); return v; };
    const ero = new Map(ys.map((y) => [y, window(e, y, Math.min)]));
    const opn = new Map(ys.map((y) => [y, window(ero, y, Math.max)]));
    for (const y of ys) {
      const p = plan[side].get(y), over = e.get(y) - opn.get(y);
      if (over > 0 && p.chairInk > 0) p.chairInk = Math.max(0, p.chairInk - over);
    }
  }
  const topCuts = (side, y) => { for (const [rowEnd, list] of cuts[side]) if (y < rowEnd) return list; return cuts[side][cuts[side].length - 1][1]; };
  const NW = W + 2 * n;
  const out = Buffer.alloc(NW * H * 4);
  const inkPx = [ink[0], ink[1], ink[2], 255];
  for (let y = 0; y < H; y += 1) {
    const pieces = [];   // [칸, 끼울 점들(길이 4의 배열)]
    for (const side of ["L", "R"]) {
      const legTop = side === "L" ? legTopL : legTopR, bot = side === "L" ? botL : botR;
      if (y < legTop) {
        const list = topCuts(side, y);
        let total = 0;
        list.forEach(([c, part], i) => {
          const k = i === list.length - 1 ? n - total : Math.round(n * part);
          total += k;
          if (!op(c, y) && first[y] < c && c < last[y]) throw Error(`돌린 책상: ${y}줄 ${c}칸이 비어 있어요 — 자르는 칸을 다시 재세요`);
          const src = at(c, y), px = [pixels[src], pixels[src + 1], pixels[src + 2], pixels[src + 3]];
          pieces.push([c, Array.from({ length: k }, () => px)]);
        });
        continue;
      }
      const gap = Array.from({ length: n }, () => [0, 0, 0, 0]);
      let cut;
      if (y <= bot) {
        const p = plan[side].get(y);
        cut = p.cut;
        const [startInk, endInk] = side === "L" ? [p.legInk, p.chairInk] : [p.chairInk, p.legInk];
        for (let i = 0; i < startInk; i += 1) gap[i] = inkPx;
        for (let i = 0; i < endInk; i += 1) gap[n - 1 - i] = inkPx;
      } else {
        cut = side === "L" ? Math.min(cutL0, first[y]) : Math.max(cutR0, last[y] + 1);
      }
      pieces.push([cut, gap]);
    }
    pieces.sort((a, b) => a[0] - b[0]);
    let dst = y * NW * 4, prev = 0;
    const copy = (x0, x1) => { for (let x = x0; x < x1; x += 1) { const s = at(x, y); out[dst] = pixels[s]; out[dst + 1] = pixels[s + 1]; out[dst + 2] = pixels[s + 2]; out[dst + 3] = pixels[s + 3]; dst += 4; } };
    for (const [c, list] of pieces) {
      copy(prev, c);
      for (const px of list) { out[dst] = px[0]; out[dst + 1] = px[1]; out[dst + 2] = px[2]; out[dst + 3] = px[3]; dst += 4; }
      prev = c;
    }
    copy(prev, W);
  }
  return { pixels: out, width: NW, info: { legL0, legR0, legTopL, legTopR, botL, botR, EL, FR, cutL0, cutR0, ink } };
}
