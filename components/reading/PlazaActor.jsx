"use client";
// =============================================================
// 책 광장의 캐릭터 한 명(과 그 펫) — 내 캐릭터와 함께 있는 친구들이 같은 조각으로 섭니다
// -------------------------------------------------------------
// 자리 · 바라보는 쪽 · 걷는 그림은 초당 여러 번 바뀌므로 React가 다시 그리지 않고, 무대(ReadingPlaza의 걸음 루프)가
// ref로 곧바로 적습니다 — place(x, y) · show(방향, 칸) · placePet(x, y) · showPet(방향, 칸, 걷는 중인가).
// 닻(크기 0)이 발이 닿는 점에 서고, 그림 · 이름표 · 그림자가 그 점을 기준으로 놓입니다. 아래쪽에 선 것이 앞에 그려집니다.
// 다시 그려질 때는 at · petAt(지금 자리 — 무대가 든 값)을 그대로 적어 튀지 않습니다.
//
// character — { style, number }(lib/readingCharacterCatalog.js의 characterOf)
// pet       — null(없음) · { species, stage, hatched, ready }. 깨어난 펫은 걷는 그림(단계가 오를수록 크게),
//             알은 종을 드러내지 않는 공통 알(PetFigure) — 알과 걷는 그림이 없는 펫은 걷는 동안 통통 뜁니다(CSS).
// 걷는 그림(시트)을 못 받으면 캐릭터는 예전 그림, 펫은 단계 그림으로 섭니다.
//
// seat — 교실에서 자리에 앉아 있으면 그 자리(lib/readingPlazaMap.js의 CLASSROOM_SEATS 한 칸), 서 있으면 null.
//   앉은 모습을 따로 그리지 않습니다 — 뒷모습(칠판 쪽을 봄)의 정지 그림을 의자에 내려 앉히고, 허리 아래는 잘라 낸 뒤
//   **의자만 남긴 그림**(CLASSROOM_DESK.chair — 책상·의자 그림과 같은 크기 · 같은 자리)을 그 위에 한 번 더 그립니다.
//   그래서 겹치는 차례가 바닥 → 러그 → 책상·의자 → 캐릭터 → 의자가 되어, 캐릭터가 의자에 앉아 등받이 위로 보입니다.
//   무대는 앉은 캐릭터를 seat.sit에 두고 "up"의 정지 그림을 보이게 합니다.
// checked — 오늘 출석했는가(교실에서 · 선생님 화면의 학생들과 학생 화면의 나). 이름표 앞에 초록 ✓ 동그라미가 붙습니다
//   (이름표의 바탕색은 그대로 — 내 것 살구 · 친구 남색 · 선생님 초록).
// =============================================================
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { characterImage } from "@/lib/readingCharacterCatalog";
import { CLASSROOM_DESK, CLASSROOM_SIT_HIDE, PLAZA_BODY, PLAZA_H, PLAZA_W } from "@/lib/readingPlazaMap";
import { PLAZA_EGG_SIZE, SPRITE_BODY, SPRITE_CELL, SPRITE_FOOT, plazaCharacterSheet, plazaCharacterSize, plazaPetSheet, plazaPetSize } from "@/lib/readingPlazaSprites";
import PetFigure from "./PetFigure";
import PlazaSprite from "./PlazaSprite";

const pct = (value, whole) => `${(value / whole * 100).toFixed(3)}%`;
const layer = (y) => String(10 + Math.round(y));
// 앉았을 때 걷는 그림의 아래쪽을 잘라 내는 비율 — 칸의 발 아래 빈 줄 + 발에서 CLASSROOM_SIT_HIDE(원본 px)만큼.
// 칸 크기에 대한 비율이라 화면 배율과 상관없이 같은 자리가 잘립니다.
const SIT_CLIP = `inset(0 0 ${((SPRITE_CELL - SPRITE_FOOT.y + CLASSROOM_SIT_HIDE / (PLAZA_BODY / SPRITE_BODY)) / SPRITE_CELL * 100).toFixed(2)}% 0)`;

const PlazaActor = forwardRef(function PlazaActor({ character, pet = null, name, scale, at, petAt = null, me = false, teacher = false, reading = false, seat = null, checked = false }, ref) {
  const avatarRef = useRef(null);
  const petRef = useRef(null);
  const charSprite = useRef(null);
  const petSprite = useRef(null);
  const petMoving = useRef(false);
  const [spriteMissing, setSpriteMissing] = useState(false);
  const [petSpriteMissing, setPetSpriteMissing] = useState(false);

  useImperativeHandle(ref, () => ({
    place(x, y) {
      const el = avatarRef.current;
      if (!el) return;
      el.style.left = pct(x, PLAZA_W);
      el.style.top = pct(y, PLAZA_H);
      el.style.zIndex = layer(y);
    },
    show(facing, frame) { charSprite.current?.show(facing, frame); },
    placePet(x, y) {
      const el = petRef.current;
      if (!el) return;
      el.style.left = pct(x, PLAZA_W);
      el.style.top = pct(y, PLAZA_H);
      el.style.zIndex = layer(y);
    },
    showPet(facing, frame, walking) {
      petSprite.current?.show(facing, frame);
      if (walking !== petMoving.current) {
        petMoving.current = walking;
        petRef.current?.classList.toggle("is-moving", walking);
      }
    },
  }), []);

  const sheet = plazaCharacterSheet(character);
  const body = plazaCharacterSize(scale);
  const petSheet = pet?.hatched && !petSpriteMissing ? plazaPetSheet(pet.species) : null;
  const petBody = pet ? plazaPetSize(scale, pet.stage) : null;
  const petFigure = pet ? Math.round(pet.hatched ? petBody.body * 1.3 : Math.max(24, PLAZA_EGG_SIZE * scale)) : 0;
  const petSpot = petAt ?? at;

  return (
    <>
      {pet && (
        <div ref={petRef} className="plaza-pet" aria-hidden="true"
          style={{ left: pct(petSpot.x, PLAZA_W), top: pct(petSpot.y, PLAZA_H), zIndex: layer(petSpot.y) }}>
          <span className="plaza-avatar-shadow" style={{ width: petBody.body * 0.62, height: petBody.body * 0.2 }} />
          {petSheet
            ? <PlazaSprite ref={petSprite} src={petSheet} size={petBody.cell} style={{ left: -petBody.footX, top: -petBody.footY }} onMissing={() => setPetSpriteMissing(true)} />
            : <span className="plaza-pet-figure" style={{ left: -petFigure / 2, top: -petFigure * 0.93 }}><PetFigure species={pet.species} stage={pet.stage} ready={pet.ready} size={petFigure} /></span>}
        </div>
      )}
      <div ref={avatarRef} className={`plaza-avatar${me ? " is-me" : ""}${teacher ? " is-teacher" : ""}${reading ? " is-reading" : ""}${seat ? " is-seated" : ""}${checked ? " is-checked" : ""}`} aria-hidden="true"
        style={{ left: pct(at.x, PLAZA_W), top: pct(at.y, PLAZA_H), zIndex: layer(at.y) }}>
        {!seat && <span className="plaza-avatar-shadow" style={{ width: body.body * 0.5, height: body.body * 0.15 }} />}
        {sheet && !spriteMissing
          ? <PlazaSprite ref={charSprite} src={sheet} size={body.cell} style={{ left: -body.footX, top: -body.footY, clipPath: seat ? SIT_CLIP : undefined }} onMissing={() => setSpriteMissing(true)} />
          : <img className="plaza-avatar-img" src={characterImage(character)} alt="" draggable={false}
              style={{ width: body.body * 1.3, height: body.body * 1.3, left: -body.body * 0.65, top: -body.body * 1.24 }} />}
        {/* 의자 — 책상·의자 그림과 같은 자리에 '의자만'의 그림을 앉은 캐릭터 위에 한 번 더(닻은 seat.sit에 서 있음) */}
        {seat && (
          <img className="plaza-chair" src={CLASSROOM_DESK.chair} alt="" draggable={false}
            style={{ left: (seat.box[0] - seat.sit.x) * scale, top: (seat.box[1] - seat.sit.y) * scale, width: CLASSROOM_DESK.w * scale, height: CLASSROOM_DESK.h * scale }} />
        )}
        {/* 이름표 — 서 있으면 머리 위, 앉아 있으면 의자 등받이에(머리 위에 띄우면 앞줄 친구의 의자를 가립니다) */}
        <span className="plaza-avatar-name" style={seat ? { top: Math.round((seat.chair[1] + 11 - seat.sit.y) * scale), translate: "0 -50%" } : { bottom: Math.round(body.body) + 5 }}>
          {/* 글을 읽는 중(가판대 · 책꽂이 창을 연 동안) — 펼친 책 */}
          {reading && (
            <svg className="plaza-avatar-book" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <path d="M8 3.6C6.6 2.7 4.7 2.4 2.5 2.7v9.4c2.2-.3 4.1 0 5.5.9 1.4-.9 3.3-1.2 5.5-.9V2.7c-2.2-.3-4.1 0-5.5.9Zm0 0v9.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          )}
          {checked && <i className="plaza-avatar-check">✓</i>}
          {name}
        </span>
      </div>
    </>
  );
});

export default PlazaActor;
