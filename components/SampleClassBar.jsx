"use client";

// =============================================================
// 체험용 샘플 반 표시줄 — 샘플 반 안에서만 상단바에 섭니다.
// '체험 모드 · 저장되지 않아요' 배지와 '샘플 반 나가기' 버튼.
// 실제 로그인 상태도 지켜봐서, 로그아웃·학생 계정이면 곧바로 닫습니다.
// (서버 렌더와 어긋나지 않게 마운트 뒤에만 그립니다)
// =============================================================
import { useEffect, useState } from "react";
import { sampleMode, exitSampleClass, watchSampleClassAccess } from "@/lib/sampleClass";

export default function SampleClassBar() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!sampleMode) return undefined;
    setOn(true);
    return watchSampleClassAccess();
  }, []);
  if (!on) return null;
  return (
    <div className="sample-class-bar" role="status">
      <span className="sample-class-badge" title="이 반에서 한 일은 어디에도 저장되지 않고, 새로고침하면 처음으로 돌아가요.">
        체험 모드 · 저장되지 않아요
      </span>
      <button type="button" className="btn-ghost sample-class-exit" onClick={() => exitSampleClass()}>
        샘플 반 나가기
      </button>
    </div>
  );
}
