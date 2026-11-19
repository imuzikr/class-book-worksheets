# 캐릭터 레벨 옷(Lv.7 탐험가 옷 · Lv.10 마스터 옷) 그림 넣기 — 선생님이 주신 묶음 둘 → public/ (2026년 11월)
#
#   python3 -I scripts/prepare-outfit-art.py <옷 묶음 폴더> <수련생 금빛 묶음 폴더> <저장소의 public 폴더>
#   (옷 묶음: bookbom-character-outfits-all.zip — 세 묶음 × 10 × Lv.7 · Lv.10, 카드 그림 60 + 걷는 그림 60)
#   (금빛 묶음: bookbom-zodiac-gold-lv07-lv10.zip — 수련생 10 × Lv.7 · Lv.10에 금빛 기운을 그려 넣은 판, 카드 20 + 걷는 그림 20)
#   두 ZIP을 저마다 새 빈 폴더에 풀어 그 폴더를 넘깁니다(안의 public/를 읽음). numpy · Pillow만 씁니다. 1분쯤.
#
# 무엇을 하나:
#   - 무도가(animal) · 영웅(fantasy): 옷 묶음의 파일을 바이트 그대로 복사합니다
#     (카드 그림은 손실 WebP 70~85KB, 걷는 그림은 무손실 WebP).
#   - 수련생(zodiac): 금빛 묶음을 씁니다(선생님 요청 — 기본 수련생 그림처럼 둘레에 금빛 기운이 있게).
#     먼저 금빛 묶음의 캐릭터가 옷 묶음과 같은 그림인지 확인합니다 — 옷 묶음에서 불투명한 칸의 색 차이 평균이 2 미만이고,
#     옷 묶음에 있던 칸이 사라지지 않았을 때만(기운은 캐릭터 뒤 · 둘레에 더해질 뿐). 아니면 멈춥니다.
#       · 카드 그림은 금빛 묶음이 무손실(한 장 155~317KB)이라 WebP 품질 85로 다시 굽습니다(한 장 54~92KB —
#         다른 카드 그림과 비슷한 무게 · 2배로 키워 봐도 원본과 구별되지 않음. 상단바 · 친구 목록이 이 그림을 작게 줄여 쓰는데 한 장이 300KB면 무거움).
#       · 걷는 그림은 무손실 그대로 복사합니다(도트 그림이라 손실 압축하면 테두리가 뭉개짐).
#   - 모든 파일의 크기(카드 640×640 · 걷는 그림 288×288)와 투명 바탕(RGBA)을 확인하고, 틀 가장자리에 그림이 닿아
#     잘린 곳이 없는지(카드 둘레 4px · 걷는 그림 칸 경계가 모두 투명) 봅니다. 하나라도 어긋나면 멈춥니다.
#   - 기본 옷 그림(zodiac-01.webp …)은 건드리지 않습니다.
import sys, os, shutil
from concurrent.futures import ProcessPoolExecutor
import numpy as np
from PIL import Image

STYLES = ("zodiac", "animal", "fantasy")
STAGES = ("lv07", "lv10")
PORTRAIT, SHEET, CELL = 640, 288, 96
QUALITY = 85


def name(style, number, stage):
    return f"{style}-{number:02d}-{stage}.webp"


def rgba(path, size):
    im = Image.open(path)
    if im.size != (size, size):
        sys.exit(f"{path}: {im.size[0]}×{im.size[1]} — {size}×{size}이어야 합니다")
    if im.mode != "RGBA":
        sys.exit(f"{path}: 투명 바탕(RGBA)이 아닙니다 — {im.mode}")
    return np.asarray(im.convert("RGBA")).astype(np.float64)


def check_edges(path, arr, kind):
    a = arr[..., 3]
    if kind == "portrait":
        edge = np.concatenate([a[:4].ravel(), a[-4:].ravel(), a[:, :4].ravel(), a[:, -4:].ravel()])
    else:
        lines = [k * CELL + d for k in range(3) for d in (0, CELL - 1)]
        edge = np.concatenate([a[lines, :].ravel(), a[:, lines].ravel()])
    if edge.max() > 0:
        sys.exit(f"{path}: 그림이 틀 가장자리에 닿아 잘립니다")


def same_character(plain_path, gold_path, size):
    plain, gold = rgba(plain_path, size), rgba(gold_path, size)
    core = plain[..., 3] >= 250
    diff = float(np.abs(plain[..., :3] - gold[..., :3])[core].mean())
    lost = int(((plain[..., 3] - gold[..., 3]) > 40).sum())
    if diff >= 2 or lost:
        sys.exit(f"{gold_path}: 옷 묶음의 캐릭터와 다른 그림입니다(색 차이 {diff:.2f} · 사라진 칸 {lost})")
    return gold


def zodiac_portrait(job):
    plain_path, gold_path, out_path = job
    arr = same_character(plain_path, gold_path, PORTRAIT)
    check_edges(gold_path, arr, "portrait")
    Image.open(gold_path).convert("RGBA").save(out_path, "WEBP", quality=QUALITY, method=6)
    return f"{os.path.basename(out_path)} ← 금빛 묶음 ({os.path.getsize(gold_path) // 1024}KB → {os.path.getsize(out_path) // 1024}KB)"


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit("쓰는 법: python3 -I scripts/prepare-outfit-art.py <옷 묶음 폴더> <수련생 금빛 묶음 폴더> <저장소의 public 폴더>")
    outfit_dir, gold_dir, public_dir = (os.path.abspath(p) for p in sys.argv[1:4])
    journey_out = os.path.join(public_dir, "reading-journey")
    sprite_out = os.path.join(public_dir, "reading-plaza", "sprites")
    for d in (journey_out, sprite_out):
        if not os.path.isdir(d):
            sys.exit(f"{d}: 저장소의 public 폴더가 아닙니다")
    src = lambda root, sub, f: os.path.join(root, "public", sub, f)

    # 빠진 파일이 없는지 먼저 — 하나라도 없으면 아무것도 쓰지 않고 멈춥니다.
    jobs, copies = [], []
    for style in STYLES:
        for number in range(1, 11):
            for stage in STAGES:
                f = name(style, number, stage)
                portrait = src(outfit_dir, "reading-journey", f)
                sheet = src(outfit_dir, "reading-plaza/sprites", f)
                if style == "zodiac":
                    gold_portrait = src(gold_dir, "reading-journey", f)
                    gold_sheet = src(gold_dir, "reading-plaza/sprites", f)
                    need = (portrait, sheet, gold_portrait, gold_sheet)
                    jobs.append((portrait, gold_portrait, os.path.join(journey_out, f)))
                    copies.append((gold_sheet, os.path.join(sprite_out, f), "sheet", sheet))
                else:
                    need = (portrait, sheet)
                    copies.append((portrait, os.path.join(journey_out, f), "portrait", None))
                    copies.append((sheet, os.path.join(sprite_out, f), "sheet", None))
                missing = [p for p in need if not os.path.isfile(p)]
                if missing:
                    sys.exit("빠진 파일: " + ", ".join(missing))

    for path, out, kind, plain in copies:
        size = PORTRAIT if kind == "portrait" else SHEET
        arr = same_character(plain, path, size) if plain else rgba(path, size)
        check_edges(path, arr, kind)
        shutil.copyfile(path, out)
    print(f"그대로 복사 {len(copies)}장 (무도가 · 영웅 카드 40 · 걷는 그림 60 — 수련생 걷는 그림 20은 금빛 묶음)")
    with ProcessPoolExecutor(max_workers=4) as pool:
        for line in pool.map(zodiac_portrait, jobs):
            print(line)
    print(f"끝 — 모두 {len(copies) + len(jobs)}장")
