// =============================================================
// 관리자 지정 — 코드에 관리자 이메일을 박아 두지 않으므로, 배포한 사람이
// 이 스크립트로 첫 관리자를 한 번 정합니다.
// -------------------------------------------------------------
// [쓰는 법] (그 사람이 먼저 앱에 구글 계정으로 한 번 가입해 있어야 합니다)
//   npm run admin:grant -- someone@gmail.com            ← 무엇을 할지 보여 주기만
//   npm run admin:grant -- someone@gmail.com --apply    ← 실제로 관리자 지정
//   npm run admin:grant -- someone@gmail.com --revoke --apply  ← 관리자 해제(학생으로)
// --apply 없이는 아무것도 바꾸지 않습니다(다른 스크립트와 같은 약속).
//
// 하는 일: Firebase Auth 계정의 커스텀 클레임 role을 'admin'으로 두고,
// users/{uid}.role도 같이 맞춥니다(화면 표시용). 지정된 사람은 **다시
// 로그인해야** 새 권한이 토큰에 실립니다.
// 그 뒤의 선생님 승인은 앱 안의 역할 관리 창(관리자 전용)에서 합니다.
//
// [자격 증명] gcloud 로그인만 있으면 됩니다(`gcloud auth login`, 프로젝트
//   소유자·편집자 계정). 내부에서 `gcloud auth print-access-token`을 씁니다.
// =============================================================
import { execSync } from "node:child_process";

const PROJECT_ID = "YOUR_PROJECT_ID"; // .firebaserc와 같은 값
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const REVOKE = args.includes("--revoke");
const email = args.find((a) => !a.startsWith("--"));

if (!email || !email.includes("@")) {
  console.error("사용법: npm run admin:grant -- <이메일> [--revoke] [--apply]");
  process.exit(1);
}
if (PROJECT_ID.startsWith("YOUR_")) {
  console.error("functions/scripts/grant-admin.mjs의 PROJECT_ID를 먼저 채워 주세요.");
  process.exit(1);
}

const token = execSync("gcloud auth print-access-token").toString().trim();
async function api(url, body, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-goog-user-project": PROJECT_ID,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${json?.error?.message ?? res.statusText}`);
  return json;
}

const IDT = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}`;
const found = await api(`${IDT}/accounts:lookup`, { email: [email] });
const user = found.users?.[0];
if (!user) {
  console.error(`'${email}' 계정이 없습니다. 먼저 앱에 구글 계정으로 가입해 주세요.`);
  process.exit(1);
}
const claims = user.customAttributes ? JSON.parse(user.customAttributes) : {};
const role = REVOKE ? "student" : "admin";
console.log(`계정: ${email} (uid ${user.localId}) · 지금 역할: ${claims.role || "(없음)"} → ${role}`);
if (!APPLY) {
  console.log("미리보기만 했습니다. 실제로 바꾸려면 --apply를 붙여 다시 실행하세요.");
  process.exit(0);
}

await api(`${IDT}/accounts:update`, {
  localId: user.localId,
  customAttributes: JSON.stringify({ ...claims, role }),
});
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
await api(
  `${FS}/users/${user.localId}?updateMask.fieldPaths=role&updateMask.fieldPaths=requestedRole`,
  { fields: { role: { stringValue: role }, requestedRole: { nullValue: null } } },
  "PATCH"
);
console.log(`완료 — ${email}의 역할이 '${role}'입니다. 그 사람이 로그아웃했다가 다시 로그인하면 반영됩니다.`);
