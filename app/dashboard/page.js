import Dashboard from "@/components/dashboard/Dashboard";

// 탭 제목은 로그인 전 기본값이고, 들어오면 화면이 역할에 맞게 바꿉니다(교사 '관리자
// 대시보드' · 학생 '나의 독서 기록' — components/dashboard/Dashboard.jsx).
export const metadata = {
  title: "대시보드 | 책봄",
  description: "우리 반의 독서 활동과 나의 독서 기록을 살펴봅니다.",
};

export default function DashboardPage() {
  return <Dashboard />;
}
