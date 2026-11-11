// Maps are presentation choices. They never change reading EXP, levels or rewards.
export const DEFAULT_READING_MAP_THEME = "cloud-islands";

export const READING_MAP_THEMES = Object.freeze([
  Object.freeze({
    id: "continent",
    name: "도전의 대륙",
    image: "/reading-journey/map.webp",
    preview: "/reading-journey/map-continent-preview.webp",
    description: "울창한 숲과 사막, 급류와 설산을 건너는 힘찬 대륙 여행",
    alt: "숲에서 사막과 폭포 계곡, 설산을 지나 폭풍 해안으로 이어지는 도전의 대륙 지도",
  }),
  Object.freeze({
    id: "cloud-islands",
    name: "구름섬 대모험",
    image: "/reading-journey/map-cloud-islands.webp",
    preview: "/reading-journey/map-cloud-islands-preview.webp",
    description: "구름 위 다리를 건너 숲과 사막, 폭포와 설산을 탐험하는 여행",
    alt: "구름 위의 숲과 사막, 폭포섬과 설산을 네 개의 다리로 이어 등대에 도착하는 구름섬 대모험 지도",
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
