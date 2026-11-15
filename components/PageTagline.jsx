// 공통 상단바의 문구 — 학생은 리더보드 옆, 교사는 관리자 설정 오른쪽.
// 화면 제목 위에는 반복하지 않고 TopNav에서 한 번만 표시합니다.
export const PAGE_TAGLINE = "작은 변화로 시작하는 성장의 기록";

export default function PageTagline({ className = "" }) {
  return <p className={`page-tagline${className ? ` ${className}` : ""}`}>{PAGE_TAGLINE}</p>;
}
