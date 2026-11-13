# 책 광장 '교실' 그림 만들기 — 선생님이 주신 분리 자료(배경 · 러그 · 책상과 의자 · 포털) → public/reading-plaza/ 의 WebP.
#
#   python3 -I scripts/prepare-classroom-art.py <풀어 둔 묶음 폴더> <내보낼 폴더>
#   (입력: 사용자 제공 bookbom-separated-classroom-rug-assets.zip — maps/ 와 objects/ 폴더)
#   (출력: 아래 일곱 장 → public/reading-plaza/ 에 넣음)
#   Pillow만 씁니다(설치된 파이썬 그대로).
#
# 한 일
#   classroom.webp    교실 배경(1672×941) — **학생 책상 · 의자 · 러그 · 포털이 없는** 빈 바닥. 같은 크기의 WebP로만 바꿨습니다.
#                     책상 30개와 러그는 화면이 자리 좌표(lib/readingPlazaMap.js의 CLASSROOM_SEATS)대로 따로 그립니다.
#   plaza-door.webp   교실로 가는 문(왼쪽 아래)이 그려진 책 광장 배경(1672×941) — **포털은 없습니다**(따로 그림).
#                     교실을 켠 반에서만 씁니다(끈 반은 문이 없는 plaza.webp 그대로).
#   rug.webp          동그란 러그 한 장(640×280 · 투명 바탕). 책상마다 한 장씩 깔고, 그 위에 서면 '내 자리'의 물음표가 뜹니다.
#   desk-chair.webp   책상과 의자 한 세트(360×312 · 투명 바탕) — 화면에 놓는 비율(90:78)에 맞춰 줄였습니다.
#   chair-front.webp  위 그림에서 **의자만** 남긴 것(같은 크기 · 같은 자리). 앉은 캐릭터 위에 한 번 더 그려,
#                     바닥 → 러그 → 책상·의자 → 캐릭터 → 의자 차례로 겹칩니다(캐릭터가 의자에 앉아 등받이 위로 보임).
#   portal.webp       포털 한 장(640×280 · 투명 바탕) — 두 방이 같은 그림을 씁니다.
#   portal-swirl.webp 포털 안쪽에서 도는 빛(384×384 · 투명 바탕). 화면이 이것을 돌리면서 납작하게 눌러 포털 위에 얹습니다.
import sys, os
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
SIZE = (1672, 941)
# 책상·의자를 화면에 놓는 크기(그림 원본 px) — lib/readingPlazaMap.js의 CLASSROOM_DESK와 같아야 합니다.
DESK_W, DESK_H = 90, 78


def report(name, im, path):
    print(f"{name:<18} {im.size[0]}×{im.size[1]} {im.mode}  {os.path.getsize(path) / 1024:.0f}KiB")


def background(src, out):
    im = Image.open(os.path.join(SRC, src)).convert("RGB")
    assert im.size == SIZE, f"{src}: 크기가 {im.size}입니다 — 좌표(lib/readingPlazaMap.js)를 다시 재야 합니다"
    path = os.path.join(OUT, out)
    im.save(path, "WEBP", quality=84, method=6)
    report(out, im, path)


def sprite(src, out, size=None, quality=90):
    im = Image.open(os.path.join(SRC, src)).convert("RGBA")
    if size:
        im = im.resize(size, Image.LANCZOS)
    path = os.path.join(OUT, out)
    # exact=True — 완전히 투명한 점의 색 값을 그대로 둡니다(가장자리에 어두운 테가 생기지 않게)
    im.save(path, "WEBP", quality=quality, method=6, exact=True)
    report(out, im, path)
    return im


def chair_front():
    """책상·의자 한 세트에서 의자만 남깁니다(같은 크기 · 같은 자리).
    그림(512×512)에서 의자는 가운데 아래 — x 118~392 · y 226~496. 책상 다리는 그 밖(x 36~87 · 423~474)이라
    상자만으로 갈리고, 등받이 윗부분(y 226~266)은 책상 밑의 어두운 그늘 · 앞판과 겹쳐 있어 **색으로** 가릅니다
    (의자는 밝은 나무색, 그늘 · 앞판은 어두움)."""
    im = Image.open(os.path.join(SRC, "objects", "desk-chair.png")).convert("RGBA")
    assert im.size == (512, 512), f"desk-chair.png: 크기가 {im.size}입니다 — 의자를 오리는 상자를 다시 재야 합니다"
    px = im.load()
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    po = out.load()
    for y in range(226, 497):
        for x in range(118, 393):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if y >= 266 or (r > 150 and r > g + 25):
                po[x, y] = (r, g, b, a)
    box = out.getchannel("A").getbbox()
    assert box and box[0] >= 118 and box[2] <= 393, box
    out = out.resize((DESK_W * 4, DESK_H * 4), Image.LANCZOS)
    path = os.path.join(OUT, "chair-front.webp")
    out.save(path, "WEBP", quality=90, method=6, exact=True)
    report("chair-front.webp", out, path)


background(os.path.join("maps", "classroom-background.png"), "classroom.webp")
background(os.path.join("maps", "reading-plaza-background.png"), "plaza-door.webp")
sprite(os.path.join("objects", "rug.png"), "rug.webp")
sprite(os.path.join("objects", "desk-chair.png"), "desk-chair.webp", (DESK_W * 4, DESK_H * 4))
chair_front()
sprite(os.path.join("objects", "portal.png"), "portal.webp")
sprite(os.path.join("objects", "portal-swirl.png"), "portal-swirl.webp", (384, 384), quality=88)
