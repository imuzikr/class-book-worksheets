"use client";
// =============================================================
// 교실(책 광장의 둘째 방)에서 그림 위에 얹는 것 — 내 책상 표시 · 물음표 · 고르는 단추 · 출석 표시
// -------------------------------------------------------------
// 무대(ReadingPlaza.jsx)의 그림(.plaza-world) 안에 그립니다. 자리는 그림 원본 px를 %로 바꿔 놓고(그림과 함께 움직임),
// 글자 · 단추의 크기는 화면 px 그대로입니다(맵을 줄여도 읽을 수 있게).
//   · 학생 — 제 책상 둘레의 테와 '내 자리' 이름표. 책상 옆에 가면 책상 위에 물음표가 뜨고,
//     A(또는 물음표를 누름) → [앉기(S) · 취소(C)]. 앉아 있으면 A(또는 내 자리를 누름) → [다시 서기(S) · 취소(C)] —
//     앉은 동안에는 물음표를 띄우지 않습니다(앉은 캐릭터의 머리를 가림).
//   · 선생님 — 책상마다 학생 이름, 오늘 출석한 학생의 책상에는 ✓. 칠판 앞에 서면 칠판에 물음표가 뜨고,
//     A → [출석시작(S) · 출석종료(C)].
// 어디에 서 있는지 · 무엇을 고르는 중인지는 무대가 정해 넘깁니다(셈은 lib/readingClassroom.js).
// =============================================================
import { CLASSROOM_SEATS, PLAZA_H, PLAZA_W } from "@/lib/readingPlazaMap";

const pct = (value, whole) => `${(value / whole * 100).toFixed(3)}%`;
const at = (point) => ({ left: pct(point.x, PLAZA_W), top: pct(point.y, PLAZA_H) });
const MENUS = {
  sit: { title: "내 자리", primary: "앉기", secondary: "취소" },
  stand: { title: "내 자리", primary: "다시 서기", secondary: "취소" },
  board: { title: "출석", primary: "출석시작", secondary: "출석종료" },
};

// teacher     선생님 화면인가
// desks       책상마다 앉을 학생 uid(30칸 · 없으면 null) — lib/readingClassroom.js의 classroomDesks
// names       [선생님] uid → { name, studentId }(지금 명단)
// mySeat      [학생] 내 자리 번호(없으면 null) · sitting 앉아 있는 자리 번호(서 있으면 null)
// hint        지금 A를 누르면 물을 것이 있는가 — "seat"(내 책상 옆 · 앉아 있음) · "board"(칠판 앞) · null
// boardMark   칠판의 물음표가 뜰 자리 · menu 고르는 중인 것({ kind }) · roll 출석 수({ present, total })
// present     [선생님] 오늘 출석한 uid들(Set · 기록이 없으면 null) · attended [학생] 오늘 출석했나 · openToday 오늘 출석이 열려 있나
// seated      지금 의자에 앉아 있는 자리 번호들(Set) — 그 책상의 이름표는 몸에 가려 걷습니다
export default function PlazaClassroom({ teacher = false, desks, names, mySeat = null, sitting = null, hint = null, boardMark = null, menu = null,
  present = null, attended = false, openToday = false, roll = null, seated, onAct, onChoose }) {
  const mine = mySeat !== null ? CLASSROOM_SEATS[mySeat] : null;
  const anchor = (menu?.kind ?? hint) === "board" ? boardMark : mine?.mark ?? null;
  // 고르는 단추는 물음표보다 조금 위에 — 책상 옆에 선(또는 앉은) 내 캐릭터의 머리를 가리지 않게
  const menuAt = anchor && menu?.kind !== "board" ? { x: anchor.x, y: anchor.y - 24 } : anchor;
  const copy = menu ? MENUS[menu.kind] : null;
  const canStop = menu?.kind === "board" && openToday;
  return (
    <>
      {/* 선생님 — 책상마다 학생 이름(의자에 앉아 있으면 캐릭터의 이름표가 대신 보임) */}
      {teacher && desks.map((uid, i) => {
        const who = uid ? names?.get(uid) : null;
        if (!who) return null;
        const seat = CLASSROOM_SEATS[i];
        const here = present?.has(uid);
        return (
          <span key={uid} className="plaza-desk">
            {!seated?.has(i) && <span className="plaza-desk-name" style={at(seat.desk)}>{who.name}</span>}
            {here && <span className="plaza-desk-check" style={at({ x: seat.desk.x + 44, y: seat.desk.y - 16 })} role="img" aria-label={`${who.name} 출석`}>✓</span>}
          </span>
        );
      })}
      {/* 학생 — 내 책상(책상과 의자를 두른 테 · 이름표 · 출석했으면 ✓) */}
      {!teacher && mine && (
        <>
          <span className={`plaza-desk-mine${sitting !== null ? " is-seated" : ""}`} aria-hidden="true"
            style={{ left: pct(mine.desk.x - 50, PLAZA_W), top: pct(mine.desk.y - 21, PLAZA_H), width: pct(100, PLAZA_W), height: pct(84, PLAZA_H) }} />
          {sitting === null && <span className="plaza-desk-name plaza-desk-name--mine" style={at(mine.desk)}>내 자리</span>}
          {attended && <span className="plaza-desk-check" style={at({ x: mine.desk.x + 44, y: mine.desk.y - 16 })} role="img" aria-label="오늘 출석 완료">✓</span>}
        </>
      )}
      {/* 물음표 — 지금 A를 누르면 물을 것이 있습니다(눌러도 같음 — 자판이 없는 기기) */}
      {hint && anchor && !menu && sitting === null && (
        <button type="button" className="plaza-mark" style={at(anchor)} onClick={onAct}
          aria-label={hint === "board" ? "출석 — A를 누르거나 눌러서 고르기" : "앉기 — A를 누르거나 눌러서 고르기"}>
          ?<i aria-hidden="true">A</i>
        </button>
      )}
      {/* 고르기 — 두 단추는 같은 크기(S · C로도 고름) */}
      {copy && menuAt && (
        <div className={`plaza-act plaza-act--${menu.kind}`} style={at(menuAt)} role="group" aria-label={`${copy.title} — ${copy.primary}(S) · ${copy.secondary}(C)`}>
          {menu.kind === "board" && (
            <p className="plaza-act-note">
              {openToday
                ? <>출석을 받는 중이에요{roll ? <> · <b>{roll.present}</b>/{roll.total}</> : null}<small>출석시작을 다시 누르면 지금 앉아 있는 학생을 한 번 더 확인해요.</small></>
                : <>지금 제자리에 앉아 있는 학생만 출석으로 확인돼요.</>}
            </p>
          )}
          <div className="plaza-act-buttons">
            <button type="button" className="plaza-act-yes" onClick={() => onChoose(true)}>{copy.primary}<kbd>S</kbd></button>
            <button type="button" className="plaza-act-no" onClick={() => onChoose(false)} disabled={menu.kind === "board" && !canStop}
              title={menu.kind === "board" && !canStop ? "출석을 받는 중이 아니에요" : undefined}>{copy.secondary}<kbd>C</kbd></button>
          </div>
        </div>
      )}
    </>
  );
}
