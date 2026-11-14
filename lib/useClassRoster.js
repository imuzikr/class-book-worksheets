"use client";
// =============================================================
// 반 명단 훅 — 소속 구독 + 명단 짓기
// -------------------------------------------------------------
// `subscribeClassMembers`를 거는 effect와 명단을 짓는 useMemo가 화면마다
// 같은 모양으로 되풀이돼 있었습니다(공부방 · 책방 · 손든 학생 자리 확인 ·
// 상단바 반 공지). 명단의 모양은 lib/roster.js가 정합니다.
//
// 학생 프로필(실명 · 학번)은 **그 반 학생 것만** 받습니다(subscribeClassDirectory —
// 소속을 따라 users 문서를 한 건씩). 한때 페이지마다 users 컬렉션을 통째로 구독해
// 받아 넘겼는데(subscribeUserDirectory), 그러면 교사 누구나 이 앱의 모든 계정을 받았습니다.
// 과일 누적은 지금까지처럼 **받아서** 씁니다 — 페이지가 이미 다른 데 쓰려고 구독해 둡니다.
// =============================================================
import { useEffect, useMemo, useState } from "react";
import { subscribeClassDirectory, subscribeClassMembers } from "./store";
import { buildClassRoster } from "./roster";

const EMPTY = [];
const NO_JOINED = {};
const EMPTY_STATE = { classId: null, uids: EMPTY, profiles: EMPTY, joined: NO_JOINED };

// 그 반 소속 uid 목록. 반이 없거나 `enabled`가 거짓이면 빈 배열.
// 주의: 첫 답이 오기 전에도 빈 배열입니다 — '없다'와 '아직 모른다'를 갈라야
// 하는 자리(빈 값으로 화면을 통째로 바꾸는 곳)에서는 쓰지 마세요.
export function useClassMembers(classId, enabled = true) {
  const [uids, setUids] = useState([]);
  useEffect(() => {
    if (!enabled || !classId) {
      setUids([]);
      return undefined;
    }
    return subscribeClassMembers(classId, setUids);
  }, [classId, enabled]);
  return uids;
}

// { memberUids, roster, profiles } — roster는 학번순, 칸마다 { uid, name, studentId,
// emoji, email, count }(+ 펫을 받은 학생은 pet · 들어온 때를 아는 학생은 joinedAt).
// profiles는 읽힌 학생의 디렉터리 줄(과일 이름표 등).
// [교사 화면 전용] 학생 프로필 읽기는 규칙이 '그 반을 가르치는 교사'에게만 엽니다.
export function useClassRoster(classId, { enabled = true, rewards = EMPTY } = {}) {
  const [state, setState] = useState(EMPTY_STATE);
  useEffect(() => {
    if (!enabled || !classId) {
      setState(EMPTY_STATE);
      return undefined;
    }
    return subscribeClassDirectory(classId, ({ uids, profiles, joined }) => setState({ classId, uids, profiles, joined: joined ?? NO_JOINED }));
  }, [classId, enabled]);
  // 반을 바꾼 직후 앞 반의 명단이 한 박자 남지 않게, 지금 반의 답일 때만 씁니다.
  const live = enabled && state.classId === classId;
  const memberUids = live ? state.uids : EMPTY;
  const profiles = live ? state.profiles : EMPTY;
  const joined = live ? state.joined : NO_JOINED;
  const roster = useMemo(
    () => buildClassRoster(memberUids, profiles, rewards, joined),
    [memberUids, profiles, rewards, joined]
  );
  return { memberUids, roster, profiles };
}
