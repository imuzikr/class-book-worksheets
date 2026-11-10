# 캐릭터 '십이지' 묶음(수련생 — 첫 등급) 그림 만들기 — 흰 바탕 PNG 10장 → 투명 640×640 WebP 10장.
#
#   python3 -I scripts/prepare-zodiac-art.py <풀어 둔 PNG 폴더> <내보낼 폴더>
#   (입력: 사용자 제공 zodiac-martial-arts.zip의 01-rat.png … 10-pig.png, 1024×1024 · 흰 바탕)
#   (출력: zodiac-01.webp … zodiac-10.webp → public/reading-journey/ 에 넣음)
#   numpy · Pillow만 씁니다(설치된 파이썬 그대로). 한 장에 15초쯤, 넷씩 함께 돌립니다.
#
# 왜 손이 가나: 원본이 흰 바탕인데 도복 · 털도 흰색에 가깝고, 둘레에 노란 '기운'(빛 번짐 · 번개 · 불꽃)이
# 그려져 있어 '흰색만 지우기'로는 도복이 뚫리고 번짐이 남습니다(어두운 독서 맵 · 친구 목록에서 흰 테로 보임).
#   1단계  바깥 흰 바탕에서 출발해 색이 매끈하게 이어지는 곳(흰 바탕 · 빛 번짐 · 그림자)만 따라 들어간 곳 = 확실한 배경.
#   2단계  확실한 캐릭터 씨앗(털 · 띠 · 그늘진 도복처럼 밝지 않은 칸, 깊은 안쪽)과 배경 씨앗을 동시에 퍼뜨려
#          '가장 센 윤곽'에서 만나게 합니다(분수령). 빛을 받아 노랗게 물든 도복 가장자리도 윤곽 안쪽이라 지켜지고,
#          번개 · 불꽃 조각은 두 윤곽 사이에 끼어 배경 쪽으로 갑니다.
#   3단계  가는 밝은 줄(번개 끝) · 떨어진 부스러기를 걷고, 가장자리 색을 안쪽 색으로 채워 흰 테를 없앱니다.
#   그래도 남는 곳(용의 민트빛 번짐 · 창날, 쥐 바지 옆 번짐 주머니)은 아래 PER_IMAGE에 눈으로 잰 점 · 다각형으로 적었습니다.
# 틀(640): 열 장 모두 같은 배율(가운데 960px 창 → 640)이라 그린 크기 그대로 견줘지고, 발끝은 아래에서 10px 위.
import sys, os, glob, heapq
from concurrent.futures import ProcessPoolExecutor
import numpy as np
from PIL import Image, ImageDraw


def box3(a):
    p = np.pad(a, ((1, 1), (1, 1), (0, 0)) if a.ndim == 3 else ((1, 1), (1, 1)), mode="edge")
    h, w = a.shape[:2]
    return sum(p[dy:dy + h, dx:dx + w] for dy in range(3) for dx in range(3)) / 9.0


def shift(m, dy, dx, fill=False):
    out = np.full_like(m, fill)
    h, w = m.shape
    ys, yd = (slice(0, h - dy), slice(dy, h)) if dy >= 0 else (slice(-dy, h), slice(0, h + dy))
    xs, xd = (slice(0, w - dx), slice(dx, w)) if dx >= 0 else (slice(-dx, w), slice(0, w + dx))
    out[yd, xd] = m[ys, xs]
    return out


def dilate(m, n=1):
    for _ in range(n):
        m = m | shift(m, 1, 0) | shift(m, -1, 0) | shift(m, 0, 1) | shift(m, 0, -1)
    return m


def erode(m, n=1):
    return ~dilate(~m, n)


def grow(seed, allowed, step=24):
    """seed에서 allowed 안으로만 퍼지기(4방향) — 더 안 늘 때까지."""
    cur = seed & allowed
    while True:
        nxt = cur
        for _ in range(step):
            nxt = (nxt | shift(nxt, 1, 0) | shift(nxt, -1, 0) | shift(nxt, 0, 1) | shift(nxt, 0, -1)) & allowed
        if (nxt != cur).sum() == 0:
            return nxt
        cur = nxt


def components(mask):
    """연결 덩어리 번호 매기기(4방향, 최솟값 퍼뜨리기 + 건너뛰기)."""
    h, w = mask.shape
    lab = np.where(mask, np.arange(h * w).reshape(h, w), h * w)
    big = h * w
    while True:
        old = lab
        m = lab
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            s = shift(lab, dy, dx, fill=big)
            m = np.minimum(m, np.where(mask, s, big))
        lab = np.where(mask, m, big)
        flat = lab.ravel()
        idx = np.where(flat < big, flat, 0)
        jumped = np.where(flat < big, flat[idx], big).reshape(h, w)
        lab = np.where(mask, np.minimum(lab, jumped), big)
        if np.array_equal(lab, old):
            return lab


def step_strength(rgb, k=3):
    """좌우 · 위아래 · 대각선으로 k칸씩의 평균 색 차이(채널 중 가장 큰 것) — 흐린 윤곽도 잡고 잡티는 눌러 줌."""
    h, w, _ = rgb.shape
    pad = np.pad(rgb, ((k + 1, k + 1), (k + 1, k + 1), (0, 0)), mode="edge")

    def mean_at(dy, dx):
        acc = 0.0
        for i in range(1, k + 1):
            acc = acc + pad[k + 1 + dy * i:k + 1 + dy * i + h, k + 1 + dx * i:k + 1 + dx * i + w]
        return acc / k

    best = np.zeros((h, w))
    for dy, dx in ((0, 1), (1, 0), (1, 1), (1, -1)):
        d = np.abs(mean_at(dy, dx) - mean_at(-dy, -dx)).max(2)
        best = np.maximum(best, d)
    return best


def watershed(grad, fg, bg):
    """씨앗(fg=1, bg=2)에서 동시에 퍼지되, 윤곽이 약한 칸부터 차례로 — 둘은 가장 센 윤곽에서 만납니다."""
    h, w = grad.shape
    lab = np.zeros(h * w, np.int8)
    lab[fg.ravel()] = 1
    lab[bg.ravel()] = 2
    g = np.minimum(grad, 255).astype(np.int32).ravel()
    heap = []
    cnt = 0
    edge_seed = (dilate(fg | bg, 1) & ~(fg | bg))
    for idx in np.flatnonzero(edge_seed.ravel()):
        y, x = divmod(int(idx), w)
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w:
                l = lab[ny * w + nx]
                if l:
                    heapq.heappush(heap, (g[idx], cnt, int(idx), int(l))); cnt += 1
                    break
    while heap:
        _, _, idx, l = heapq.heappop(heap)
        if lab[idx]:
            continue
        lab[idx] = l
        y, x = divmod(idx, w)
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w:
                j = ny * w + nx
                if not lab[j]:
                    heapq.heappush(heap, (g[j], cnt, j, l)); cnt += 1
    return lab.reshape(h, w) == 1


# 그림마다 눈으로 확인한 뒤 적은 것(원본 1024px 좌표):
#  bg_dots — 확실한 배경 점(x, y, 반지름): 캐릭터에 갇힌 빛 번짐 주머니. 경계는 분수령이 윤곽을 따라 긋습니다.
#  bg_polygons — 꼭 배경인 곳 · fg_polygons — 꼭 캐릭터인 곳(꼭짓점을 잰 다각형)
#  light_clear_polygons — 이 구역 안에서는 아주 옅은 색(크림빛 번짐)을 바깥에서부터 막 없이 걷음
#  protect_subject_colors — 깊은 안쪽의 그늘진 색을 '캐릭터 색'으로 지킬지(용은 진한 민트빛 번짐이 그 색이라 끔)
#  color_clear — 번짐 색이 캐릭터 색과 뚜렷이 달라(용: 민트 ↔ 청록) 색만으로 80px 안까지 걷어도 될 때
PER_IMAGE = {
    "01-rat": {"bg_dots": [(705, 650, 10), (722, 690, 8), (738, 670, 5)]},
    "05-dragon": {"protect_subject_colors": False, "color_clear": True,
                  "bg_dots": [(175, 510, 12), (215, 600, 10), (240, 690, 10), (220, 750, 8), (730, 432, 8), (742, 420, 6), (760, 615, 10),
                              (325, 450, 6), (338, 448, 5), (282, 680, 7), (300, 697, 5)],
                  "bg_polygons": [[(775, 575), (805, 575), (805, 650), (765, 650), (765, 610)]],
                  "light_clear_polygons": [[(100, 380), (390, 380), (390, 500), (330, 520), (300, 640), (330, 640), (335, 740), (100, 800)],
                                           [(730, 600), (810, 600), (810, 670), (730, 670)]],
                  # 창날: 밝은 왼쪽 면이 흰 바탕과 거의 같은 색이라 1단계에서 배경으로 섞임 — 꼭짓점을 재어 지킴
                  "fg_polygons": [[(856, 76), (858, 88), (857, 140), (851, 232), (800, 230), (782, 212)]]},
}


def polygon_mask(w, h, polys):
    im = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(im)
    for poly in polys:
        d.polygon(poly, fill=255)
    return np.asarray(im) > 0


def matte(src, conf):
    """원본 → 캐릭터 칸(참 · 거짓) 배열."""
    rgb = np.asarray(Image.open(src).convert("RGB")).astype(np.float64)
    h, w, _ = rgb.shape
    sm = box3(rgb)
    grad = step_strength(rgb)
    mx, mn = sm.max(2), sm.min(2)
    # 1단계: 바깥 흰 바탕에서 매끈한 곳(윤곽 세기 9 미만)만 따라 들어간 곳 = 확실한 배경
    white = mn >= 244
    glow = (mx >= 244) & (mn >= 140)
    shadow = ((mx - mn) <= 16) & (mx >= 175)
    allowed = white | ((glow | shadow) & (grad < 9.0))
    border = np.zeros((h, w), bool); border[0] = border[-1] = True; border[:, 0] = border[:, -1] = True
    bg = grow(border & white, allowed)
    # 캐릭터에 둘러싸인 빈틈(팔과 몸 사이 · 꼬리 고리 안) — 흰 바탕이 절반 넘는 큰 덩어리만 배경으로
    rest = allowed & ~bg
    lab = components(rest)
    ids, counts = np.unique(lab[rest], return_counts=True)
    for i, c in zip(ids, counts):
        if c < 300:
            continue
        part = lab == i
        if float(white[part].mean()) >= 0.5:
            bg |= part
    bg1 = bg
    # 이 그림의 빛 번짐 색(윤곽에서 6px 떨어진 배경에서 배움, 색 방향 40×40 칸) + 따뜻한 빛의 공통 성질(빨강이 255 가까이)
    T = np.clip(255.0 - sm, 0, None)
    tmax = T.max(2)
    norm = np.sqrt((T ** 2).sum(2)) + 1e-9
    dR, dG = T[..., 0] / norm, T[..., 1] / norm
    NB = 40
    bR = np.clip((dR * NB).astype(int), 0, NB - 1); bG = np.clip((dG * NB).astype(int), 0, NB - 1)
    sample = erode(bg1, 6) & (mx >= 245) & (tmax >= 12) & (tmax <= 120)
    hist = np.zeros((NB, NB)); np.add.at(hist, (bR[sample], bG[sample]), 1)
    model = hist >= max(20, 0.0005 * sample.sum())
    model = model | np.roll(model, 1, 0) | np.roll(model, -1, 0) | np.roll(model, 1, 1) | np.roll(model, -1, 1)
    warm = (dR <= 0.09) & (dG <= 0.45) & (sm[..., 0] >= 248) & (tmax >= 8) & (tmax <= 110)
    # 바닥 그림자: 캐릭터 아래 80px 띠 안의 회색, 배경에서 매끈하게(윤곽 30 미만) 이어진 곳
    rows = np.nonzero((~bg1).any(1))[0]
    ybot = rows.max() if len(rows) else h - 1
    zone = np.zeros((h, w), bool); zone[max(0, ybot - 80):, :] = True
    neutral = ((mx - mn) <= 18) & (mx >= 110) & (mx <= 250)
    shadow_seed = grow(bg1, bg1 | (zone & neutral & (grad < 30))) & ~bg1
    # 2단계 씨앗 — 캐릭터: 밝지 않은 칸 또는 (배경에서 25px 넘게 안쪽이면서 색이 있는 칸)
    far = ~dilate(bg1, 25)
    # 깊은 안쪽의 그늘진 칸에 흔한 색 방향은 '캐릭터 색' — 번짐과 겹쳐도 씨앗에서 빼지 않음(염소 도복)
    deep = far & (~bg1) & (tmax >= 6) & (mx < 235)
    shist = np.zeros((NB, NB)); np.add.at(shist, (bR[deep], bG[deep]), 1)
    subjcol = shist >= max(30, 0.002 * deep.sum())
    subjcol = subjcol | np.roll(subjcol, 1, 0) | np.roll(subjcol, -1, 0) | np.roll(subjcol, 1, 1) | np.roll(subjcol, -1, 1)
    if not conf.get("protect_subject_colors", True):
        subjcol[:] = False
    glowdir = model[bR, bG] & (tmax <= 150) & ~subjcol[bR, bG]
    warm_only = warm & ~subjcol[bR, bG]
    fg_seed = (~bg1) & ~shadow_seed & ~glowdir & ~warm_only & ((mx < 228) | (far & ((mx < 244) | (tmax >= 20))))
    fg_seed &= ~(zone & ((mx - mn) < 40) & (mx >= 150) & ~far)   # 바닥 띠의 옅은 색(따뜻한 회색 그림자)은 씨앗이 아님
    fg_seed = erode(fg_seed, 2)                                   # 불꽃 속 작은 불티 같은 점은 씨앗에서 뺌
    bg_seed = bg1 | shadow_seed
    yy, xx = np.mgrid[0:h, 0:w]
    keep_poly = np.zeros((h, w), bool)
    if conf.get("fg_polygons"):
        keep_poly = polygon_mask(w, h, conf["fg_polygons"])
        fg_seed |= keep_poly
        bg_seed &= ~keep_poly
    if conf.get("bg_polygons"):
        bpoly = polygon_mask(w, h, conf["bg_polygons"])
        bg_seed |= bpoly
        fg_seed &= ~bpoly
    for (cx, cy, r) in conf.get("bg_dots", []):
        dot = (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r
        bg_seed |= dot
        fg_seed &= ~dot
    subj = watershed(grad, fg_seed, bg_seed) | keep_poly
    if conf.get("color_clear"):
        subj = ~grow(~subj, ~subj | ((glowdir | (tmax < 10)) & ~keep_poly & dilate(~subj, 80)))
    if conf.get("light_clear_polygons"):
        pale = (mx >= 232) & (tmax <= 45) & polygon_mask(w, h, conf["light_clear_polygons"]) & ~keep_poly
        subj = ~grow(~subj, ~subj | pale)
    # 3단계: 가는 밝은 줄(번개 끝 · 수염처럼 5px보다 가는 것) — 바깥 10px 안의 밝은 칸만, 열기(깎았다 되살리기)로 걷음
    bright = (mx >= 235) & (tmax <= 60)
    opened = dilate(erode(subj, 2), 2)
    thin = subj & ~opened & bright & dilate(~subj, 10)
    subj = (subj & ~thin) | keep_poly
    # 떨어진 부스러기: 가장 큰 덩어리의 2%(그리고 400칸) 넘는 것만 남김
    lab2 = components(subj)
    ids2, counts2 = np.unique(lab2[subj], return_counts=True)
    keep = np.zeros_like(subj)
    biggest = counts2.max() if len(counts2) else 0
    for i, c in zip(ids2, counts2):
        if c >= max(400, 0.02 * biggest):
            keep |= lab2 == i
    return rgb, keep


def finish(rgb, subj):
    """가장자리: 1px 안으로 물리고 부드럽게 · 테두리 3px의 색은 안쪽 색으로 채워 흰 · 노란 테가 안 남게."""
    core = erode(subj, 1)
    alpha = core.astype(np.float64)
    a3 = np.pad(alpha, 1, mode="constant")
    alpha = sum(a3[dy:dy + alpha.shape[0], dx:dx + alpha.shape[1]] * wgt for (dy, dx), wgt in
                {(0, 0): .0625, (0, 1): .125, (0, 2): .0625, (1, 0): .125, (1, 1): .25, (1, 2): .125, (2, 0): .0625, (2, 1): .125, (2, 2): .0625}.items())
    inner = erode(subj, 3)
    col = rgb.copy()
    known = inner.copy()
    acc = np.where(known[..., None], col, 0.0)
    for _ in range(6):
        s = np.zeros_like(acc); n = np.zeros(known.shape)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            k = shift(known, dy, dx)
            s += np.stack([shift(acc[..., c], dy, dx, fill=0.0) for c in range(3)], -1) * k[..., None]
            n += k
        newly = (~known) & (n > 0)
        acc[newly] = s[newly] / n[newly][:, None]
        known = known | newly
    band = subj & ~inner
    col[band] = acc[band]
    out = np.dstack([np.clip(col, 0, 255), np.clip(alpha * 255, 0, 255)]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


WIN, X0, OUT, FOOT = 960, 32, 640, 15


def frame(im):
    """1024px 투명 → 640×640: 가로는 원본 가운데(32~992), 세로는 발끝이 창 아래에서 15px(640에서 10px) 위."""
    a = np.asarray(im)[..., 3]
    ys, _ = np.nonzero(a > 8)
    y0 = int(ys.max()) + FOOT - WIN
    crop = im.crop((X0, y0, X0 + WIN, y0 + WIN))                     # 밖은 투명으로 채워짐
    small = crop.convert("RGBa").resize((OUT, OUT), Image.LANCZOS).convert("RGBA")   # 투명도를 곱한 채로 줄여 테가 안 생김
    arr = np.asarray(small).copy()
    al = arr[..., 3]
    al[al >= 250] = 255
    arr[al <= 3] = 0
    return Image.fromarray(arr, "RGBA")


def one(job):
    src, dst_dir = job
    key = os.path.basename(src).rsplit(".", 1)[0]
    rgb, subj = matte(src, PER_IMAGE.get(key, {}))
    out = frame(finish(rgb, subj))
    path = os.path.join(dst_dir, f"zodiac-{key[:2]}.webp")
    out.save(path, "WEBP", quality=85, method=6)
    return f"{os.path.basename(src)} → {os.path.basename(path)} ({os.path.getsize(path) // 1024}KB)"


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("쓰는 법: python3 -I scripts/prepare-zodiac-art.py <풀어 둔 PNG 폴더> <내보낼 폴더>")
    src_dir, dst_dir = sys.argv[1], sys.argv[2]
    files = sorted(glob.glob(os.path.join(src_dir, "[0-9][0-9]-*.png")))
    if len(files) != 10:
        sys.exit(f"PNG 10장(01-rat.png … 10-pig.png)이 있어야 합니다 — 지금 {len(files)}장")
    os.makedirs(dst_dir, exist_ok=True)
    with ProcessPoolExecutor(max_workers=4) as pool:
        for line in pool.map(one, [(f, dst_dir) for f in files]):
            print(line)
