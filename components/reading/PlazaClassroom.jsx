"use client";
// =============================================================
// 교실(책 광장의 둘째 방)에서 그림 위에 얹는 것 — 러그와 책상 · 내 러그 표시 · 물음표 · 고르는 단추 · 출석 표시
// -------------------------------------------------------------
// 무대(ReadingPlaza.jsx)의 그림(.plaza-world) 안에 그립니다. 자리는 그림 원본 px를 %로 바꿔 놓고(그림과 함께 움직임),
// 글자 · 단추의 크기는 화면 px 그대로입니다(맵을 줄여도 읽을 수 있게).
//   · PlazaFurniture — **러그 서른 장과 책상·의자 서른 벌**. 교실 배경에는 책상이 없고(선생님이 주신 분리 그림),
//     자리 좌표(lib/readingPlazaMap.js의 CLASSROOM_SEATS)대로 여기서 그립니다. 러그가 아래, 책상·의자가 위.
//   · 학생 — **내 러그**에 살구빛 테(그 러그가 내 자리의 범위 — 선생님 요청)와 책상 위의 '내 자리' 이름표.
//     러그에 올라서면 테가 밝아지고 책상 위(이름표 자리)에 물음표가 뜹니다. A(또는 물음표를 누름) → [앉기(S) · 취소(C)].
//     앉아 있으면 A(또는 내 자리를 누름) → [다시 서기(S) · 취소(C)] — 앉은 동안에는 물음표를 띄우지 않습니다(앉은 캐릭터의 머리를 가림).
//   · 선생님 — 책상마다 학생 이름, 칠판 앞에 서면 칠판에 물음표가 뜨고 A → [출석시작(S) · 출석종료(C)].
//   · 오늘 출석은 **이름표 앞의 초록 ✓ 동그라미**로 표시합니다 — 책상의 이름표에(앉아 있으면 의자 등받이의 이름표에 — PlazaActor).
//     이름표의 바탕색은 그대로입니다(내 것 살구 · 친구 남색 · 선생님 초록). 책상 모서리에 따로 띄우던 ✓ 동그라미는
//     걷었습니다(책상이 한 줄씩이 되면서 러그에 올라선 캐릭터의 얼굴을 가림).
// 어디에 서 있는지 · 무엇을 고르는 중인지는 무대가 정해 넘깁니다(셈은 lib/readingClassroom.js).
// =============================================================
import { memo } from "react";
import { CLASSROOM_BOARD, CLASSROOM_DESK, CLASSROOM_RUG, CLASSROOM_SEATS, PLAZA_H, PLAZA_W } from "@/lib/readingPlazaMap";

const pct = (value, whole) => `${(value / whole * 100).toFixed(3)}%`;
const at = (point) => ({ left: pct(point.x, PLAZA_W), top: pct(point.y, PLAZA_H) });
// 러그와 책상·의자 — 자리마다 한 벌. 좌표가 바뀌지 않으니 한 번만 그립니다(memo). 누름은 뒤의 바닥으로 통과합니다.
export const PlazaFurniture = memo(function PlazaFurniture() {
  return (
    <>
      {CLASSROOM_SEATS.map((seat) => (
        <img key={`rug-${seat.index}`} className="plaza-rug" src={CLASSROOM_RUG.src} alt="" draggable={false}
          style={{ left: pct(seat.rug.x - CLASSROOM_RUG.w / 2, PLAZA_W), top: pct(seat.rug.y - CLASSROOM_RUG.h / 2, PLAZA_H), width: pct(CLASSROOM_RUG.w, PLAZA_W), height: pct(CLASSROOM_RUG.h, PLAZA_H) }} />
      ))}
      {CLASSROOM_SEATS.map((seat) => (
        <img key={`desk-${seat.index}`} className="plaza-desk-art" src={CLASSROOM_DESK.src} alt="" draggable={false}
          style={{ left: pct(seat.box[0], PLAZA_W), top: pct(seat.box[1], PLAZA_H), width: pct(CLASSROOM_DESK.w, PLAZA_W), height: pct(CLASSROOM_DESK.h, PLAZA_H) }} />
      ))}
    </>
  );
});

// 앉기 · 다시 서기 단추를 물음표 자리(책상 윗면)에서 얼마나 올려 띄우나(그림 원본 px) — 책상 윗변 위로 32px쯤
const MENU_LIFT = 66;
// 칠판의 고르는 단추(출석시작 · 출석종료)는 **선생님 옆, 칠판 위**에 뜹니다 — 상자의 아랫변이 선생님의 발 높이(원본 px).
// 머리 위(물음표 자리)에 띄우면 위쪽에 자리가 모자랍니다 — 선생님 머리 위로는 그림 132px(화면 80~115px)뿐인데 상자는
// 109~127px라, 1440×900에서도 '출석을 받는 중' 안내가 화면 밖으로 잘렸고 1024×700에서는 안내 글이 통째로 잘렸습니다(실측).
// 옆에 띄우면 첫 줄 책상(280px~)과 거기 앉은 학생의 머리(254px~)를 가리지 않습니다. 칠판 가운데보다 왼쪽에 섰으면 오른쪽에,
// 오른쪽에 섰으면 왼쪽에 — 화면 안쪽으로. 무대가 좁으면(폰) 옆자리가 없어 발 아래에 띄웁니다(plaza.css의 .plaza-act--board).
const BOARD_MENU_FOOT = CLASSROOM_BOARD.standY - 2;
const BOARD_MENU_BELOW = CLASSROOM_BOARD.standY + 14;
const BOARD_MID = (CLASSROOM_BOARD.rect[0] + CLASSROOM_BOARD.rect[2]) / 2;
const MENUS = {
  sit: { title: "내 자리", primary: "앉기", secondary: "취소" },
  stand: { title: "내 자리", primary: "다시 서기", secondary: "취소" },
  board: { title: "출석", primary: "출석시작", secondary: "출석종료" },
};

// menu        고르는 중인 것 — { kind: "sit" | "stand" | "board", x?(칠판일 때 선생님이 선 자리) }
// teacher     선생님 화면인가
// desks       책상마다 앉을 학생 uid(30칸 · 없으면 null) — lib/readingClassroom.js의 classroomDesks
// names       [선생님] uid → { name, studentId }(지금 명단)
// mySeat      [학생] 내 자리 번호(없으면 null) · sitting 앉아 있는 자리 번호(서 있으면 null)
// hint        지금 A를 누르면 물을 것이 있는가 — "seat"(내 러그 위 · 앉아 있음) · "board"(칠판 앞) · null
// boardMark   칠판의 물음표가 뜰 자리 · menu 고르는 중인 것({ kind }) · roll 출석 수({ present, total })
// present     [선생님] 오늘 출석한 uid들(Set · 기록이 없으면 null) · attended [학생] 오늘 출석했나 · openToday 오늘 출석이 열려 있나
// seated      지금 의자에 앉아 있는 자리 번호들(Set) — 그 책상의 이름표는 몸에 가려 걷습니다
export default function PlazaClassroom({ teacher = false, desks, names, mySeat = null, sitting = null, hint = null, boardMark = null, menu = null,
  present = null, attended = false, openToday = false, roll = null, seated, onAct, onChoose }) {
  const mine = mySeat !== null ? CLASSROOM_SEATS[mySeat] : null;
  const anchor = (menu?.kind ?? hint) === "board" ? boardMark : mine?.mark ?? null;
  // 고르는 단추는 책상보다 조금 위에 — 책상과 그 옆에 선(또는 앉은) 내 캐릭터의 머리 · 이름표가 단추 아래로 보이게.
  // (책상 윗변에 붙였을 때는 '다시 서기' 단추가 앉은 캐릭터의 머리를 덮었습니다 — 실측)
  const menuAt = anchor && menu?.kind !== "board" ? { x: anchor.x, y: anchor.y - MENU_LIFT } : anchor;
  // 칠판의 고르는 단추 — 선생님이 선 자리(menu.x · 없으면 물음표 자리)의 옆
  const boardX = menu?.kind === "board" ? (Number.isFinite(menu.x) ? menu.x : anchor?.x ?? BOARD_MID) : null;
  const menuStyle = boardX !== null
    ? { left: pct(boardX, PLAZA_W), "--act-foot": pct(BOARD_MENU_FOOT, PLAZA_H), "--act-below": pct(BOARD_MENU_BELOW, PLAZA_H) }
    : menuAt ? at(menuAt) : null;
  const menuSide = boardX === null ? "" : boardX <= BOARD_MID ? " is-right" : " is-left";
  // 내 책상의 이름표 — 물음표 · 고르는 단추가 그 자리에 뜨는 동안과 앉아 있는 동안에는 걷습니다
  const asking = !teacher && sitting === null && (hint === "seat" || menu?.kind === "sit");
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
          !seated?.has(i) && (
            <span key={uid} className={`plaza-desk-name${here ? " is-present" : ""}`} style={at(seat.desk)}>
              {here && <i role="img" aria-label="출석">✓</i>}{who.name}
            </span>
          )
        );
      })}
      {/* 학생 — 내 자리(러그를 두른 테 — 올라서면 밝아짐 · 책상 위의 이름표 · 출석했으면 ✓) */}
      {!teacher && mine && (
        <>
          <span className={`plaza-rug-mine${sitting !== null ? " is-seated" : hint === "seat" ? " is-on" : ""}`} aria-hidden="true"
            style={{ left: pct(mine.rug.x - CLASSROOM_RUG.rx, PLAZA_W), top: pct(mine.rug.y - CLASSROOM_RUG.ry, PLAZA_H), width: pct(CLASSROOM_RUG.rx * 2, PLAZA_W), height: pct(CLASSROOM_RUG.ry * 2, PLAZA_H) }} />
          {sitting === null && !asking && (
            <span className={`plaza-desk-name plaza-desk-name--mine${attended ? " is-present" : ""}`} style={at(mine.desk)}>
              {attended && <i role="img" aria-label="오늘 출석 완료">✓</i>}내 자리
            </span>
          )}
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
      {copy && menuStyle && (
        <div className={`plaza-act plaza-act--${menu.kind}${menuSide}`} style={menuStyle} role="group" aria-label={`${copy.title} — ${copy.primary}(S) · ${copy.secondary}(C)`}>
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
