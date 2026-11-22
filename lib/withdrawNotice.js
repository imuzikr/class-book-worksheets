// 학생 탈퇴 뒤의 알림 한 줄 — 프로필 창을 띄우는 두 화면(관리자 대시보드 · 교사 책 봄)이 함께 씁니다.
// result.complete: 서버가 로그인 계정까지 지웠는가(lib/data/withdraw.js의 withdrawStudent가 돌려줌).
// 서버 열쇠가 없는 배포 · 서버가 답하지 못한 때는 로그인 기록이 남아 콘솔에서 지워야 합니다.
export function withdrawNotice(name, result) {
  const who = name || "학생";
  return result?.complete === false
    ? `${who}을(를) 탈퇴시켰어요. 기록과 프로필은 지워졌지만 로그인 계정은 지우지 못했어요 — Firebase 콘솔의 Authentication에서 지워 주세요.`
    : `${who}을(를) 완전히 탈퇴시켰어요. 기록 · 프로필 · 로그인 계정이 모두 지워졌습니다.`;
}
