// 아지트 안에서는 펫이 방석 안에서 쉽니다. 걷기 시트와 분리한 단일 휴식 그림입니다.
import { PET_SPECIES_KEYS } from "./readingPet.js";

export const HIDEOUT_REST_CELL = 96;
// 반열린 범위입니다. 그림을 내보낼 때 이 안에 모든 불투명 픽셀을 넣습니다.
export const HIDEOUT_REST_CONTENT_BOX = Object.freeze({ left: 16, top: 27, right: 80, bottom: 76 });
export const HIDEOUT_REST_PETS = Object.freeze(PET_SPECIES_KEYS.map((species) => Object.freeze({
  species,
  src: `/reading-hideout/pets/rest-${species}.webp`,
  cell: HIDEOUT_REST_CELL,
  contentBox: HIDEOUT_REST_CONTENT_BOX,
})));
const REST_BY_SPECIES = new Map(HIDEOUT_REST_PETS.map((entry) => [entry.species, entry]));

/** 알에는 종별 URL을 만들지 않습니다. 부화한 펫은 성장 단계와 무관하게 같은 휴식 그림입니다. */
export function getHideoutRestPet(pet) {
  if (pet?.hatched !== true || !Number.isInteger(pet.stage) || pet.stage < 2 || pet.stage > 10) return null;
  return REST_BY_SPECIES.get(pet.species) ?? null;
}

// 책 모양 침대는 위쪽 홈 때문에 더 아래에 놓아야 머리·귀까지 침대 그림 안에 들어갑니다.
// 열 종의 실제 알파 영역으로 확인한 값이며, 안쪽 앞면(약0.239w)보다 조금 안쪽입니다.
const BED_FRONT_INSETS = Object.freeze({
  "bed-linen": 0.256, "bed-book": 0.245,
  "bed-forest": 0.191, "bed-starlight": 0.196, "bed-explorer": 0.191, "bed-coastal": 0.191,
});
const validBed = (bed) => !!bed && Number.isFinite(bed.x) && Number.isFinite(bed.y)
  && Number.isFinite(bed.width) && bed.width > 0;
const validBox = (box) => !!box && [box.left, box.top, box.right, box.bottom].every(Number.isFinite)
  && box.left >= 0 && box.top >= 0 && box.right <= HIDEOUT_REST_CELL && box.bottom <= HIDEOUT_REST_CELL
  && box.left < box.right && box.top < box.bottom;

/** 그림 칸의 발끝이 아니라 실제 몸의 아래를 방석의 안쪽 바닥에 맞춥니다. 위치는 가운데 기준입니다. */
export function hideoutPetRestPosition(bed, itemId, contentBox = HIDEOUT_REST_CONTENT_BOX) {
  if (!validBed(bed) || !validBox(contentBox)) return null;
  // 방석별 맞춤 크기에서 80%로 줄여 작은 캐릭터와 균형을 맞춥니다.
  // 실제 몸의 아래쪽은 같은 안쪽 바닥에 두므로 줄어들어도 공중에 뜨지 않습니다.
  const width = Math.min(120, bed.width * 0.6);
  const bottom = bed.y - bed.width * (BED_FRONT_INSETS[itemId] ?? BED_FRONT_INSETS["bed-linen"]);
  return {
    x: bed.x,
    y: bottom - (contentBox.bottom / HIDEOUT_REST_CELL - 0.5) * width,
    width,
    height: width,
  };
}

/** 알도 같은 안쪽 바닥에 작게 놓습니다. 흔들기·걷기 동작은 아지트에서 사용하지 않습니다. */
export function hideoutEggRestPosition(bed, itemId) {
  if (!validBed(bed)) return null;
  const width = bed.width * 0.36;
  const bottom = bed.y - bed.width * (BED_FRONT_INSETS[itemId] ?? BED_FRONT_INSETS["bed-linen"]);
  return { x: bed.x, y: bottom - width / 2, width, height: width };
}

/** 휴식 그림의 실제 불투명 부분을 검사할 때 쓰는 장면 좌표 범위입니다. */
export function hideoutRestContentBounds(placement, contentBox = HIDEOUT_REST_CONTENT_BOX) {
  if (!placement || !validBox(contentBox) || ![placement.x, placement.y, placement.width, placement.height].every(Number.isFinite)
    || placement.width <= 0 || placement.height <= 0) return null;
  const left = placement.x - placement.width / 2;
  const top = placement.y - placement.height / 2;
  return {
    left: left + contentBox.left / HIDEOUT_REST_CELL * placement.width,
    top: top + contentBox.top / HIDEOUT_REST_CELL * placement.height,
    right: left + contentBox.right / HIDEOUT_REST_CELL * placement.width,
    bottom: top + contentBox.bottom / HIDEOUT_REST_CELL * placement.height,
  };
}
