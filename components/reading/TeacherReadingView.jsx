"use client";
// =============================================================
// 교사의 책나눔 — 왼쪽 반 학생 명단 · 오른쪽 고른 학생의 책나눔(읽기 전용)
// 선생님 결정: 책꽂이(한때 이름이 '서재') · 독서 발자국 · 한 권의 책(감상)까지 전부 보입니다.
// 읽기는 /api/reading?uid= — 서버가 담당 교사 · 관리자이고 그 학생이 이 반
// 소속인지 확인합니다(lib/server/readingService.js의 getReading).
// 명단은 페이지가 이미 받아 둔 useClassRoster(학번순)를 그대로 씁니다(읽기 0).
//
// **책 광장의 입구는 명단 위의 '책 광장 들어가기'입니다**(광장을 켠 반 — 선생님 신고로 세움).
// 책 광장은 반 전체의 자리라 고른 학생과 무관하게, **학생이 한 명도 없는 반에서도** 들어갑니다.
// 한때 길이 고른 학생 화면(ReadingHub)의 셋째 탭 하나뿐이라 학생이 없는 반에서는 탭 줄 자체가 없었고
// (주소에 ?tab=plaza를 붙여도 안 열림), 학생이 있는 반에서도 '○○의 독서 여정' 안에 섞여 입구로 보이지 않았습니다.
// 그 탭은 그대로 두었습니다(같은 광장으로 감) — 입구를 다시 그 탭 하나로 줄이지 마세요.
//
// **펫 먹이**(관리자 설정의 '펫 먹이'를 켠 반 — lib/petCare.js): 명단의 이름 옆에 그 학생 펫의 배부름이 섭니다
// (배고픔은 살구 · 오늘이 고비면 붉게 · 먹이를 찾아 떠났으면 '떠남'), 명단 위에는 '배고픈 펫 n · 떠난 펫 n'.
// 떠난 펫의 학생을 고르면 그 화면 위에 **'불러 주기'**가 섭니다 — 긴 병결 같은 예외에 선생님이 걸음과 상관없이
// 곧바로 불러 줍니다(서버가 담당 교사인지 확인 · recallReadingPet). 배부름은 명단이 이미 받아 둔 학생 프로필의
// 펫으로 셉니다(읽기 0 — lib/roster.js의 pet · 학생마다 이 반에 들어온 날 joinedAt부터).
// =============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import ReadingHub, { TeacherPlaza } from "./ReadingHub";
import { recallReadingPet, subscribeRosterPets } from "@/lib/data/reading";
import { careRulesFor, careStatus } from "@/lib/petCare";
import { petSpecies } from "@/lib/readingPet";
import { kstToday } from "@/lib/reading";
import { iGa } from "@/lib/korean";

// 고른 학생은 주소(?student=)가 듭니다 — 리더보드의 '책꽂이로 이동'이 그 학생을 짚어 열고,
// 새로고침해도 그 학생입니다. 명단을 누르면 주소만 바꿉니다(replace).
// plazaCall — 선생님의 '모두 이동'이 10초를 다 세고 모두를 데려오는 신호의 '보낸 때'(책방 페이지가 넘김 · 없으면 0).
//   누른 선생님이 세는 동안 광장에서 나와 명단을 보고 있었으면, 다 셌을 때 선생님도 광장으로 돌아갑니다('모두'에는
//   선생님도 듭니다). 떠 있는 동안 값이 바뀔 때만입니다(처음 받은 값은 기준일 뿐).
// petOn · petFeed — 학생 펫과 펫 먹이의 규칙(책방 페이지가 넘김 — 끈 반이면 배부름을 그리지 않음) · onToast — 알림 한 줄.
export default function TeacherReadingView({ classId, user, roster = [], studentUid = null, onPickStudent, plazaOn = false, initialTab = "library", plazaCall = 0, petOn = false, petFeed = null, onToast = null, ...hubProps }) {
  const student = roster.find((s) => s.uid === studentUid) || roster[0] || null;
  // 펫 먹이 — 학생마다의 배부름(명단이 싣고 온 프로필의 펫으로 셈 · 체험반은 이 브라우저 안의 펫)
  const feedOn = petOn && !!petFeed?.on;
  const [pets, setPets] = useState(() => new Map());
  useEffect(() => {
    if (!feedOn) { setPets(new Map()); return undefined; }
    return subscribeRosterPets(roster, setPets);
  }, [feedOn, roster]);
  const today = kstToday();
  const careOf = useMemo(() => {
    const map = new Map();
    if (!feedOn) return map;
    // 학생마다 이 반에 들어온 날부터 셉니다(명단의 joinedAt — 학생 화면 · 서버와 같은 셈)
    const joined = new Map(roster.map((s) => [s.uid, s.joinedAt ?? null]));
    for (const [uid, mirror] of pets) if (mirror) map.set(uid, { mirror, status: careStatus(mirror, careRulesFor(petFeed, joined.get(uid)), today) });
    return map;
  }, [feedOn, pets, petFeed, today, roster]);
  const hungryCount = [...careOf.values()].filter((c) => c.status?.hungry).length;
  const awayCount = [...careOf.values()].filter((c) => c.status?.away).length;
  const [recalling, setRecalling] = useState(false);
  const [recallError, setRecallError] = useState("");
  useEffect(() => { setRecallError(""); }, [student?.uid]);
  async function recall(target) {
    if (recalling) return;
    setRecalling(true);
    setRecallError("");
    try {
      await recallReadingPet(classId, target.uid);
      onToast?.(`${target.name}의 펫을 불러 주었어요. 배부름 60에서 다시 시작해요.`);
    } catch (e) {
      setRecallError(e?.message || "펫을 불러 주지 못했어요. 잠시 뒤 다시 해 주세요.");
    } finally {
      setRecalling(false);
    }
  }
  const picked = student ? careOf.get(student.uid) : null;
  // 책 광장에 들어가 있는가 — 주소의 ?tab=plaza로 열었으면 처음부터(학생 화면과 같은 주소). 나가면 명단으로 돌아옵니다.
  const [plazaOpen, setPlazaOpen] = useState(initialTab === "plaza");
  const seenCall = useRef(plazaCall);
  useEffect(() => {
    if (plazaCall === seenCall.current) return;
    seenCall.current = plazaCall;
    if (plazaCall && plazaOn) setPlazaOpen(true);
  }, [plazaCall, plazaOn]);
  if (plazaOn && plazaOpen) {
    return (
      <div className="reading-teacher">
        <TeacherPlaza key={classId} classId={classId} user={user} characterOn={hubProps.characterOn} classroom={hubProps.classroom} onExit={() => setPlazaOpen(false)} />
      </div>
    );
  }
  // 광장에서 나온 뒤 서는 학생 화면은 첫 탭부터 — 주소에 tab=plaza가 남아 있어도 그 화면이 다시 광장을 열지 않게.
  const hubTab = plazaOn && initialTab === "plaza" ? "library" : initialTab;
  return (
    <div className="reading-teacher">
      <aside className="reading-teacher-rail" aria-label="책 광장 입구와 학생 명단">
        {plazaOn && (
          <button type="button" className="reading-teacher-plaza" onClick={() => setPlazaOpen(true)}>
            <strong>책 광장 들어가기 <span aria-hidden="true">→</span></strong>
            <small>{hubProps.classroom?.on ? "광장의 포털로 교실에도 가요" : "학생들의 책과 글을 함께 봐요"}</small>
          </button>
        )}
        <h3>학생 명단 <span>{roster.length}</span></h3>
        {feedOn && careOf.size > 0 && (
          <p className={`reading-teacher-care${hungryCount || awayCount ? " is-alert" : ""}`}>
            펫 먹이 · {hungryCount || awayCount ? <>배고픈 펫 <b>{hungryCount}</b> · 떠난 펫 <b>{awayCount}</b></> : "모두 든든해요"}
          </p>
        )}
        {roster.length === 0 ? <p className="reading-muted">아직 이 반에 들어온 학생이 없어요.</p> : (
          <ol>
            {roster.map((s) => (
              <li key={s.uid}>
                <button type="button" className={student?.uid === s.uid ? "on" : ""} aria-current={student?.uid === s.uid ? "true" : undefined} onClick={() => onPickStudent?.(s.uid)}>
                  {s.studentId && <span className="reading-teacher-sid">{s.studentId}</span>}
                  <span className="reading-teacher-name">{s.name}</span>
                  {careOf.get(s.uid)?.status && <PetCareChip status={careOf.get(s.uid).status} />}
                </button>
              </li>
            ))}
          </ol>
        )}
      </aside>
      <div className="reading-teacher-main">
        {student && picked?.status?.away && (
          <div className="reading-teacher-recall" role="status">
            <span>
              <strong>{student.name}의 {picked.mirror.species ? `펫 ${iGa(petSpecies(picked.mirror.species)?.name ?? "펫")}` : "알이"} {picked.mirror.species ? "먹이를 찾아" : "따뜻한 곳을 찾아"} 떠나 있어요.</strong>
              <small>학생이 책을 읽고 발자국을 남기면(하루 한 걸음) 돌아와요 — 지금까지 {picked.status.care.away.days.length + picked.status.care.away.fruit}걸음. 병결처럼 사정이 있으면 선생님이 곧바로 불러 줄 수 있어요.</small>
              {recallError && <small className="reading-teacher-recall-error" role="alert">{recallError}</small>}
            </span>
            <button type="button" className="btn-primary" disabled={recalling} onClick={() => recall(student)}>{recalling ? "불러 주는 중…" : "불러 주기"}</button>
          </div>
        )}
        {student ? <ReadingHub key={`${classId}:${student.uid}`} classId={classId} user={user} isTeacher student={{ uid: student.uid, name: student.name }} plazaOn={plazaOn} initialTab={hubTab} {...hubProps} />
          : <div className="reading-empty"><h3>학생을 기다리고 있어요.</h3><p>학생이 참여 코드로 들어오면 이곳에서 학생마다의 책나눔을 볼 수 있어요.{plazaOn ? " 책 광장은 지금도 ‘책 광장 들어가기’로 둘러볼 수 있어요." : ""}</p></div>}
      </div>
    </div>
  );
}

// 명단의 이름 옆 — 그 학생 펫의 배부름(떠났으면 '떠남'). 색만으로 가르지 않게 글자를 함께 적습니다.
function PetCareChip({ status }) {
  const label = status.away ? "떠남" : `배부름 ${status.full}`;
  const tone = status.away ? " is-away" : status.low ? " is-low" : status.hungry ? " is-hungry" : "";
  const title = status.away ? "펫이 먹이를 찾아 떠나 있어요" : status.low ? "오늘 먹이를 못 먹으면 떠나요" : status.hungry ? "펫이 배고파해요" : "펫의 배부름";
  return <span className={`reading-teacher-chip${tone}`} title={title}>{label}</span>;
}
