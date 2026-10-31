"use client";

// 이미지 보안 4단계 — "이 화면에서 올리는 그림은 어느 반 폴더로 가는가"
// 서식 편집기(RichTextEditor)는 여러 화면 깊숙이 들어가 있어, 반 id를
// 속성으로 일일이 넘기는 대신 화면 바깥에서 한 번 감싸 알려 줍니다.
//   <UploadClassProvider classId={classId}> … </UploadClassProvider>
// 감싸지 않은 곳(반 id 없음)에서는 그림을 올리지 않고 안내만 합니다.
import { createContext, createElement, useContext } from "react";

const UploadClassContext = createContext(null);

export function UploadClassProvider({ classId, children }) {
  return createElement(UploadClassContext.Provider, { value: classId || null }, children);
}

export function useUploadClassId() {
  return useContext(UploadClassContext);
}
