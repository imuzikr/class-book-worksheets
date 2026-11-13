# 책 광장 '교실' 그림 만들기 — 선생님이 주신 PNG 세 장 → public/reading-plaza/ 의 WebP 세 장.
#
#   python3 -I scripts/prepare-classroom-art.py <풀어 둔 PNG 폴더> <내보낼 폴더>
#   (입력: 사용자 제공 bookbom-plaza-classroom-portal.zip의 classroom-map.png · reading-plaza-map.png · portal.png)
#   (출력: classroom.webp · plaza-door.webp · portal-swirl.webp → public/reading-plaza/ 에 넣음)
#   Pillow만 씁니다(설치된 파이썬 그대로).
#
# 한 일
#   classroom.webp    교실 배경(1672×941). 같은 크기의 WebP(quality 84)로만 바꿨습니다 — 책상 30개 · 칠판 · 문 · 포털이
#                     그림에 그려져 있고, 그 좌표는 lib/readingPlazaMap.js의 교실 정의에 이 그림의 원본 px로 적혀 있습니다.
#   plaza-door.webp   문(왼쪽 아래)과 포털이 그려진 책 광장 배경(1672×941). 교실을 켠 반에서만 씁니다
#                     (끈 반은 문이 없는 plaza.webp 그대로).
#   portal-swirl.webp 포털 안쪽 소용돌이만 오려 **동그랗게 편** 그림(256×256 · 가장자리는 투명하게 풀림).
#                     화면이 이것을 돌리면서 다시 납작하게 눌러(배경에 그려진 포털 위에 얹어) 소용돌이가 도는 것처럼 보입니다.
#                     원본 portal.png는 비스듬히 본 타원이라 그대로 돌리면 접시가 흔들리는 것처럼 보입니다.
import sys, os
from PIL import Image, ImageChops, ImageDraw, ImageFilter

SRC, OUT = sys.argv[1], sys.argv[2]
SIZE = (1672, 941)


def background(name, out):
    im = Image.open(os.path.join(SRC, name)).convert("RGB")
    assert im.size == SIZE, f"{name}: 크기가 {im.size}입니다 — 좌표(lib/readingPlazaMap.js)를 다시 재야 합니다"
    path = os.path.join(OUT, out)
    im.save(path, "WEBP", quality=84, method=6)
    print(out, im.size, f"{os.path.getsize(path) / 1024:.0f}KiB")


def swirl():
    im = Image.open(os.path.join(SRC, "portal.png")).convert("RGBA")
    assert im.size == (640, 280), f"portal.png: 크기가 {im.size}입니다"
    # 안쪽 민트색 소용돌이의 가운데와 반지름(잰 값 — 가운데 (319.5, 133), 민트 영역 반지름 249.5 × 86).
    # 금빛 테의 잎 장식이 걸치지 않게 조금 안쪽만 씁니다.
    cx, cy, rx, ry = 319.5, 133.0, 196.0, 67.5
    box = (round(cx - rx), round(cy - ry), round(cx + rx), round(cy + ry))
    side = 256
    disc = im.crop(box).resize((side, side), Image.LANCZOS)     # 타원을 동그라미로 폄
    # 동그란 가리개 — 반지름의 60%쯤부터 투명하게 풀려 85%에서 다 사라집니다(배경의 포털과 이음매가 안 보이고,
    # 아래쪽에 걸친 금빛 잎 장식의 끝이 함께 돌지 않게)
    big = side * 4
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).ellipse((big * 0.15, big * 0.15, big * 0.85, big * 0.85), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(big * 0.05)).resize((side, side), Image.LANCZOS)
    # 원본의 알파와 가리개를 곱합니다
    disc.putalpha(ImageChops.multiply(disc.getchannel("A"), mask))
    path = os.path.join(OUT, "portal-swirl.webp")
    disc.save(path, "WEBP", quality=90, method=6)
    print("portal-swirl.webp", disc.size, f"{os.path.getsize(path) / 1024:.0f}KiB")


background("classroom-map.png", "classroom.webp")
background("reading-plaza-map.png", "plaza-door.webp")
swirl()
