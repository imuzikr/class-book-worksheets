"use client";

import {
  Section, Empty, Metric, WeeklyChart, Reflections, Feedback, StudentPortfolio,
  fmt, fullDate, asArray,
} from "./DashboardParts";
import "./TeacherReports.css";

function ReportHeading({ eyebrow, title, children, aside }) {
  return <header className="bb-report-heading">
    <div><span className="bb-report-eyebrow">{eyebrow}</span><h2>{title}</h2><p>{children}</p></div>
    {aside && <span className="bb-report-heading-tag">{aside}</span>}
  </header>;
}

function ReportBooks({ books, title, note }) {
  return <Section title={title} note={note} className="bb-report-books-section">
    {books.length ? <div className="bb-report-books"><ul>{books.map((book) => <li key={book.key}>
      <span className="bb-report-book-icon" aria-hidden="true">▤</span>
      <div><h3>{book.title || "제목 미설정"}</h3>{book.author && <p>{book.author}</p>}</div>
      <span className="bb-report-book-pages"><strong>{fmt(book.pages)}</strong>쪽</span>
    </li>)}</ul></div> : <Empty>이 기간에 독서 기록을 남긴 도서가 없습니다.</Empty>}
  </Section>;
}

function ReadingFlow({ reading, title, note, overall = false }) {
  const days = asArray(reading.daily);
  const daily = days.length > 0 && days.length <= 7;
  return <Section title={title} note={note}>
    <div className="bb-report-reading-facts">
      <span>읽은 도서 <strong>{fmt(reading.summary?.books)}종</strong></span>
      {overall && <span>독서를 기록한 학생 <strong>{fmt(reading.summary?.readers)}명</strong></span>}
      <span>완독 기록 <strong>{fmt(reading.summary?.completed)}건</strong></span>
      <span>감상문 <strong>{fmt(reading.summary?.reviews)}건</strong></span>
    </div>
    <WeeklyChart rows={daily ? days : asArray(reading.weekly)} daily={daily} />
    {overall && <p className="bb-dash-footnote">도서는 식별 정보로 합친 종류 수이며, 독서를 기록한 학생은 여러 반에 속해도 한 명으로 셉니다.</p>}
  </Section>;
}

export function TeacherPersonalReport({ data }) {
  if (!data) return null;
  const activities = asArray(data.studentActivities);
  const reading = data.reading;
  const summary = reading?.summary;
  const student = data.subject;
  const started = activities.filter((activity) => activity.state === "doing" || activity.state === "done").length;

  return <div className="bb-report-document bb-report-personal">
    <ReportHeading eyebrow="개인별 보고서" title={(student?.name || "학생") + "의 독서 기록"} aside={data.class?.name}>
      {student?.studentId && <span className="bb-report-student-number">{student.studentId}</span>}
      선택한 반에서의 독서 활동과 생각의 기록을 살펴봅니다.
    </ReportHeading>
    {reading ? <div className="bb-dash-metrics is-four">
      <Metric label="읽은 쪽수" value={summary?.pages} unit="쪽" previous={reading.previous?.pages} />
      <Metric label="독서한 날짜" value={summary?.days} unit="일" previous={reading.previous?.days} />
      <Metric label="완독 기록" value={summary?.completed} unit="건" previous={reading.previous?.completed} />
      <Metric label="감상문" value={summary?.reviews} unit="건" previous={reading.previous?.reviews} />
    </div> : <>
      <p className="bb-report-current-note">활동 수와 진행 상태는 조회 기간과 관계없이 현재 저장된 내용을 기준으로 합니다.</p>
      <div className="bb-dash-metrics is-four">
        <Metric label="전체 활동" value={activities.length} unit="개" hint="선택한 반의 모든 독서 활동" />
        <Metric label="참여한 활동" value={started} unit="개" hint="작성 중이거나 기준을 충족한 활동" />
        <Metric label="미시작 활동" value={activities.filter((activity) => activity.state === "empty").length} unit="개" hint="현재 저장 상태" />
        <Metric label="배정 대기 활동" value={activities.filter((activity) => activity.state === "waiting").length} unit="개" hint="모둠·담당 배정 대기" />
      </div>
    </>}
    <StudentPortfolio activities={activities} title="학생의 독서 활동 모음" />
    {reading && <div className="bb-report-reading-grid">
      <ReadingFlow reading={reading} title="학생의 독서 흐름" note="선택한 반과 기간에 속하는 독서 날짜를 기준으로 합산합니다." />
      <ReportBooks books={asArray(reading.books)} title="학생이 읽은 책" note="선택한 반과 기간에 독서 기록을 남긴 도서입니다." />
    </div>}
    <div className="bb-report-detail-grid">
      <Reflections data={data.reflections} teacher countUnit="건" />
      <Feedback rows={asArray(data.feedback)} teacher note="선택한 반의 여러 활동에서 학생이 받은 피드백을 모았습니다." />
    </div>
    {!reading && <p className="bb-dash-feature-off">이 반은 책나눔을 사용하지 않아 책방의 독서 활동 기록을 보여줍니다.</p>}
  </div>;
}

export function OverallReport({ data, onSelectClass }) {
  if (!data) return null;
  const summary = data.summary;
  const classes = asArray(data.classes);
  const reading = data.reading;
  const enabledClasses = summary?.reading?.enabledClasses || 0;

  return <div className="bb-report-document bb-report-overall">
    <ReportHeading eyebrow="전체 보고서" title="모든 반의 독서 현황" aside={"전체 " + fmt(summary?.classes) + "개 반"}>
      열람 가능한 보관되지 않은 모든 반을 합산합니다. 현재 반 명부를 기준으로 집계합니다.
    </ReportHeading>
    <div className="bb-dash-metrics is-four">
      <Metric label="전체 반" value={summary?.classes} unit="개" hint="열람 가능한 모든 운영 반" />
      <Metric label="전체 학생" value={summary?.students} unit="명" hint={"중복 제외 · 반별 소속 합계 " + fmt(summary?.memberships) + "명"} />
      <Metric label="전체 독서 활동" value={summary?.activityCount} unit="개" hint="모든 반에 등록된 활동 수" />
      <Metric label="읽은 쪽수" value={summary?.reading?.pages} unit="쪽" hint={"선택 기간 · 책나눔 사용 " + fmt(enabledClasses) + "개 반"} />
    </div>
    <Section title="반별 현황" note="각 학급의 최근 활동 기준 · 학생과 활동 수는 현재 반 전체를, 참여와 기준 충족 인원은 각 반의 최근 활동 하나를 보여줍니다.">
      {classes.length ? <>
        <div className="bb-dash-table-scroll bb-report-class-table-scroll" role="region" aria-label="반별 현황 표" tabIndex={0}>
          <table className="bb-dash-table bb-report-class-table">
            <caption className="sr-only">모든 반의 학생·활동 수와 각 학급의 최근 활동 기준 현재 진행 현황, 선택 기간 읽은 쪽수</caption>
            <thead><tr><th scope="col">반</th><th scope="col">학생</th><th scope="col">전체 활동</th><th scope="col">최근 활동</th><th scope="col">참여 / 대상</th><th scope="col">기준 충족</th><th scope="col">읽은 쪽수</th></tr></thead>
            <tbody>{classes.map((classroom) => {
              const activity = classroom.selectedActivity;
              return <tr key={classroom.classId}>
                <th scope="row"><button type="button" className="bb-report-class-button" onClick={() => onSelectClass?.(classroom.classId)}>{classroom.name}<span aria-hidden="true"> →</span></button></th>
                <td>{fmt(classroom.students)}명</td>
                <td>{fmt(classroom.activityCount)}개</td>
                <td>{activity ? <div className="bb-report-latest-activity"><span>{activity.label}</span><strong>{activity.title || "제목 미설정"}</strong>{activity.waiting > 0 && <small>배정 대기 {fmt(activity.waiting)}명</small>}</div> : <span className="bb-report-muted">등록된 활동 없음</span>}</td>
                <td>{activity ? fmt(activity.started) + " / " + fmt(activity.eligible) + "명" : "—"}</td>
                <td>{activity?.completionSupported ? fmt(activity.done) + "명" : <span title={activity ? "이 활동에는 개인 완료 기준이 없습니다." : "등록된 활동이 없습니다."}>—</span>}</td>
                <td>{classroom.readingEnabled ? fmt(classroom.reading?.pages) + "쪽" : <span className="bb-report-muted">미사용</span>}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <p className="bb-dash-footnote">활동 진행 상태는 조회 기간의 과거 진행률이 아닌 현재 저장 상태입니다. 배정 대기는 참여 대상에서 제외하며, 개인 완료 기준이 없는 활동의 기준 충족 인원은 —로 표시합니다.</p>
      </> : <Empty>열람할 수 있는 운영 반이 없습니다.</Empty>}
    </Section>
    {enabledClasses > 0 && reading ? <div className="bb-report-reading-grid">
      <ReadingFlow reading={reading} title="전체 독서 흐름" note={"책나눔을 사용하는 " + fmt(enabledClasses) + "개 반에서 선택 기간에 읽었다고 기록한 쪽수입니다."} overall />
      <ReportBooks books={asArray(reading.books)} title="모든 반이 읽은 책" note="선택 기간의 도서 종류를 합치고, 각 반에서 기록한 쪽수를 더했습니다." />
    </div> : <p className="bb-dash-feature-off">책나눔을 사용하는 반이 없어 독서 쪽수와 도서 기록은 표시할 내용이 없습니다.</p>}
    {data.period && <p className="bb-report-period-note">독서 기록 집계 기간 · {fullDate(data.period.start)} — {fullDate(data.period.end)}</p>}
  </div>;
}
