"use client";

// 이미지 보안 4단계 — 정화한 서식 HTML을 그리는 공용 상자.
// 안에 든 반 폴더 그림(<img src="storage:…">)은 useSecureHtml이 권한을
// 확인하며 내려받아 채웁니다. 옛 https 주소·data: 그림은 그대로 보입니다.
// html은 **이미 sanitizeHtml(또는 richHtml)을 거친 값**만 넣습니다.
import { useRef } from "react";
import { useSecureHtml } from "@/lib/secureImage";

export default function SecureHtml({ html, as: Tag = "div", ref: outerRef, ...rest }) {
  const innerRef = useRef(null);
  useSecureHtml(innerRef, html);
  const setRef = (el) => {
    innerRef.current = el;
    if (typeof outerRef === "function") outerRef(el);
    else if (outerRef) outerRef.current = el;
  };
  return <Tag ref={setRef} {...rest} dangerouslySetInnerHTML={{ __html: html }} />;
}
