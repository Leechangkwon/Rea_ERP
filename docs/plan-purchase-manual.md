# 구매실 매뉴얼 기반 재현

## 현재 인계: Windows 관찰 / Linux 분석·구현 (2026-10-19)

현재 사용자의 후속 요청은 거래유형·관리항목이다. [현재 조사·개발 계획](plan-purchasing-transaction-management-20261020.md)을 먼저 읽는다. 원본 세션 만료로 재로그인을 요청했으며 운영0.49.0은 유지한다. 아래 다중 선택 내용은 직전 완료 기준이다.

현재 후속은0.49.0 다중 선택·수정일자순이다. [이번 계획](plan-purchasing-multiselect-sort-20261020.md)과 [기능 기록](purchasing-multiselect-sort-0.49.0.md)을 먼저 읽는다. 아래0.48 및 이전 내용은 해당 시점 기록이다.

현재 후속 기준은 메일 연결 검증까지 마친0.47.2/e4690e5에서 사용자 요청으로 발주요청·발주계획·발주서·구매 원본 대조 개발을 재개한 상태다. 이번0.48.0의 네 조회 검색 적용/패널 접힘·성공/대기 조건 분리·목록 재조회 보존은 [현재 후속 계획](plan-purchasing-search-state-20261019.md)과 [기능 기록](purchasing-search-state-0.48.0.md)을 따른다. 아래0.43/0.42 연결 범위와 미커밋 목록은 당시 기록이며 현재 코드/운영 상태를 대신하지 않는다. 원본 업무 저장 없이 현재 조회 구조·공개 코드·합성 자료로 개발한다.

이 기존 계획을 인계 기준으로 이어간다. 현재 작업 경로와 관찰·배포 제한은 [AGENTS.md](../AGENTS.md), 현재 기능과 누계는 [current-release.json](../evidence/global-rea-20261018/current-release.json)을 우선한다. 아래 과거 계획의 Windows 경로·작업자 분담·비공개 배포 표현은 당시 기록이다. 현재 배포는 사용자가 재확인한 로컬·Supabase·Cloudflare 구성을 따른다. 기존 Sites 공개 설정과 URL은 과거 기록이며 현재 Cloudflare 경로로 간주하지 않는다. ERP 자체 인증과 자료는 보존한다.

연결 보완의 현재 상태는 [로컬·Supabase·Cloudflare 계획](plan-local-supabase-cloudflare-20261019.md)을 따른다. 이 작업에서 외부 배포나 업무자료 자동 이관은 하지 않는다.

### 저장소와 점검 결과

- 앱 `0.42.0`, 브랜치 `main`, HEAD `008c735313aeeddad3815ab16c7b7a71a652982e`. 로컬에 기록된 `origin/main`과 같은 위치이며 이번에 원격 fetch나 배포는 하지 않았다.
- 점검 시작 시 수정 7개: `AGENTS.md`, `README.md`, `package.json`, `package-lock.json`, `scripts/rea_evidence.mjs`, `scripts/rea_rebuild.py`, `scripts/request-preview.cjs`.
- 미추적 11개: `.node-version`, `.python-version`, `playwright.config.cjs`, `evidence/development-environment-20261019.json`, `scripts/{browser-runtime,check-environment,install-browser,rea-sources}.cjs`, `scripts/rea-analyze.mjs`, `tests/browser/request.spec.cjs`, `tests/dev-tools.cjs`. 기존 Linux 환경 개선분으로 보존한다. 이번 문서 수정은 이 목록에 추가된다.
- 이번 재점검: `npm run env:check` 통과(Node 24.22.0, npm 11.19.1, Python 3.14.4, procps 및 고정 의존성). `rea:analyze -- menu`는 검증된 캐시 재사용·1파일·부분 분석 없음, `-- request`는 검증된 캐시 재사용·10파일·부분 의미 분석 있음. 요청 분석의 부분 상태를 완료로 올리지 않는다.
- `npm run rea:sources`: 과거 11개 파일 목록의 원문은 모두 없음. 과거 `original/baseline/rebuilt` 분석 원문도 없음. 현재 릴리스의 86본문은 기록된 누계이며, 이 검사는 86개 전체의 로컬 보유 여부를 판정하지 않는다.
- Linux에서 웹 도구로 공식 REA 저장소를 열었고, 인증 없는 `https://registry.npmjs.org/rea-agents/6.4.0` HTTP GET은 200이었다. 내장 브라우저 도구 부재와 공개 웹/HTTP 접근은 별개다. 초기 점검 이후 사용자가 연결 구현을 선택하여 아래 공개 로그인 JS 한 개의 수집·정적 분석을 실행했다. 사설 API는 호출하지 않았다.
- 직전 전체 테스트·브라우저 4개 등의 결과는 [환경 점검 기록](../evidence/development-environment-20261019.json)의 과거 실행 근거다. 이번 연결 구현에서는 도구 검사 7개(기존 2개+새 경계 검사 5개)를 실행했으며, 전체 앱 검사를 다시 실행한 것은 아니다.

### REA와 입력 범위

- 정확한 오픈소스: [morluto/rea](https://github.com/morluto/rea), npm `rea-agents@6.4.0`, MIT. 설치된 `node_modules/rea-agents/package.json`, lock 및 npm 레지스트리 응답이 일치한다. 버전은 교체하지 않는다.
- CLI: `/home/lck/projects/Rea_ERP/node_modules/rea-agents/scripts/rea.mjs`. `node …/rea.mjs analyze-javascript-application --help` 실행 성공. MCP 등록 없이 설치된 CLI를 사용할 수 있다.
- 해당 정적 분석 명령의 입력은 로컬 추출 디렉터리 또는 ASAR이다. 공개 JavaScript 번들, 관련 HTML·로컬 source map 등의 파일을 근거로 분석하며 로그인 URL이나 스크린샷 자체가 이 명령의 소스 입력을 대신하지 않는다. ERP에는 기능별 공개 JS가 담긴 디렉터리가 적합하다. 소스는 실행하지 않는다.
- 프로젝트의 `npm run rea:analyze -- menu|request|reports|api|all`은 **자체 `dist/`·`worker/`의 JS/CJS만** 허용한다. 원본 번들을 이 래퍼에 넣기 위해 제한을 풀거나 배포 폴더에 복사하지 않는다. 필요한 원본은 출처와 SHA-256을 확인하여 `.artifacts/`에 분리한 뒤 고정 CLI의 정적 분석 입력으로 사용한다. 현재 점검은 원본 수집을 자동 시작하지 않는다.
- 캐시·로그·원문·분석 결과는 `.artifacts/`에 두고 배포하지 않는다. 입력/설정 해시, 파싱 오류, 의미 분석의 완료·부분·시간/메모리 제한을 각각 기록한다.

### 남은 목표와 합격 조건

2026-10-19 확대 요청: 사용자가 발주요청·발주서·구매 관련 기능 전체의 기존 구현 재검토·원본 비교·차이 개발을 명시했다. 현재 기준은 [전체 재검토와 후속 수정](plan-purchasing-review-20261019.md), [기존 구현 감사](plan-purchasing-existing-audit-20261019.md), [검증 근거](../evidence/purchasing-review-20261019.json)다. 원본 조회/입력/현황의 값 없는 DOM을 대조하고, 실제로 재현한 불러오기·검색·양식 선택 문제를 수정했다. 아래 최초 브라우저 연결/F3 단계의 범위는 이전 기록이며 3종의 원본 서버 동등성 완료를 뜻하지 않는다.

2026-10-19 후속: 사용자 수동 로그인 후 WSL Ego에서도 ERP와 발주요청조회 진입을 직접 확인했다. 검색 항목 19개는 값 없이 구조만 기록했고 F3 펼치기/접기를 관찰한 뒤 자체 누락을 보완했다. 현재 후속 실행·검사·한계는 [발주요청 검색 단축키 계획](plan-request-search-shortcut.md) 및 [연결 근거](../evidence/browser-rea-linux-20261019.json)를 따른다. 아래 최초 연결의 로그인 미검증 표현은 후속 관찰 이전 기록이며 원본 업무 저장과 운영 사이트 검증은 여전히 미검증이다.

현재 ERP 개발 우선순위는 발주요청 → 발주계획 → 발주서 → 구매다. 사용자가 이번에 선택한 완료 범위는 **브라우저 확인 → REA 분석 → Linux 개발 연결**이며 ERP 기능 재현은 후속 범위다. 기준은 [발주요청 대조](request-list.md), 현재 릴리스 계약과 [구매 목록 0.42.0](purchase-list-columns-0.42.0.md)이며, 과거 문서의 남은 항목을 최신 계약 확인 없이 미구현으로 단정하지 않는다.

- 발주요청의 검색 피커·Option 분기·입력 보조, 확인 여부/진행 상태와 이전 자료 변환, 삭제/복구·업로드·권한·금액/VAT·서버 검증 등 아직 확정되지 않은 계약을 좁혀 확인한다.
- 이력은 0.40 이후 구현/관찰이 있다. 요청의 `IHistoryListPage`와 발주서·구매의 `ES303M`을 구분하며, [후속 이력 근거](../evidence/global-rea-20261018/document-history/request-history-distinction-supplement.json)에 남은 현재 쿼리/필드 연결·정렬/출력 규칙 등을 확인한다. 이력 전체를 새 미구현 항목으로 취급하지 않는다.
- 최신 목록의 상태·인쇄·작성자/시간대·불러온 전표 관계, 집계 축/정렬/그래프/비교, 결재·서버 출력 및 호스팅 로그인 후 업무 검증의 미확인 부분을 유지한다. 외부 Email/메시지/전자결재 연동은 별도 범위다.
- 합격: 기능별 사용 예와 버튼·하위 메뉴·팝업·입력 조건·검증·권한·결과·취소·오류·보관 범위에 대한 관찰 근거, 공개 코드 근거, 자체 구현, 합성 검사, 미확인 서버 동작을 구분한다. 관련 Node/jsdom·도구 검사·localhost Playwright 흐름으로 수정과 보존을 검증한다. 저장 구조 변경 시 이전 백업 변환·복원도 검증한다. 메뉴/파싱/테스트 통과만으로 원본 동등성 완료를 선언하지 않는다.
- 배포가 포함되는 다음 작업은 [릴리스 절차](release-workflow.md)의 현재 로컬·Supabase·Cloudflare 기준을 따른다. 대상 확인·연결 호환 검증·버전·전체 검사·커밋·실제 접속 검증을 기록한다. Sites 배포는 실행하지 않는다.

### 관찰과 구현 분담

| 담당 | 이번 협업의 역할 | 근거의 한계 |
| --- | --- | --- |
| Windows 기존 채팅 | 내장 브라우저에서 현재 화면과 조회 전용 DOM 관찰, 허용된 공개 코드 출처와 요구사항 전달 | 이번 전달은 로그인 제목·컨트롤 7개·공개 script src 1개이며, 입력값이나 로그인 후 업무 화면은 읽지 않음 |
| Linux 기존 채팅 | `/home/lck/projects/Rea_ERP`에서 REA 정적 분석, 기존 계약 대조, 코드 구현, 합성자료 검사, 결과 문서화 | 정적 action/API 이름은 실행 권한·저장 결과·현재 화면 연결을 입증하지 않음 |

원본의 주 입력행 값 입력 및 행 번호·선택·순서·이동 컨트롤은 빈 임시초안도 자동 저장한 이력이 있어 조작하지 않는다. 원본 저장·삭제·취소·발송·설정 저장은 임의 실행하지 않는다. 조회 전용 화면·정적 DOM·공개 코드에서 확인할 수 없는 부분은 미확인으로 남긴다. Windows와 Linux가 같은 구현 파일을 동시에 수정하지 않는다.

Windows가 전달할 최소 자료는 다음과 같다.

1. 먼저 완료할 화면/기능 하나, 사용 예와 합격 조건.
2. 관찰 시각, 화면 제목·메뉴/프로그램 식별자, 버튼명·위치·활성 상태·하위 항목·팝업 라벨. 세션 URL 대신 식별자만 사용한다.
3. 안전하게 실제 관찰한 순서/결과와 미확인 사항. 필요한 경우 회사 값이 없는 영역의 이미지 또는 업무 값을 제거한 DOM 구조만 전달한다. 실제 값을 수집한 뒤 옮기는 방식은 사용하지 않는다.
4. 추가 정적 분석이 필요하면 인증 없이 접근 가능한 정적 자원 URL 또는 이미 확보한 공개 코드 파일 경로와 SHA-256. 쿠키·인증 헤더·로그인 정보·프로필·HAR·회사 업무자료는 전달하지 않는다. 원문은 `.artifacts/`에 분리한다.

Linux는 같은 계획에 관찰/소스 대응, 변경 파일, 검사 결과, 미확인 사항을 이어 기록하고 기존 Windows 채팅의 결과 수신으로 인계한다. 추가 채팅이나 보조 에이전트는 만들지 않는다.

### 연결 구현과 실제 실행 근거

명령: `npm run rea:handoff -- /mnt/c/Users/PL-PD-CHANGGWON-LEE/Desktop/rea_erp/browser-handoff/ecount-login-20261019.json`.

- 수신·검증·공개 GET·REA·계획 연결: [scripts/browser-handoff.mjs](../scripts/browser-handoff.mjs). 명령 등록과 도구 검사 연결: `package.json`. 형식·사용법: [README](../README.md#windows-브라우저--linux-rea-연결).
- 프로토콜 v1은 이 로그인 관찰의 지정된 필드·라벨·서술과 공개 로그인 JS 경로만 받는다. 비밀번호 입력란의 type/id는 허용하고 입력값·비밀 필드·쿠키·헤더·업무자료·임의 서술·다른 화면은 검증에서 거부한다. 새로운 업무 화면은 별도 관찰 계약을 먼저 정한다.
- Windows 관찰 시각 `2026-10-19T02:12:22+09:00`, 입력 SHA-256 `f933aa85d09c2abf4b8c9d924bfedbf6b9ddf8a674be74c1cf7aeb1c3961e39e`. Linux가 브라우저를 직접 관찰한 것으로 기록하지 않는다.
- 직접 공개 GET 200, JavaScript 61,698B, SHA-256 `fd048c85645cb2684a16e4e520abf3bf9e51f3731f662f489882389c38152167`. 과거 로그인 원문 해시와 일치하며 새 고유 원본 1개가 추가됐다고 누계를 올리지 않는다. 로그인 HTML/리다이렉트는 성공으로 처리하지 않는다.
- 최종 REA CLI 종료 0, 근거 스키마 검증 통과, 파싱 1파일/오류 0, AST 10,545노드·의미 노드 6,043개. 자원 제한에 따른 부분 분석은 보고되지 않았지만 동적 연결·서버 동작 한계는 유지한다. 원문 실행 없음.
- 최종 [요약](../.artifacts/browser-handoff/ecount-login-20261019-oec7b6/summary.json), [개발 검토 연결](../.artifacts/browser-handoff/ecount-login-20261019-oec7b6/development-plan.json), 원문·출처 manifest·REA JSON·stderr는 같은 실행 폴더에 있다. REA 결과 SHA-256은 `02f614dc761b0a1f3112bbcd4401cf1c9bbea35ec5daab0f3b29a6cc9e017e7d`다.
- 개발 검토 연결은 관찰 ID와 같은 REA 의미 노드 후보를 기록하고, 자체 회사코드·ID·비밀번호·로그인 버튼의 검토 지점을 `dist/auth-ui.js:18` 및 파일 해시와 연결한다. 두 체크박스의 자체 대응은 미확인이다. 원본 `passwd`/`save`의 동일 이름 의미 노드는 없으므로 현재 action 연결이나 기능 부재를 추정하지 않는다.
- 검증: `npm run test:tools` 7개 통과. 새 5개는 메타데이터와 민감값 구분, 스키마/페이지 오류, 없는 경로·심볼릭 링크·깨진 JSON·크기 제한, 비공개/비정적 URL, 리다이렉트/HTML/과대 응답 거부를 검사한다. `node --check scripts/browser-handoff.mjs`, `git diff --check` 통과. 실제 실행 결과·입력 코드·원시 REA JSON의 해시와 기존 코드 검토 지점 4개도 확인했다.
- Windows 채팅에서도 `Analyze-Saved-Browser-Handoff.cmd`로 WSL 명령을 독립 실행하여 종료 0을 확인했다. [독립 실행 요약](../.artifacts/browser-handoff/ecount-login-20261019-FHyYR5/summary.json)의 입력·원문 SHA-256, 파싱 1/오류 0, 의미 노드 6,043개를 Linux에서도 대조했다. Windows의 `browser-handoff/linux-summary.json`, `linux-development-plan.json`은 결과 복사본이다. 이 실행기는 저장된 관찰을 재분석하며 브라우저 화면을 새로 수집하지 않는다.
- 구현 연결은 완료했다. 로그인 성공, 인증 후 ERP 화면, 저장/권한/서버 결과 및 원본 동등성은 미검증이다. 앱 버전·기능 코드·의존성·배포·운영 서비스·Supabase는 이 연결 작업에서 변경하지 않았다. 기존 환경 개선 미커밋 변경은 보존했다.

## 과거 구매실 매뉴얼 계획

기준 소스 0.6.5 / 8d4f889ff52c8c0530cddc81c63ce2f0ec9625fc. 사용자 지정 2024-06-12 매뉴얼은 실제 76슬라이드이며 목차 page와 실제 슬라이드가 어긋난다. 원문·이미지는 .artifacts/purchase-manual-20240612에만 보관하고 배포/소스 커밋에 포함하지 않는다. 업무 규칙과 실제 슬라이드 번호만 근거로 남긴다.

## 로드맵

요구 검토(8–9) → 발주요청 불러오기·계획(10–12) → 품목 구매처/납기일별 발주서(13–14) → 발주 메일 초안(15–16) → 오염/파손·품목·수량 검수(19) → 발주서 잔량 구매입고(20–24) → RACK(25) → 인가량 대비 층별 부족량/창고이동(26–32) → 이동 전표에서 판매(33–37) → 진료실 요청에서 이동/판매(38–42) → 수정/집계(43–45) → 공급사 명세·원장·전산 대사/구매확정/세금계산서 확인(46–52) → 품의·증감/품목 분석(53–60) → 실사식/계속기록 수불·보고(61–64) → 일/주/월 체크(65–70) → 자산대장/표식/현황(71–76).

## 소유 범위

- operations worker: dist/inventory-core.js, dist/entry-core.js, tests/purchase-operations.cjs. 요청→이동, 이동→판매(입고창고를 판매창고로), 부분 반품/교환 입고, 원본/잔량/재고/채무/기간 잠금의 일관성. 다른 파일은 수정하지 않고 필요한 통합을 루트에 보고한다.
- purchasing worker: dist/purchase-room-core.js, tests/purchase-room-core.cjs. 독립 순수 업무 상태/검수/RACK/발주메일/대사/확정/세금계산서/월보고/수불/자산/일정 체크. UI는 루트가 작성한다.
- root: UI, 원본 화면 직접 관찰과 REA, 통합·API 매뉴얼·시뮬레이션·Page·검증·같은 비공개 사이트 배포.
- manual analyst: .artifacts/purchase-manual-20240612/requirements.json만 작성.

## 구매실 모듈 계약

PurchaseRoomCore는 Node require 및 browser global을 제공한다. InventoryCore를 최상위 require하지 않고 필요한 함수에 C를 인자로 받는다. exports: empty(), validateStore(store,db,C), command(db,payload,C)->{store,result}, periodSummary(db,filters,C), reconcile(db,filters,rows,C), assetReport(store,filters), cadence 등. 세부 export는 작업자가 보고한다.

저장 위치 db.settings.purchaseRoom (없으면 empty와 동등, version 1). command payload는 {action, ...fields}. 인벤토리 코어는 `purchaseRoom` 명령에서 반환 store를 같은 DB 복사본에 보관한다. 설정 검증은 모듈이 있을 때 validateStore를 호출하며, 없는 이전 fixture에서도 빈 설정 백업은 호환한다. 마감은 closings [{id,month:'YYYY-MM',warehouse,status:'closed'|'open',...}]로 나타낸다. 차이가 남은 대사는 확정 불가. 세금계산서는 외부 발행 대신 요청/수령/확인 기록. 외부 메일·회계·전자결재는 실제 송신과 구분해 초안/내보내기를 완성한다.

## 검증

합성 전표/거래처/창고로 단계별 핵심/DOM 검사를 수행한다. 실제 구매·메일 발송·세금계산서 발급은 하지 않는다. 입력→연결→부분입고→반품/교환→이동→판매의 재고·잔량·채무, 월말 금액 대사(불일치/수정/일치), 두 수불 방식, 자산 이력, 백업 왕복을 검증한다. 원본 공개 코드 분석은 관찰·추론·미확인을 구분한다. 마지막으로 버전 올림, npm test, check-release, build, 소스 helper 패키지/배포, 관리 Page 및 로드맵 Page 갱신을 수행한다.
