// 한성여자고등학교 도서관(독서로) — 화면과 서버가 함께 쓰는 학교 정보와 원본 검색 결과 주소.
// 원본 주소는 '자동 확인'이 아니라 선생님이 독서로 화면을 직접 여는 길입니다(새 탭).
export const LIBRARY = Object.freeze({
  schoolName: "한성여자고등학교",
  provCode: "B10",
  neisCode: "B100000556",
  origin: "https://read365.edunet.net",
});

export function libraryResultUrl(keyword) {
  const url = new URL("/PureScreen/SchoolSearchResult", LIBRARY.origin);
  url.searchParams.set("searchKeyword", keyword || "");
  url.searchParams.set("searchType", "TITLE");
  url.searchParams.set("provCode", LIBRARY.provCode);
  url.searchParams.set("neisCode", LIBRARY.neisCode);
  url.searchParams.set("schoolName", LIBRARY.schoolName);
  return url.href;
}
