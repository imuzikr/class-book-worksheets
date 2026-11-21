// Maps are presentation choices. They never change reading EXP, levels or rewards.
export const DEFAULT_READING_MAP_THEME = "cloud-islands";

export const READING_MAP_THEMES = Object.freeze([
  Object.freeze({
    id: "continent",
    name: "천공",
    image: "/reading-journey/map-sky-library.webp",
    preview: "/reading-journey/map-sky-library-preview.webp",
    description: "지상 도서관에서 책갈피 다리를 건너 천공의 도서관으로 향하는 여행",
    alt: "왼쪽 아래 지상 도서관에서 제본소와 나무 서재, 그림책 정원을 거쳐 오른쪽 위 천공의 도서관에 닿는 지도",
  }),
  Object.freeze({
    id: "cloud-islands",
    name: "모험",
    image: "/reading-journey/map-cloud-islands.webp",
    preview: "/reading-journey/map-cloud-islands-preview.webp",
    description: "구름 위 다리를 건너 숲과 사막, 폭포와 설산을 탐험하는 여행",
    alt: "구름 위의 숲과 사막, 폭포섬과 설산을 네 개의 다리로 이어 등대에 도착하는 모험 지도",
  }),
]);

export function isReadingMapTheme(value) {
  return typeof value === "string" && READING_MAP_THEMES.some((map) => map.id === value);
}

export function getReadingMapTheme(value) {
  return READING_MAP_THEMES.find((map) => map.id === value)
    || READING_MAP_THEMES.find((map) => map.id === DEFAULT_READING_MAP_THEME);
}

export function readingMapThemeOf(classDoc) {
  return getReadingMapTheme(classDoc?.readingMapTheme).id;
}

export function readingMapThemeSettings(classes = []) {
  const live = (Array.isArray(classes) ? classes : []).filter((classDoc) => classDoc && !classDoc.archived);
  const values = live.map(readingMapThemeOf);
  return {
    value: values[0] || DEFAULT_READING_MAP_THEME,
    mixed: new Set(values).size > 1,
  };
}
