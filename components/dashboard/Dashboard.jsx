"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/AuthGate";
import TopNav from "@/components/TopNav";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { isAdmin, isTeacher } from "@/lib/user";
import SuspendedScreen, { isSuspendedUser } from "@/components/SuspendedScreen";
import { isFirebaseConfigured } from "@/lib/firebase";
import { subscribeClasses, subscribeMyMemberships } from "@/lib/store";
import { getSelectedClassId, setSelectedClassId } from "@/lib/classroom";
import { kstToday } from "@/lib/reading";
import { fetchDashboard } from "@/lib/data/dashboard";
import TeacherReportShell from "./TeacherReportShell";
import StudentProfileDialog from "./StudentProfileDialog";
import { TeacherPersonalReport, OverallReport } from "./TeacherReports";
import {
  Empty, Section, Metric, Snapshot, Reflections, Feedback, TeacherReading, Calendar,
  NextActions, PersonalGrowth, StudentPortfolio, SemesterDialog, Dialog,
  fmt, fullDate, asArray, libraryHref,
} from "./DashboardParts";
import "./dashboard.css";

// Scope-tagged responses prevent a previous student/class from flashing while a
// new report is loading. Every change aborts the prior request, including tabs.
function useReportRequest(options, enabled, refresh, context = "") {
  const optionsKey = JSON.stringify(options);
  const key = JSON.stringify([optionsKey, context]);
  const [envelope, setEnvelope] = useState({ key: "", data: null, error: "", status: "idle" });
  const sequence = useRef(0);
  useEffect(() => {
    const current = ++sequence.current;
    if (!enabled) return undefined;
    const controller = new AbortController();
    setEnvelope({ key, data: null, error: "", status: "loading" });
    // cacheTag — 새로고침 · 고친 뒤에는 기억해 둔 보고서 대신 새로 받습니다(lib/data/dashboard.js)
    fetchDashboard({ ...JSON.parse(optionsKey), signal: controller.signal, cacheTag: refresh })
      .then((data) => { if (!controller.signal.aborted && current === sequence.current) setEnvelope({ key, data, error: "", status: "ready" }); })
      .catch((failure) => { if (!controller.signal.aborted && current === sequence.current) setEnvelope({ key, data: null, error: failure?.message || "분석 리포트를 불러오지 못했습니다.", status: "error" }); });
    return () => controller.abort();
  }, [optionsKey, key, enabled, refresh]);
  const data = enabled && envelope.key === key && envelope.status === "ready" ? envelope.data : null;
  const error = enabled && envelope.key === key && envelope.status === "error" ? envelope.error : "";
  return { data, error, key, loading: enabled && !data && !error };
}

export default function Dashboard() {
  return <AuthGate><DashboardIdentity /></AuthGate>;
}

function DashboardIdentity() {
  const user = useCurrentUser();
  if (!user) return null;
  if (isSuspendedUser(user)) return <SuspendedScreen user={user} />;
  return <DashboardSession key={user.uid + ":" + user.role} user={user} />;
}

function DashboardSession({ user }) {
  const teacher = isTeacher(user);
  const admin = isAdmin(user);
  const [classes, setClasses] = useState([]);
  const [classesLoaded, setClassesLoaded] = useState(false);
  const [memberships, setMemberships] = useState([]);
  const [membershipsLoaded, setMembershipsLoaded] = useState(teacher);
  const [selectedClass, setClass] = useState(null);
  const [tab, setTab] = useState("personal");
  const [studentChoice, setStudentChoice] = useState(null);
  const [directoryState, setDirectoryState] = useState({ classId: null, students: [] });
  const [period, setPeriod] = useState("weekly");
  const [today, setToday] = useState(() => kstToday());
  const [start, setStart] = useState(() => kstToday().slice(0, 7) + "-01");
  const [end, setEnd] = useState(() => kstToday());
  const [activityChoice, setActivityChoice] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [dayChoice, setDayChoice] = useState(null);
  const [semesterChoice, setSemesterChoice] = useState(null);
  const [profileStudent, setProfileStudent] = useState(null);
  const [notice, setNotice] = useState("");

  // 보이는 반만 — 관리자 전체 · 교사 내가 만든 반 · 학생 내가 든 반(lib/data/classes.js).
  useEffect(() => {
    setClassesLoaded(false);
    return subscribeClasses({ uid: user.uid, role: user.role }, (list) => { setClasses(list); setClassesLoaded(true); });
  }, [user.uid, user.role]);
  useEffect(() => {
    if (teacher) { setMembershipsLoaded(true); return undefined; }
    return subscribeMyMemberships(user.uid, (list) => { setMemberships(list); setMembershipsLoaded(true); });
  }, [teacher, user.uid]);
  useEffect(() => {
    const sync = () => setClass(getSelectedClassId());
    sync();
    window.addEventListener("class-change", sync);
    return () => window.removeEventListener("class-change", sync);
  }, []);
  // 페이지 이름 — 교사는 '관리자 대시보드', 학생은 '나의 독서 기록'. Next가 메타데이터의
  // 제목을 뒤늦게 다시 적으므로(실측) head가 바뀔 때마다 되돌려 둡니다.
  useEffect(() => {
    const want = (teacher ? "관리자 대시보드" : "나의 독서 기록") + " | 책봄";
    const apply = () => { if (document.title !== want) document.title = want; };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [teacher]);
  useEffect(() => {
    const timer = setInterval(() => setToday(kstToday()), 60000);
    return () => clearInterval(timer);
  }, []);

  // 탈퇴시킬 수 있는 반 — 내가 맡은 반(보관된 반 포함). 관리자는 모든 반.
  const myClasses = useMemo(() => classes.filter((item) => admin || item.createdBy === user.uid), [classes, admin, user.uid]);
  const memberIds = useMemo(() => new Set(memberships.map((membership) => membership.classId)), [memberships]);
  const allowedClasses = classes.filter((classroom) => !classroom.archived && (teacher ? admin || classroom.createdBy === user.uid : memberIds.has(classroom.id)));
  const classId = allowedClasses.some((classroom) => classroom.id === selectedClass) ? selectedClass : allowedClasses[0]?.id || null;
  const classroom = allowedClasses.find((item) => item.id === classId) || null;
  const semesterReady = !!(classroom?.dashboardSemesterStart && classroom?.dashboardSemesterEnd);
  const readingEnabled = classroom?.readingEnabled === true;
  const selectedActivity = activityChoice?.classId === classId ? activityChoice.id : "";
  const customReady = period !== "custom" || !!(start && end && start <= end && end <= today);
  const semesterMissing = period === "semester" && !semesterReady;
  const ready = classesLoaded && membershipsLoaded;
  const validPeriod = customReady && !semesterMissing;
  const periodOptions = { period, ...(period === "custom" ? { start, end } : {}) };
  const classContext = JSON.stringify([user.uid, user.role, today, readingEnabled, classroom?.dashboardSemesterStart, classroom?.dashboardSemesterEnd]);
  const classReport = useReportRequest(
    { classId, activityId: teacher && tab === "class" ? selectedActivity || undefined : undefined, ...periodOptions },
    ready && !!classId && validPeriod && (!teacher || tab !== "overall"), refresh, classContext
  );
  const classData = classReport.data;
  useEffect(() => {
    if (teacher && classData?.class?.id === classId) setDirectoryState({ classId, students: asArray(classData.roster) });
  }, [teacher, classId, classData]);
  const roster = classData ? asArray(classData.roster) : directoryState.classId === classId ? directoryState.students : [];
  const classStudents = roster.map((student) => ({ ...student, classes: [{ id: classId, name: classroom?.name || "" }] }));
  const preferredUid = studentChoice?.classId === classId ? studentChoice.uid : null;
  const selectedUid = classStudents.some((student) => student.uid === preferredUid) ? preferredUid : classStudents[0]?.uid || null;
  const overallContext = JSON.stringify([user.uid, user.role, today, allowedClasses.map((item) => [item.id, item.readingEnabled, item.dashboardSemesterStart, item.dashboardSemesterEnd])]);
  const detailReport = useReportRequest(
    { view: tab === "overall" ? "overall" : "personal", classId, ...(tab !== "overall" ? { studentUid: selectedUid } : {}), ...periodOptions },
    ready && teacher && validPeriod && (tab === "overall" || (tab === "personal" && !!selectedUid && !!classData)),
    refresh, tab === "overall" ? overallContext : classContext
  );
  const report = !teacher || tab === "class" ? classReport
    : tab === "overall" ? detailReport
      : classReport.loading || classReport.error ? { ...classReport, data: null } : detailReport;
  const data = report.data;
  const reading = data?.class?.readingEnabled === true ? data.reading : null;
  const activity = data?.activity;
  const reflections = data?.reflections;
  const readingSummary = reading?.summary;
  const activityOptions = asArray(classData?.activities);
  const directory = tab === "overall" ? asArray(detailReport.data?.students) : classStudents;
  const directoryLoading = tab === "overall" ? detailReport.loading : classReport.loading;
  const periodText = data?.period ? fullDate(data.period.start) + " — " + fullDate(data.period.end) : "";
  const selectedDay = !teacher && dayChoice?.key === report.key ? reading?.daily?.find((day) => day.date === dayChoice.date) : null;

  useEffect(() => {
    if (classId && classId !== selectedClass) setSelectedClassId(classId);
  }, [classId, selectedClass]);

  function selectClass(id) {
    setClass(id);
    setSelectedClassId(id);
    setDayChoice(null);
  }
  function selectStudent(student) {
    const entry = typeof student === "string" ? directory.find((item) => item.uid === student) : student;
    if (!entry?.uid) return;
    const targetClass = entry.classes?.find((item) => item.id === classId)?.id || entry.classes?.[0]?.id || classId;
    if (targetClass !== classId) selectClass(targetClass);
    setStudentChoice({ classId: targetClass, uid: entry.uid });
    setTab("personal");
  }
  function changeTab(next) { setTab(next); setDayChoice(null); }

  let content;
  if (!ready) content = <div className="bb-dash-loading" role="status"><span className="bb-dash-spinner" />반 정보를 불러오는 중입니다.</div>;
  else if (!classId && (!teacher || tab !== "overall")) content = <Section title={teacher ? "먼저 반을 만들어 주세요" : "아직 소속된 반이 없습니다"}><Empty>{teacher ? "반을 만들면 활동과 독서 기록을 이곳에서 살펴볼 수 있습니다." : "책방에서 선생님이 알려 준 참여 코드로 반에 들어가 주세요."}</Empty><Link className="bb-dash-primary" href={teacher ? "/books?open=classes" : "/books"}>{teacher ? "반 관리하기" : "책방에서 반 입장하기"}</Link></Section>;
  else if (!customReady) content = <div className="bb-dash-notice">조회할 시작일과 종료일을 확인해 주세요. 종료일은 오늘까지 선택할 수 있습니다.</div>;
  else if (semesterMissing) content = <div className="bb-dash-notice"><p>{teacher ? "기준 반의 학기 기간을 먼저 설정해 주세요." : "선생님이 학기 기간을 설정하면 이번 학기 기록을 볼 수 있습니다."}</p><button type="button" className="bb-dash-text-link" onClick={() => setPeriod("weekly")}>이번 주 기록 보기 →</button></div>;
  else if (report.error) content = <div className="bb-dash-error-panel" role="alert"><h2>기록을 불러오지 못했습니다</h2><p>{report.error}</p><div className="bb-dash-retry-actions"><button className="bb-dash-secondary" type="button" onClick={() => setRefresh((value) => value + 1)}>다시 시도</button>{selectedActivity && tab === "class" && <button className="bb-dash-secondary" type="button" onClick={() => setActivityChoice(null)}>최근 활동으로 돌아가기</button>}</div></div>;
  else if (report.loading) content = <div className="bb-dash-loading" role="status"><span className="bb-dash-spinner" />독서 기록을 모으고 있습니다.</div>;
  else if (teacher && tab === "personal" && !selectedUid) content = <Section title="개인별 분석 리포트"><Empty>이 반의 학생이 등록되면 왼쪽에서 선택할 수 있습니다.</Empty></Section>;
  else if (data) content = <>
    <div className="bb-dash-scope-line"><span>{data.period.label} · {periodText}</span>{reading?.previous && data.period.previous && <span>비교 {fullDate(data.period.previous.start)} — {fullDate(data.period.previous.end)}</span>}</div>
    {teacher ? tab === "personal" ? <TeacherPersonalReport data={data} onEditProfile={() => { const entry = directory.find((item) => item.uid === selectedUid); if (entry) setProfileStudent(entry); }} /> : tab === "overall" ? <OverallReport data={data} onSelectClass={(id) => { selectClass(id); setTab("class"); }} /> : <>
      <p className="bb-dash-roster-note">현재 반 명부를 기준으로 집계합니다. 학생을 고르면 개인별 분석으로 이동합니다.</p>
      {/* 학급별 분석에는 KWLS(생각의 기록)를 두지 않습니다 — 개인별 · 전체 분석에도 따로 없어
          이 탭에만 서 있었습니다(선생님 요청). KWLS는 개인별 분석의 활동 목록에 듭니다. */}
      <div className={"bb-dash-metrics" + (reading ? "" : " is-two")}><Metric label="활동 참여" value={activity?.started || 0} unit="명" hint={"대상 " + fmt(activity?.eligible) + "명 · 현재 진행"} />{reading && <Metric label="독서를 기록한 학생" value={readingSummary?.readers} unit="명" previous={reading.previous?.readers} hint={"읽은 쪽수 " + fmt(readingSummary?.pages) + "쪽"} />}<Metric label="활동 피드백" value={asArray(data.feedback).length} unit="건" hint="선택한 활동에서 나눈 기록" /></div>
      <Snapshot key={activity?.id || "empty"} activity={activity} onSelectStudent={selectStudent} showStudents={false} />
      {reading && <TeacherReading reading={reading} onSelectStudent={selectStudent} showStudents={false} />}
      <Feedback rows={asArray(data.feedback)} teacher />
    </> : <>
      {reading && <div className="bb-dash-metrics is-four"><Metric label="읽은 쪽수" value={readingSummary?.pages} unit="쪽" previous={reading.previous?.pages} /><Metric label="독서한 날짜" value={readingSummary?.days} unit="일" previous={reading.previous?.days} /><Metric label="완독 기록" value={readingSummary?.completed} unit="건" previous={reading.previous?.completed} /><Metric label="감상문" value={readingSummary?.reviews} unit="건" previous={reading.previous?.reviews} /></div>}
      <NextActions activities={asArray(data.studentActivities)} personal={reading?.personal} />
      {reading && <Calendar days={asArray(reading.daily)} onSelectDay={(day) => setDayChoice({ key: report.key, date: day.date })} />}
      {reading?.personal && <PersonalGrowth personal={reading.personal} />}
      <div className="bb-dash-two-columns bb-dash-align-start"><Reflections data={reflections} /><Feedback rows={asArray(data.feedback)} /></div>
      <StudentPortfolio activities={asArray(data.studentActivities)} />
    </>}
    {(!teacher || tab === "class") && !readingEnabled && <p className="bb-dash-feature-off">이 반은 책나눔을 사용하지 않아 책방의 독서 활동 기록을 보여줍니다.</p>}
    <footer className="bb-dash-footer"><span>독서 기록을 고치면 집계도 함께 달라집니다.</span>{data.generatedAt && <span>최근 조회 {new Date(data.generatedAt).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" })}</span>}</footer>
  </>;

  return <div className="bb-dashboard-shell">
    <TopNav key={user.uid} active="dashboard" growthEnabled={readingEnabled} />
    <main className="bb-dashboard-main">
      <header className="bb-dashboard-heading"><div><h1>{teacher ? "관리자 대시보드" : "나의 독서 기록"}</h1><p>{teacher ? "학생·학급·전체의 독서 활동을 함께 살펴봅니다." : user.realName + "의 독서 활동과 읽어 온 시간을 살펴봅니다."}</p></div><button type="button" className="bb-dash-secondary" onClick={() => setRefresh((value) => value + 1)} disabled={!ready || report.loading || (!teacher && !classId)}>새로고침</button></header>
      {notice && <p className="bb-dash-notice bb-dash-withdraw-notice" role="status">{notice}</p>}
      {!isFirebaseConfigured && <p className="bb-dash-demo">체험 데이터 · {teacher ? "왼쪽 학생 목록과 리포트 탭에서 분석 대상을 바꿀 수 있습니다." : "상단에서 학생을 고르면 각자의 독서 기록을 확인할 수 있습니다."}</p>}
      {ready && <div className="bb-dash-controls" aria-label="대시보드 조회 조건">
        {classId && (!teacher || tab !== "overall" || period === "semester") && <label>{teacher && tab === "overall" ? "학기 기준 반" : "반"}<select aria-label="대시보드 반 선택" value={classId} onChange={(event) => selectClass(event.target.value)}>{allowedClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        <label>기간<select aria-label="조회 기간" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="weekly">이번 주</option><option value="monthly">이번 달</option><option value="semester">이번 학기</option><option value="custom">직접 선택</option></select></label>
        {period === "custom" && <><label>시작일<input type="date" aria-label="조회 시작일" value={start} max={end || today} onChange={(event) => setStart(event.target.value)} /></label><label>종료일<input type="date" aria-label="조회 종료일" value={end} min={start || undefined} max={today} onChange={(event) => setEnd(event.target.value)} /></label></>}
        {teacher && tab === "class" && <label className="bb-dash-activity-control">살펴볼 활동<select aria-label="살펴볼 독서 활동" disabled={!activityOptions.length} value={selectedActivity || classData?.selectedActivityId || ""} onChange={(event) => setActivityChoice({ classId, id: event.target.value })}><option value="" disabled>{activityOptions.length ? "활동 선택" : classReport.loading ? "활동을 불러오는 중" : "등록된 활동 없음"}</option>{activityOptions.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.title}</option>)}</select></label>}
        {teacher && classId && (tab !== "overall" || period === "semester") && <button type="button" className="bb-dash-secondary bb-dash-semester-trigger" onClick={() => setSemesterChoice({ classId, uid: user.uid })}>학기 기간 설정</button>}
      </div>}
      {teacher ? <TeacherReportShell tab={tab} onTabChange={changeTab} students={directory} selectedUid={tab === "personal" ? selectedUid : null} onSelectStudent={selectStudent} loading={directoryLoading || !ready}>{content}</TeacherReportShell> : content}
    </main>
    {selectedDay && reading && <Dialog title={fullDate(selectedDay.date) + " 독서 기록"} onClose={() => setDayChoice(null)}><div className="bb-dash-day-total"><strong>{fmt(selectedDay.pages)}<small>쪽</small></strong><p>{selectedDay.pages > 0 ? "이 반에서 이날 읽었다고 기록한 쪽수입니다." : "이날 남긴 독서 기록이 없습니다."}</p></div><div className="bb-dash-day-records">{asArray(reading.dayRecords).filter((record) => record.date === selectedDay.date).map((record) => <article key={record.id}><h3>{record.title}</h3><span>{fmt(record.startPage)}–{fmt(record.endPage)}쪽 · {fmt(record.pages)}쪽 기록</span>{record.notes && <p>{record.notes}</p>}<Link className="bb-dash-text-link" href={libraryHref(record.bookId)}>이 책 기록 보기 →</Link></article>)}</div><Link className="bb-dash-primary" href={libraryHref()}>내 서재에서 기록 확인</Link></Dialog>}
    {teacher && profileStudent && <StudentProfileDialog
      key={profileStudent.uid}
      student={profileStudent}
      myClasses={myClasses}
      onClose={() => setProfileStudent(null)}
      onUpdated={() => setRefresh((value) => value + 1)}
      onWithdrawn={(name) => {
        setProfileStudent(null);
        setStudentChoice(null);
        setNotice(`${name || "학생"}을(를) 탈퇴시켰어요. 기록과 프로필이 지워졌습니다.`);
        setRefresh((value) => value + 1);
      }}
      onRemoved={(name, className) => {
        setProfileStudent(null);
        setStudentChoice(null);
        setNotice(`${name || "학생"}을(를) ${className || "이 반"}에서 뺐어요. 남긴 글 · 과일 · 출석 기록은 그대로입니다.`);
        setRefresh((value) => value + 1);
      }}
    />}
    {semesterChoice?.classId === classId && semesterChoice.uid === user.uid && teacher && <SemesterDialog classId={classId} className={classroom.name} start={classroom.dashboardSemesterStart} end={classroom.dashboardSemesterEnd} onClose={() => setSemesterChoice(null)} onSaved={() => { setSemesterChoice(null); setPeriod("semester"); setRefresh((value) => value + 1); }} />}
  </div>;
}
