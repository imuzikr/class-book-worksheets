// =============================================================
// 엑셀(.xlsx) 내려받기 — 라이브러리 없이 OOXML 몇 장을 zip으로 묶어 만듭니다.
// -------------------------------------------------------------
// 지금 쓰는 곳은 출석부 내려받기(lib/exportAttendance.js) 하나입니다.
// =============================================================
import { zipBlob } from "./zip";

// ---- 다운로드 공통 ----
export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- Excel 워크북 (반별 시트) — 라이브러리 없이 .xlsx 생성 ----
// 예전에는 SpreadsheetML 2003(XML 한 장)을 `.xls` 이름으로 내려 주었는데,
// 엑셀이 열 때마다 **'파일 형식과 확장명이 일치하지 않습니다'** 경고를 띄웠습니다
// (속은 XML인데 이름은 옛 이진 형식이라서). 지금은 진짜 `.xlsx`를 만듭니다 —
// XML 몇 장을 `lib/zip.js`로 묶은 것이고, 라이브러리는 여전히 안 씁니다.
function xmlEscape(s = "") {
  return (
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      // XML 1.0이 허용하지 않는 제어문자(줄바꿈·탭 제외) — 들어 있으면 엑셀이
      // 파일을 통째로 '읽을 수 없다'고 합니다. 학생 글에 섞여 들어올 수 있어
      // 여기서 걷어 냅니다.
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
  );
}
// 엑셀 시트명 제약: 31자 이내, : \ / ? * [ ] 사용 불가
function sanitizeSheetName(name, index) {
  let n = String(name || `반${index + 1}`).replace(/[:\\/?*[\]]/g, " ").trim();
  if (!n) n = `반${index + 1}`;
  return n.slice(0, 31);
}

// 0 → A, 25 → Z, 26 → AA … (출석부는 날짜만큼 열이 늘어 26칸을 쉽게 넘습니다)
export function colName(index) {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

// 표 하나짜리 워크북 — sheets: [{ name, headers, rows }], rows는 **셀 배열의 배열**.
// 활동 자료는 열 이름이 고정이지만(HEADERS), 출석부처럼 열이 날짜 수에 따라
// 달라지는 표도 있어 열을 인자로 받는 이 형태를 밑바탕으로 둡니다.
//
// 셀은 전부 **inlineStr**(문자열을 시트 안에 그대로)입니다. 공유 문자열표
// (sharedStrings.xml)를 쓰면 파일이 조금 작아지지만 표 한 장에 그럴 값어치가
// 없고, 부품이 하나 늘면 어긋날 자리도 하나 늡니다.
export function buildXlsxParts(sheets) {
  const usedNames = new Set();
  const named = sheets.map((sheet, i) => {
    let name = sanitizeSheetName(sheet.name, i);
    while (usedNames.has(name)) name = (name.slice(0, 28) + "_" + i).slice(0, 31);
    usedNames.add(name);
    return { ...sheet, name };
  });

  const sheetXml = (sheet) => {
    const line = (cells, r) =>
      `<row r="${r}">${cells
        .map(
          (c, i) =>
            `<c r="${colName(i)}${r}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(
              c ?? ""
            )}</t></is></c>`
        )
        .join("")}</row>`;
    const all = [sheet.headers ?? [], ...(sheet.rows ?? [])];
    const rows = all.map((cells, i) => line(cells, i + 1)).join("");
    return (
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<sheetData>${rows}</sheetData></worksheet>`
    );
  };

  const parts = [
    {
      name: "[Content_Types].xml",
      text:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        named
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
          )
          .join("") +
        `</Types>`,
    },
    {
      name: "_rels/.rels",
      text:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      text:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
        `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
        named
          .map(
            (s, i) =>
              `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
          )
          .join("") +
        `</sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      text:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        named
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
          )
          .join("") +
        `</Relationships>`,
    },
  ];
  named.forEach((sheet, i) => {
    parts.push({ name: `xl/worksheets/sheet${i + 1}.xml`, text: sheetXml(sheet) });
  });
  return parts;
}

export function downloadWorkbook(sheets, filename) {
  const blob = zipBlob(buildXlsxParts(sheets), {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, filename);
}
