// 궁금해요 / 해결됐어요 / 답변 수 / 학습 리포트 아이콘

export function IconAnswer({ size = 20, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M6.4 6.7c1.25-1.1 3.05-1.7 5.1-1.7 4.25 0 7 2.35 7 5.75s-2.75 5.75-7 5.75c-.72 0-1.4-.07-2.03-.21L6.7 18.4c-.42.32-1.01-.03-.92-.55l.48-2.75C5.13 14.07 4.5 12.58 4.5 10.75c0-1.66.66-3.07 1.9-4.05Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.72 9.15h5.58M8.72 11.45h5.58M8.72 13.75h3.28"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
      <path
        d="M18.92 4.25 19.2 5c.04.11.13.2.24.24l.75.28-.75.28a.45.45 0 0 0-.24.24l-.28.75-.28-.75a.45.45 0 0 0-.24-.24l-.75-.28.75-.28a.45.45 0 0 0 .24-.24l.28-.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function IconReport({ size = 18, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M6.5 4.75h8.05L18 8.2v10.55c0 .83-.67 1.5-1.5 1.5h-10c-.83 0-1.5-.67-1.5-1.5V6.25c0-.83.67-1.5 1.5-1.5Z"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path
        d="M14.45 4.9v2.35c0 .58.47 1.05 1.05 1.05h2.35"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.05 15.55v-2.1M11.5 15.55v-4.35M14.95 15.55V9.95"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
      <path
        d="M7.7 17.9h7.9"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconLogo({ size = 28, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M7.85 5.45c0-1.2.97-2.18 2.18-2.18h7.72c1.2 0 2.18.98 2.18 2.18v4.45c0 1.2-.98 2.18-2.18 2.18h-.7l.4 2.02c.08.4-.37.7-.7.46l-3.33-2.48h-3.39c-1.21 0-2.18-.98-2.18-2.18V5.45Z" stroke="#8A6258" strokeWidth="1.55" strokeLinejoin="round"/>
      <path d="M7.85 6.25c0-1.2.97-2.18 2.18-2.18h7.72c1.2 0 2.18.98 2.18 2.18v4.45c0 1.2-.98 2.18-2.18 2.18h-.7l.4 2.02c.08.4-.37.7-.7.46l-3.33-2.48h-3.39c-1.21 0-2.18-.98-2.18-2.18V6.25Z" stroke="#8A6258" strokeWidth="1.55" strokeLinejoin="round"/>
      <path d="M3.15 10.85c0-1.22.98-2.2 2.2-2.2h6.82c1.22 0 2.2.98 2.2 2.2v3.88c0 1.22-.98 2.2-2.2 2.2H9.4l-3.25 2.42c-.33.24-.78-.06-.7-.46l.37-1.96h-.47c-1.22 0-2.2-.98-2.2-2.2v-3.88Z" fill="#FFFDF9" stroke="#3A312E" strokeWidth="1.65" strokeLinejoin="round"/>
      <path d="M6.65 12.6h4.05M6.65 14.5H9.2" stroke="#3A312E" strokeWidth="1.35" strokeLinecap="round"/>
      <circle cx="17.8" cy="6.25" r=".82" fill="#8A6258"/>
      <circle cx="17.8" cy="7.05" r=".82" fill="#8A6258"/>
    </svg>
  );
}

export function IconWrite({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M6.25 16.9 7.1 13.2 15.65 4.65c.7-.7 1.84-.7 2.54 0l1.16 1.16c.7.7.7 1.84 0 2.54L10.8 16.9l-3.7.85c-.52.12-.97-.33-.85-.85Z" fill="transparent" stroke="white" strokeWidth="1.45" strokeLinejoin="round"/>
      <path d="m14.35 5.95 3.7 3.7" stroke="white" strokeWidth="1.45" strokeLinecap="round"/>
      <path d="M7.1 13.2 10.8 16.9" stroke="white" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="m6.6 16.98 2.05-.47-1.58-1.58-.47 2.05Z" fill="white"/>
      <path d="M4.65 19.35h6.2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export function IconLogout({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M14 7V5.5A1.5 1.5 0 0 0 12.5 4h-6A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20h6a1.5 1.5 0 0 0 1.5-1.5V17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 12h9m0 0-2.8-2.8M19 12l-2.8 2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconStudent({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M8.05 10.05c0-2.2 1.77-3.98 3.95-3.98s3.95 1.78 3.95 3.98v2.35c0 .86-.7 1.56-1.56 1.56H9.61c-.86 0-1.56-.7-1.56-1.56v-2.35Z" fill="#3A312E" stroke="#3A312E" strokeWidth="1.0" strokeLinejoin="round"/>
      <path d="M9.25 10.78c1.1-.1 2.1-.52 2.9-1.24.68.7 1.58 1.1 2.6 1.22v1.24c0 1.55-1.23 2.8-2.75 2.8S9.25 13.55 9.25 12v-1.22Z" fill="#FFF7ED"/>
      <path d="M8.75 10.1c1.38-.05 2.57-.58 3.45-1.53.7.85 1.75 1.38 3.05 1.5" stroke="#3A312E" strokeWidth="0.75" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.45 18.95v-.85c0-1.82 1.48-3.3 3.3-3.3h2.5c1.82 0 3.3 1.48 3.3 3.3v.85" fill="#FFF7ED" stroke="#3A312E" strokeWidth="1.0" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9.6 18.95h4.8" stroke="#8A6258" strokeWidth="0.85" strokeLinecap="round"/>
      <path d="M16.2 6.75c.2-.56.83-.84 1.38-.61l1.02.42-.96.55c-.25.14-.42.38-.48.66l-.22 1.08-.67-.86a1.03 1.03 0 0 0-.72-.4l-1.1-.09.92-.61c.36-.24.66-.53.83-.14Z" fill="#8A6258"/>
      <path d="M10 13.95v1.05M14 13.95v1.05" stroke="#3A312E" strokeWidth="0.85" strokeLinecap="round"/>
    </svg>
  );
}

export function IconTeacher({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M8.55 9.75c0-2.05 1.55-3.7 3.45-3.7s3.45 1.65 3.45 3.7v.82c0 2.05-1.55 3.7-3.45 3.7s-3.45-1.65-3.45-3.7v-.82Z" fill="#FFF7ED" stroke="#3A312E" strokeWidth="1.55" strokeLinejoin="round"/>
      <path d="M8.7 9.3c.75-1.65 2-2.48 3.82-2.48 1.12 0 2.08.36 2.78 1.05-.18.88-.72 1.48-1.62 1.78-.9.3-2.18.26-3.82-.12" fill="#3A312E"/>
      <path d="M7.25 19v-.8c0-1.98 1.6-3.58 3.58-3.58h2.34c1.98 0 3.58 1.6 3.58 3.58v.8" fill="#FFF7ED"/>
      <path d="M7.25 19v-.8c0-1.98 1.6-3.58 3.58-3.58h2.34c1.98 0 3.58 1.6 3.58 3.58v.8" stroke="#3A312E" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10.45 14.85 12 16.1l1.55-1.25" stroke="#3A312E" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 16.1 10.95 19M12 16.1 13.05 19" stroke="#8A6258" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconBlackboard({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M3.65 6.45h16.7v10.35H3.65V6.45Z" fill="#FFFDF9" stroke="#3A312E" strokeWidth="1.55" strokeLinejoin="round"/>
      <path d="M4.7 7.45h14.6v7.2H4.7v-7.2Z" fill="#FFF7ED" fillOpacity=".08" stroke="#FFF7ED" strokeWidth="1.15" strokeLinejoin="round"/>
      <path d="M6.65 9.65h5.2M6.65 11.75h3.15" stroke="#3A312E" strokeWidth="1.15" strokeLinecap="round"/>
      <path d="M3.35 16.8h17.3" stroke="#3A312E" strokeWidth="1.55" strokeLinecap="round"/>
      <path d="M13.2 16.8h4.1" stroke="#8A6258" strokeWidth="1.55" strokeLinecap="round"/>
      <path d="M6.25 16.8h2.2" stroke="#3A312E" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M9.1 16.8h1.75" stroke="#FFF7ED" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

// 책방 — 펼쳐진 책
// 리더보드 — 손잡이 달린 우승컵(상단바 '리더보드')
export function IconTrophy({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M7.2 4.6h9.6v4.2a4.8 4.8 0 0 1-9.6 0V4.6Z" fill="#FFF1C9" stroke="#3A312E" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M7.2 6.2H5.1c0 2.3 1.1 3.8 2.6 4.2M16.8 6.2h2.1c0 2.3-1.1 3.8-2.6 4.2" stroke="#3A312E" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 13.6v3.1M8.6 19.4h6.8M9.6 19.4l.6-2.7h3.6l.6 2.7" stroke="#3A312E" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10.4 7.2l.9 1.5 1.6-2.4" stroke="#8A6258" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconBook({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M12 7.15C10.3 5.9 8.3 5.35 6.05 5.5c-.72.05-1.3.65-1.3 1.38v9.1c0 .8.7 1.43 1.5 1.37 2-.15 3.8.35 5.3 1.5" fill="#FFF7ED" stroke="#3A312E" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M12 7.15c1.7-1.25 3.7-1.8 5.95-1.65.72.05 1.3.65 1.3 1.38v9.1c0 .8-.7 1.43-1.5 1.37-2-.15-3.8.35-5.3 1.5" fill="#FFFDF9" stroke="#3A312E" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M12 7.15v11.7" stroke="#3A312E" strokeWidth="1.35" strokeLinecap="round"/>
      <path d="M7.15 9.05h2.6M7.15 11.5h2.1" stroke="#8A6258" strokeWidth="1.05" strokeLinecap="round"/>
      <path d="M14.35 9.05h2.6M14.35 11.5h2.1" stroke="#8A6258" strokeWidth="1.05" strokeLinecap="round"/>
    </svg>
  );
}

export function IconSchool({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M4.75 10.15 12 5.15l7.25 5" stroke="#3A312E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6.25 10.55h11.5v8.45H6.25v-8.45Z" fill="#FFF7ED" stroke="#3A312E" strokeWidth="1.55" strokeLinejoin="round"/>
      <path d="M10.05 19v-4.1c0-.58.47-1.05 1.05-1.05h1.8c.58 0 1.05.47 1.05 1.05V19" stroke="#3A312E" strokeWidth="1.45" strokeLinejoin="round"/>
      <circle cx="9.05" cy="12.9" r=".72" fill="#8A6258"/>
      <circle cx="14.95" cy="12.9" r=".72" fill="#8A6258"/>
      <path d="M4.4 19h15.2" stroke="#3A312E" strokeWidth="1.45" strokeLinecap="round"/>
    </svg>
  );
}

export function IconTrash({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M8.25 4.55h7.5" stroke="#D7665F" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M9.45 8.05V6.8c0-.72.58-1.3 1.3-1.3h2.5c.72 0 1.3.58 1.3 1.3v1.25" stroke="#3A312E" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.9 8.25h12.2" stroke="#3A312E" strokeWidth="1.55" strokeLinecap="round"/>
      <path d="M7.3 8.25l.8 11.5c.06.72.66 1.25 1.38 1.25h5.04c.72 0 1.32-.53 1.38-1.25l.8-11.5" stroke="#3A312E" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10.25 11.1v5.15M12 11.1v5.15M13.75 11.1v5.15" stroke="#8A6258" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  );
}

// 확인(체크) — 원 없이 체크 표시만 그립니다(원이 필요하면 감싸는 단추의
// 테두리가 그립니다 — 아이콘 안의 원은 단추보다 작게 그려짐).
export function IconCheck({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path
        d="M5 12.9 9.6 17.5 19 6.9"
        stroke="currentColor"
        strokeWidth="2.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconSettings({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="#3A312E" strokeWidth="1.55" strokeLinejoin="round"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="#3A312E" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── 잠김 / 열림 ────────────────────────────────────────────────
// 두 아이콘은 **한 쌍**입니다 — 같은 몸통·같은 두 색(먹빛 #3A312E, 무늬
// #8A6258)에 고리만 다릅니다. 닫힌 고리 = 잠김, 열린 고리 + 반짝임 = 열림.
// 상태가 갈리는 자리는 색이나 글자만으로 두지 말고 이 쌍을 쓰세요 —
// 색만으로는 '연한 회색 칩'과 '연한 살구색 칩'을 스쳐 보고 가리기 어렵고,
// 교실 화면(빔프로젝터)에서는 그 차이가 더 좁아집니다.
//
// mono: 어두운 패널 위에서는 제자리 색(밝은 바탕에 맞춘 먹빛)이 안 보이므로
// 두 색을 글자색으로 갈음하고 몸통을 비웁니다(`.study-activity-lock`).
export function IconLock({ size = 20, className = "", mono = false }) {
  const ink = mono ? "currentColor" : "#3A312E";
  const accent = mono ? "currentColor" : "#8A6258";
  const body = mono ? "none" : "#FFF7ED";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M7.25 10.35V8.7c0-2.62 2.13-4.75 4.75-4.75s4.75 2.13 4.75 4.75v1.65" stroke={ink} strokeWidth="1.65" strokeLinecap="round"/>
      <path d="M6.65 10.35h10.7c.9 0 1.65.74 1.65 1.65v5.4c0 .9-.74 1.65-1.65 1.65H6.65C5.74 19.05 5 18.3 5 17.4V12c0-.9.74-1.65 1.65-1.65Z" fill={body} stroke={ink} strokeWidth="1.65" strokeLinejoin="round"/>
      <path d="M12 13.35v2.75" stroke={accent} strokeWidth="1.55" strokeLinecap="round"/>
      <circle cx="12" cy="13.05" r=".72" fill={accent}/>
    </svg>
  );
}

// 열림 — 고리가 오른쪽 위로 열려 있고, 그 끝에 반짝임 하나.
// 몸통에 IconLock과 같은 크림색을 채웁니다: 칩·버튼 배경이 색깔일 때
// 한쪽만 속이 비면 같은 쌍으로 안 읽힙니다.
export function IconUnlock({ size = 20, className = "", mono = false }) {
  const ink = mono ? "currentColor" : "#3A312E";
  const accent = mono ? "currentColor" : "#8A6258";
  const body = mono ? "none" : "#FFF7ED";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M7.05 10.25V8.75c0-2.55 1.94-4.7 4.48-4.86 2.2-.14 4.1 1.18 4.82 3.08" stroke={ink} strokeWidth="1.65" strokeLinecap="round"/>
      <path d="M6.55 10.25h10.9c.9 0 1.65.74 1.65 1.65v5.55c0 .9-.74 1.65-1.65 1.65H6.55c-.9 0-1.65-.74-1.65-1.65V11.9c0-.9.74-1.65 1.65-1.65Z" fill={body} stroke={ink} strokeWidth="1.65" strokeLinejoin="round"/>
      <circle cx="12" cy="13.25" r=".72" fill={accent}/>
      <path d="M12 13.65v2.7" stroke={accent} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M17.95 4.15 18.22 4.88c.04.11.13.2.24.24l.73.27-.73.27a.45.45 0 0 0-.24.24l-.27.73-.27-.73a.45.45 0 0 0-.24-.24l-.73-.27.73-.27c.11-.04.2-.13.24-.24l.27-.73Z" fill={accent}/>
    </svg>
  );
}

// 상태 하나로 둘 중 하나를 그립니다. 잠김/열림이 갈리는 자리는 **전부**
// 이것을 거쳐야 두 화면이 다른 그림을 쓰는 일이 생기지 않습니다.
export function IconLockState({ locked, size = 20, className = "", mono = false }) {
  const Icon = locked ? IconLock : IconUnlock;
  return <Icon size={size} className={className} mono={mono} />;
}

// 정렬 — 아래로 향한 화살표 + 짧은 데서 긴 데로 늘어나는 세 줄.
// 🔢(1234) 이모지를 쓰고 있었는데, 기기마다 색이 원색(파랑·빨강)이라 옆의
// ＋ − 단추와 함께 선 얇은 알약 줄에서 혼자 튀었고, 무엇보다 '숫자'로만
// 읽혀 '순서를 매긴다'는 뜻이 안 보였습니다.
export function IconSort({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M6.4 5.75v12.5" stroke="#8A6258" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M6.4 18.25 4.75 16.6M6.4 18.25l1.65-1.65" stroke="#8A6258" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11 7.45h3.45M11 12h5.25M11 16.55h7.05" stroke="#3A312E" strokeWidth="1.65" strokeLinecap="round"/>
    </svg>
  );
}

// 모둠 활동 — 나란히 선 두 사람.
// 👥를 쓰고 있었는데 기기마다 두 사람의 색·머리 모양이 달랐습니다.
// 예전에는 '가운데 한 사람 + 좌우로 반쯤 걸친 두 사람'이라 세 사람이었는데,
// 15px로 줄면 옆의 두 사람이 가운데 몸통에 붙어 덩어리 하나로 뭉쳤습니다.
// 지금은 둘이 떨어져 서서 작은 크기에서도 '한 사람이 아니다'가 읽힙니다.
// 오른쪽 사람만 초록(#3F704B)인 것은 이 앱에서 이 아이콘 하나뿐입니다 —
// 색이 다르면 겹쳐 보여도 두 사람인 것이 갈립니다(먹빛 둘이면 한 덩어리).
export function IconGroup({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <circle cx="8.35" cy="7.2" r="2.35" fill="#FFFDF9" stroke="#3A312E" strokeWidth="1.55"/>
      <circle cx="15.65" cy="7.2" r="2.35" fill="#FFFDF9" stroke="#3F704B" strokeWidth="1.55"/>
      <path d="M3.55 18.5v-.9c0-2.7 2.05-4.72 4.8-4.72 1.52 0 2.8.62 3.65 1.65" stroke="#3A312E" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M20.45 18.5v-.9c0-2.7-2.05-4.72-4.8-4.72-1.52 0-2.8.62-3.65 1.65" stroke="#3F704B" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// 자리 배치 — 비스듬히 본 의자.
// 이모지(🪑)를 쓰던 자리인데, 기기마다 정면 의자·사무용 회전의자·접이식
// 의자로 다 달랐고 대부분 원색이라 이 화면의 두 색 아이콘들 사이에서
// 혼자 튀었습니다. 등받이의 가로 두 줄이 무늬 색(#8A6258)이라 작게 줄여도
// '의자'로 읽힙니다.
export function IconChair({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M8.05 5.3 15.2 3.9c.82-.16 1.58.47 1.58 1.3v6.55l-8.73 1.7V5.3Z" fill="#FFF7ED" stroke="#3A312E" strokeWidth="1.45" strokeLinejoin="round"/>
      <path d="M8.05 13.45 16.78 11.75 19.75 13.7 11.02 15.42 8.05 13.45Z" fill="#FFFDF9" stroke="#3A312E" strokeWidth="1.45" strokeLinejoin="round"/>
      <path d="M11.02 15.42v3.98M19.75 13.7v3.4M8.05 13.45v3.15M16.78 11.75v2.95" stroke="#3A312E" strokeWidth="1.35" strokeLinecap="round"/>
      <path d="M10.05 7.35 14.75 6.43M10.05 9.75 14.75 8.83" stroke="#8A6258" strokeWidth="1.05" strokeLinecap="round"/>
    </svg>
  );
}

// 반 보관 — 뚜껑을 덮은 상자.
// 이모지(📦)를 쓰던 자리인데, 기기마다 그림이 아주 달라(택배 상자 · 갈색
// 종이상자 · 납작한 서류함) 반 관리 창과 공부방 머리말이 다른 그림을
// 보여 주었습니다. 다른 아이콘과 같은 두 색(먹빛 #3A312E, 무늬 #8A6258)
// 이라 줄에 섞여도 튀지 않습니다.
export function IconArchive({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M5.65 9.75h12.7c.8 0 1.45.65 1.45 1.45v6.25c0 .8-.65 1.45-1.45 1.45H5.65c-.8 0-1.45-.65-1.45-1.45V11.2c0-.8.65-1.45 1.45-1.45Z" fill="#FFF7ED" stroke="#3A312E" strokeWidth="1.55" strokeLinejoin="round"/>
      <path d="M5.7 5.55h12.6c.47 0 .9.27 1.1.7l1.2 2.58c.34.74-.2 1.57-1.02 1.57H4.42c-.82 0-1.36-.83-1.02-1.57l1.2-2.58c.2-.43.63-.7 1.1-.7Z" fill="#FFFDF9" stroke="#3A312E" strokeWidth="1.55" strokeLinejoin="round"/>
      <path d="M4.55 10.4h14.9" stroke="#8A6258" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M9.05 12.4h5.9v2.25h-5.9v-2.25Z" stroke="#8A6258" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M8.3 17.05h7.4" stroke="#3A312E" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  );
}

export function IconPeople({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <circle cx="8.7" cy="8.6" r="2.55" fill="#FFF7ED" stroke="#3A312E" strokeWidth="1.45"/>
      <path d="M4.1 18.35v-.7c0-2.28 1.85-4.13 4.13-4.13h.94c2.28 0 4.13 1.85 4.13 4.13v.7" fill="#FFF7ED" stroke="#3A312E" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="15.6" cy="7.75" r="2.15" fill="#FFF7ED" stroke="#8A6258" strokeWidth="1.35"/>
      <path d="M13.35 17.25v-.55c0-1.75 1.42-3.17 3.17-3.17h.5c1.5 0 2.77 1.03 3.1 2.45" stroke="#8A6258" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconPen({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M14.85 4.75c.5-.5 1.3-.5 1.8 0l2.6 2.6c.5.5.5 1.3 0 1.8l-9.4 9.4-4.9 1.1 1.1-4.9 9.4-9.4Z" fill="#FFF7ED" stroke="#3A312E" strokeWidth="1.55" strokeLinejoin="round"/>
      <path d="M13.35 6.25l4.4 4.4" stroke="#8A6258" strokeWidth="1.35" strokeLinecap="round"/>
      <path d="M4.95 19.05l1.1-4.9" stroke="#3A312E" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconMyPost({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M6.65 4.75h8.75l2.95 2.95v10.1c0 .8-.65 1.45-1.45 1.45H6.65c-.8 0-1.45-.65-1.45-1.45V6.2c0-.8.65-1.45 1.45-1.45Z" fill="#FFF7ED" stroke="#3A312E" strokeWidth="1.55" strokeLinejoin="round"/>
      <path d="M15.35 4.92V7.1c0 .55.45 1 1 1h1.82" stroke="#3A312E" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8.15 11.2h4.1M8.15 13.35h3.2" stroke="#3A312E" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M12.55 16.35 13 14.38l3.68-3.68c.37-.37.98-.37 1.35 0l.27.27c.37.37.37.98 0 1.35l-3.68 3.68-1.97.45c-.06.02-.12-.04-.1-.1Z" fill="#FFFDF9" stroke="#8A6258" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  );
}

// 돌발 퀴즈 — 노란 메모지(포스트잇) 한 장. 위에 테이프, 아래 오른쪽 귀가 접혀
// 있고 물음표 대신 줄 두 개(답을 적는 종이). 상단바(학생은 늘 · 교사는 반을
// 골랐을 때)와 교사 자리표의 '답 보냄' 칸에 같은 그림을 씁니다.
export function IconQuizMemo({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M5.4 6.2c0-.8.65-1.45 1.45-1.45h10.3c.8 0 1.45.65 1.45 1.45v8.15l-4.25 4.9H6.85c-.8 0-1.45-.65-1.45-1.45V6.2Z" fill="#FFE9A8" stroke="#3A312E" strokeWidth="1.55" strokeLinejoin="round"/>
      <path d="M18.6 14.35h-3.05c-.8 0-1.2.4-1.2 1.2v3.7" fill="#F5CF6B" stroke="#3A312E" strokeWidth="1.35" strokeLinejoin="round"/>
      <path d="M8.3 9.3h7.4M8.3 12.2h4.6" stroke="#8A6258" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M9.6 3.6h4.8v2.3H9.6z" fill="#FFFDF9" fillOpacity=".85" stroke="#8A6258" strokeWidth="1.1" strokeLinejoin="round"/>
    </svg>
  );
}
