"use client";
// =============================================================
// 책 봄 선생님 화면의 '프로필 편집' — 관리자 대시보드의 학생 프로필 창(StudentProfileDialog)을 그대로 씁니다
// (편집 · 이 반에서 빼기 · 사용 중지 · 탈퇴 — 같은 창 · 같은 저장 함수 · 같은 규칙, 선생님 요청 · 2026년 11월).
// 창의 모양은 대시보드의 dashboard.css에 있어 여기서 함께 불러옵니다. 이 파일은 단추를 누를 때만 내려받으므로
// (TeacherReadingView의 dynamic) 책방 첫 화면에는 대시보드 CSS가 실리지 않고, dashboard.css의 규칙은 모두 .bb- 접두라
// 불러온 뒤에도 책방 화면의 다른 것과 섞이지 않습니다. 대시보드 쪽은 지금처럼 Dashboard.jsx가 그 CSS를 싣습니다.
// =============================================================
import "@/components/dashboard/dashboard.css";

export { default } from "@/components/dashboard/StudentProfileDialog";
