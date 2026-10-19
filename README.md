# 자동화 ERP · REA 재구성 검증

## 현재 기능 · 운영 버전 0.46.2 (2026-10-19)

REA 자체 메일함·검색·회신·구성원 권한·비공개 첨부·발주서 PDF 연결·초안 저장/휴지통 복원을 구현했다. 관련 Node 51개(웹메일18개), 합성 브라우저19개, 릴리스4개와 최종 verify:local 전체를 통과했다. 소스 2148428 업로드 후 기존 수동 WSL 서버를 재시작했다.

사용자의 요금/약관/자동청구·Wrangler 연결 승인을 받아 Cloudflare Workers Paid(월 US$5 기본+초과 사용량)를 활성화했다. qaredi.com 발신 도메인·메일 DNS, 전용 수신 Worker와 키, purchase@qaredi.com 수신 규칙을 적용하고 실제 도메인 SMTP 인증과 비공개 설정 저장을 완료했다. 기존 웹사이트 CNAME5개/확인TXT2개와 Gmail·Supabase 등 모든 기존 설정값은 유지했다. 메일 DNS는 추가만 했으며 전체18개(CNAME5/MX6/TXT7)다. 도메인 입력 실수는 --domain 고정 설정과 토큰 전 사전 검증으로 보완했다.

실제 외부 시험 메일은 아직 보내지 않았다. 최종 두 방향 테스트 각1통의 명시적 승인과 운영 계정 재로그인을 요청했다. 이전0.46.1까지 운영 메일함/발주서 연결·합성 초안 저장/최종 확인/휴지통은 확인했고, 0.46.2 새로고침에서는 로그인 화면으로 돌아왔다. 현재 인증 UI와 외부 최종 수신 확인을 완료로 기록하지 않는다. 상세: docs/domain-webmail-0.46.0.md, evidence/domain-webmail-20261019.json.

## 이전 기능 · 운영 버전 0.45.0 (2026-10-19)

발주서 조회 Email에 Gmail 작성·최종 확인·기본 발주서 PDF 첨부·전송 결과 이력을 추가했다. 같은 거래처 발주서만 한 메일에 포함하고 현재 전표 변경·권한 변경·중복 요청을 차단한다. 비밀번호는 서버 외부 설정에만 보관한다. 전체 verify:local, 합성 브라우저 12개와 메일 Node 검사 14개가 통과했다. 짧은 PDF 1쪽과 긴 PDF 7쪽의 한글/마지막 품목·렌더를 확인했다.

소스 a2b8256을 원격에 올린 뒤 기존 WSL 서버를 재시작했다. https://rea.qaredi.com 의 공개 로그인 v0.45.0과 미인증 메일 API 401을 확인했다. 기존 계정·회사·설정·권한과 Supabase 두 상태의 내용·수정 번호는 전후 동일하다. 메일 레코드는 생성하지 않았다.

**Gmail 서버 인증과 운영 화면 연결을 완료했다.** 숨김 TTY 입력 후 SMTP 인증을 검증해 비공개 runtime.env(600, 부모 700)에 저장했고 npm run gmail:check도 configured/authenticated=true, sendsEmail=false로 통과했다. 기존 비메일 설정은 동일하며 서버 재시작 없이 운영 Email 창의 발신 계정·첨부 목록·최종 확인과 확인 전 발송 차단을 확인했다. 기존 계정/비밀번호 해시·회사·설정·권한은 보존했고 재로그인의 lastLoginAt·세션·시도·인증 로그만 갱신됐다. 새 메일 기록은 0개이고 실제 메일은 발송하지 않았다. 상세: docs/gmail-purchaseorder-0.45.0.md 및 evidence/gmail-purchaseorder-20261019.json.


## 이전 기능 · 운영 버전 0.44.1 (2026-10-19)

발주계획의 일반 전표 불러오기·발주요청 전용 불러오기를 전표별 기본으로 수정했다. 원본 전표 한 건은 한 줄이며 선택하면 해당 전표의 불러올 품목행들을 기존 수량·단가·출처·잔량 검증으로 적용한다. 라인별/품목별 선택도 유지한다. 사용자 확인을 표시 단위 요구사항으로 삼았으며 원본 비공개 서버 동등성을 선언하지 않는다.

전체 verify:local(합성 브라우저 9개 포함)이 통과했고 소스 `6c62f21`을 원격에 올린 뒤 기존 WSL 서버를 재시작했다. https://rea.qaredi.com 에서 품목행 5개인 요청서가 1건/1줄로 표시되는 것, 두 불러오기 경로의 전표별 기본과 기존 인증 유지를 확인했다. 운영 적용·저장은 하지 않았다. 기존 작성 화면을 재로드하지 않고 별도 확인 탭을 사용했다. Supabase 두 상태의 내용·수정 번호는 전후 동일했다. 상세: `docs/plan-plan-request-import-20261019.md`, `evidence/plan-request-import-20261019.json`.


## 이전 기능 · 운영 버전 0.44.0 (2026-10-19)

발주요청·발주계획·발주서·구매 조회를 원본 화면과 재대조해 검색 차이를 보완했다. 요청/발주서/구매에 내·외자, 요청에 전용 번호, 계획에 기간·창고·프로젝트·거래처·품목과 F3/F8을 추가했다. 기존 양식·선택·수정 초안은 유지한다. 전체 verify:local과 합성 브라우저 8개가 통과했고, 운영에서 발견한 정적 파일 캐시를 버전 주소로 보완한 후 런타임·인증·매뉴얼 56개를 추가 통과했다.

배포 소스는 `9e0566e`(기능 `1d445dc`), 주소는 https://rea.qaredi.com 이다. 기존 로그인 유지와 운영 네 조회의 검색 표시, 계획 F3/F8을 확인했다. Supabase 두 상태의 내용·수정 번호는 재시작 전후 동일하다. 기존 SQLite·계정·설정·업무 자료와 로컬 WSL·Supabase·Cloudflare 수동 운영을 보존한다. 실제 업무 전표 저장/발송으로 검증한 것은 아니다. 계획 건별/전표별 묶음과 수량 0 기준, 원본 서버·발송·인쇄의 동등성은 남아 있다. 상세: `docs/plan-purchasing-search-20261019.md`, `evidence/purchasing-search-round2-20261019.json`.


작업 경로: `/home/lck/projects/Rea_ERP` (WSL2 Linux). 버전은 `package.json`, 최신 기능 누계는 `evidence/global-rea-20261018/current-release.json`을 기준으로 합니다. 현재 배포 기준은 사용자 지정 로컬·Supabase·Cloudflare 구성입니다. 과거 Sites 배포 기록은 현재 실행 절차가 아닙니다. ERP 자체 로그인·권한과 기존 자료를 유지합니다. 첫 접속에서 사용자가 회사코드·앱 ID·비밀번호를 정해 관리자를 등록합니다. 기본 계정이나 비밀번호는 배포하지 않습니다.

## 현재 배포 기준 — 사용자 재확인 (2026-10-19)

사용자가 현재 구성을 **로컬·Supabase·Cloudflare**로 재확인했다. 이 지시가 아래 과거 Sites/D1 배포 기록보다 우선한다. 로컬 개발·검증은 `/home/lck/projects/Rea_ERP`에서 계속하며, Supabase 연결과 Cloudflare 공개 경로는 기존 설정을 확인한 뒤 이 기준으로 준비한다. Sites 업로드·새 버전 저장·배포를 실행하지 않는다.

기존 D1 호환 API를 보존하는 Supabase 어댑터와 독립 로컬 실행기를 추가했다. `npm run dev:api`와 `npm run serve:local`은 같은 실행기를 사용하며 기본은 기존 로컬 SQLite다. 기존 `rea` Supabase 프로젝트의 REA 전용 테이블·RLS·서버 권한은 읽기 전용으로 확인했다. 사용자의 재지시에 따라 REA 전용 서버 키 `rea_erp_server`를 생성해 사용자 전용 설정(600)에 저장하고 기존 default 서버 비밀키를 폐기했다. 폐기 후에도 새 키로 두 테이블의 실제 읽기 전용 연결 검사가 통과했으며 공개용 default 키는 유지했다. 사용자가 Cloudflare 도메인 `rea.qaredi.com` 유지를 확정했고 전용 `rea-erp-local` Tunnel과 수동 실행·사전 검사 구성을 준비했다. 사용자가 기존 계정·자료를 보존하는 운영 전환을 명시적으로 요청해 원본 SQLite와 설정을 백업하고 비밀번호 해시·회사·설정·수정 번호를 검증하여 Supabase로 이관했다. 0.43.0 커밋 `d0a26ff`를 원격에 올린 뒤 로컬 서버를 Supabase로 재시작하고 `rea.qaredi.com`을 전용 Tunnel에 연결했다. 외부 HTTPS의 0.43.0 로그인 화면과 로그인 전 업무 접근 차단을 확인했으며 기존 계정의 실제 로그인·메인 화면 진입·새로고침 후 인증 유지, Supabase의 로그인 성공 기록·유효 세션 저장과 계정·회사 설정 보존까지 확인했다. 운영 근거는 `evidence/deployment-local-supabase-cloudflare-20261019.json`이다. `.openai/hosting.json`과 `rea.qaredi.com`의 과거 기록만으로 현재 대상을 확정하지 않는다. 상세 상태와 검증은 `docs/plan-local-supabase-cloudflare-20261019.md`를 따른다. 기존 앱 로그인·업무자료·운영 설정과 브라우저/서버 자료 분리를 보존하며 자동 이관하지 않는다.

## Linux 개발 시작

Node 24.22.0, npm 11.19.1, Python 3.14.4와 procps의 `ps`를 기준으로 검사했습니다. Node/Python 기준 버전은 `.node-version`, `.python-version`에 기록합니다. REA 6.4.0, Playwright 1.64.1은 개발 의존성으로 고정합니다.

```bash
npm ci
npm run browser:install
npm run env:check
npm start
```

`browser:install`은 Chromium 설치 후 실행까지 확인합니다. Ubuntu x64에서 NSPR/NSS/ALSA 라이브러리가 없으면 sudo 없이 apt 패키지를 `.artifacts/browser-libs/`에 다운로드·추출하고 브라우저 프로세스에만 적용합니다. 다운로드한 버전 목록도 해당 경로에 기록합니다. 다른 운영체제 의존성은 오류로 명시하며 자동으로 시스템 패키지를 변경하지 않습니다. `env:check`의 브라우저 설치 확인과 실제 브라우저 실행 검사는 별개입니다.

| 명령 | 용도 |
|---|---|
| `npm run dev` | 루프백에만 바인딩한 합성 발주요청 화면, 기본 포트 4173 |
| `npm run dev:api` / `npm run serve:local` | 독립 실행. 기본 SQLite, 비밀 설정으로 Supabase 명시 선택. 수동 시작 |
| `npm run configure:supabase` | 숨김 입력으로 서버 키 설정, 테이블 읽기 전용 확인 후 프로젝트 밖에 저장 |
| `npm run connection:check` | 실제 설정의 읽기 전용 연결 검사. 계정/업무 행을 만들지 않음 |
| `npm run test:runtime` | Supabase 어댑터·자체 인증·독립 HTTP·저장 보존 합성 회귀 검사 |
| `npm run test:tools` | 분석 캐시·인계 스키마·경로·민감값·정적 자원 응답 경계 검사 |
| `npm run test:browser` | 별도 포트 4179에서 고립된 Chromium 합성 흐름 검사 |
| `npm run verify:local` | 환경·도구·기존 전체 테스트·릴리스 검사·빌드·브라우저 검사 |
| `npm run rea:analyze -- menu` | 작은 메뉴 분석. `request`, `reports`, `api`, `all`도 지원 |
| `npm run rea:sources` | 과거 공개 원본 11개 목록의 보유·해시와 원시 분석 존재 여부 확인 |
| `npm run rea:handoff -- <JSON 파일>` | Windows 로그인 관찰 수신 → 공개 JS 1개 정적 분석 → Linux 개발 검토 지점 연결 |
| `npm run menu:prepare` | 명시적으로 메뉴와 관찰 근거 재생성 |

REA 캐시는 `.artifacts/rea-cache/`에 저장하며 파일 목록·내용 SHA-256·REA 버전·분석 옵션이 모두 같고 결과 해시와 REA 근거 검증을 통과할 때만 재사용합니다. 기능 그룹은 작업용 입력 묶음이며 전체 의존 관계나 원본 동등성의 증명이 아닙니다. 생략·시간 초과 등 한계는 요약에 남기며 작은 범위로 다시 분석합니다. 원본 보유 점검의 11개는 과거 capture 목록이며 현재 누계의 86개 전체를 검증했다는 뜻이 아닙니다. 누락 자료는 자동 수집하지 않습니다.

기존 추적 재실행은 `python3 -X utf8 scripts/rea_rebuild.py rebuilt`, `node scripts/rea_evidence.mjs --focus`이며 로컬에 고정 설치한 REA를 사용합니다. 후자는 original·baseline 원시 분석이 있어야 하며 현재 누계나 과거 증빙을 임의 대체하지 않습니다.

브라우저 검사는 새 브라우저 컨텍스트와 가상 자료만 사용합니다. 검색·선택·변환 미리보기 취소·빈 전표 검증·저장 후 새로고침 보관을 검사하며 로그인·권한·호스팅된 업무 흐름은 별도 합격 조건입니다. 실패 시 결과는 `.artifacts/browser-results/`, HTML 보고서는 `.artifacts/browser-report/`에 남깁니다. 자동 테스트 복구는 사용하지 않습니다.

반복 작업은 관련 검사만 수행하고, 통합 확인 시 `verify:local`을 실행합니다. 배포는 기존 `docs/release-workflow.md` 절차를 따릅니다. 별도 오케스트레이션 서버·상시 다중 에이전트·추가 MCP·컨테이너·모델 기본값 변경은 이번 환경 구성에 포함하지 않습니다.

## Windows 브라우저 → Linux REA 연결

Windows의 내장 브라우저 채팅에서 입력값을 읽지 않고 만든 인계 JSON을 Linux에서 다음 한 명령으로 처리합니다.

```bash
npm run rea:handoff -- /mnt/c/Users/PL-PD-CHANGGWON-LEE/Desktop/rea_erp/browser-handoff/ecount-login-20261019.json
```

현재 프로토콜 v1은 관찰된 로그인 화면의 메타데이터와 `resource.ecount.com`의 공개 로그인 JavaScript 한 개만 허용합니다. `schemaVersion`, `captureId`, `capturedAt`, `source`, `page`, `controls`, `assets`, `observations`, `unverified`만 받으며 하위 객체도 지정된 필드만 받습니다. `controls`의 `type=password`, `id=passwd`는 구조 메타데이터입니다. `value`·쿠키·헤더·비밀값·업무 레코드 같은 추가 필드, 임의 라벨/서술, 페이지 query/hash, 다른 자원 경로는 거부합니다. 일반 ERP 업무 화면용 수집기는 아니며 새 화면은 별도 스키마와 관찰 계약이 필요합니다.

검증 후에만 인증·쿠키 없는 공개 GET을 실행합니다. 리다이렉트·로그인 HTML·크기 초과는 실패로 처리하고, 고정 REA 6.4.0 CLI로 저장된 JS를 실행 없이 분석합니다. 원문 SHA-256, 명령, 종료 코드, 검증된 REA 근거와 한계를 `.artifacts/browser-handoff/<실행별 폴더>/`에 남깁니다. `summary.json`은 Windows 관찰·정적 분석·미확인 ERP 동작을 구분하고, `development-plan.json`은 관찰 ID와 같은 REA 의미 노드 후보 및 기존 자체 코드의 파일/행/해시를 연결합니다. 같은 이름의 정적 노드는 실제 클릭 연결이나 동등성 증명이 아닙니다.

인계 기준은 [기존 구매실 계획의 현재 인계](docs/plan-purchase-manual.md)입니다. 분석 결과는 실행별로 보존하며 앱 코드·원본 업무자료·배포 상태는 이 명령으로 변경하지 않습니다.

## 이번 재구성

사용자 요청에 따라 원본 공개 JavaScript 11개와 기존 0.5.1 구현 전체를 REA 6.4.0으로 분석하고 기존 기능별로 재구성·검증했습니다. 로그인/메뉴 접근/명령 정책/양식 선택/설정 적용/API 대조·문서 흐름을 개편했습니다. 검증된 재고·금액 계산 커널은 보존하며 재현 의무와 테스트로 재검증했습니다. 모든 코드를 원본 서버와 동일하게 다시 만든 결과는 아닙니다. 근거·원본/기존/재구현의 차이·정적 분석 한도는 `docs/rea-reconstruction.md`, `evidence/rea-reconstruction*.json`에 기록합니다.

- 메뉴: 관찰된 10개 업무 영역, 59개 그룹, 759개 경로. 앱 권한으로 화면 진입을 검사합니다. 재고 I과 Self-Customizing 밖의 미구현 업무는 메뉴 탐색 범위입니다.
- 재고 I: 230개 경로, 20종 전표, 기초등록·부분 변환·수금/지급·BOM/BOR·MRP·쇼핑몰 모의 주문·현황·백업. 기존 모델 검증을 유지하고 앱 권한·기본값·단가/음수재고 정책·계정별 브라우저 저장 범위·표시 설정을 적용합니다.
- Option: 입력/행/조회/검색/인쇄 양식, 추가항목·계산식, 조건양식과 페이지설정. 권한 검사와 안정적인 조건 선택을 적용합니다. 원본의 모든 양식 디자이너 기능을 제공하는 것은 아닙니다.
- 앱 계정: 최초 관리자 등록, 회사코드·앱 ID 로그인, 비밀번호 변경, 로그아웃, 해시 저장, HttpOnly 세션, CSRF·동일 origin 검사, 실패 제한, 접속 폐기, 승인 상태·역할·IP 정책. 마지막 활성 관리자는 해제하지 않습니다.
- Self-Customizing: 31개 관리 경로와 기존 API센터 2개, 총 33개. 회사·로고·요약·사용자·권한그룹·승인·관리자·기본값·기능·포털·웹메일·급여 그룹·보안·접속·로그·파일 이력·허용 IP·가져오기·백업·초기화·편의 설정을 실제 저장 API에 연결했습니다.
- 고객 포털: 고객 계정/그룹·사용 설정에 따라 해당 거래처의 전표 요약만 조회합니다. 웹메일/급여/요약 보고 자동 발송은 외부 서비스 미연결로 표시합니다.
- API: 업무·연동 26개와 앱 계정·커스터마이징·포털 10개, 총 36개 HTTP 동작. 설정·자료 관리에는 24개 action이 있습니다. 전체 읽기형 매뉴얼 `/api-manual`, 기계 명세 `/api/v1/openapi.json`를 제공합니다. 원본 OAPI 28개와 의미 대응·부분 대응·미제공을 양방향 참조합니다. 이카운트 인증키 발급·실 연동은 실행하지 않았습니다.

## 자료와 저장소

기존 D1 호환 상태와 Supabase의 `rea_gateway_state`/`rea_app_state` 연결은 같은 수정 번호 검사를 사용합니다. 서버 비밀키가 설정된 경우에만 Supabase를 사용하며 기본 로컬 SQLite와 자동 동기화하지 않습니다. 아래 D1 스키마 설명은 기존 구현의 저장 구조입니다.

서버 D1의 기존 `gateway_state` 업무·API 키·송수신 이력은 보존합니다. 신규 `app_state`에 계정·회사·설정·접속·감사를 저장합니다. `drizzle/0001_tricky_maverick.sql`은 새 테이블만 추가하며 이미 적용된 0000 마이그레이션은 바꾸지 않습니다.

재고 I 화면의 업무 자료는 여전히 브라우저 저장소이며 서버 API 업무 영역과 별도입니다. 첫 관리자(owner)의 기존 브라우저 자료는 그대로 사용하고, 다른 사용자는 ID별 브라우저 영역을 사용합니다. 서버 인증은 서버 API를 보호합니다. 브라우저 로컬 자료를 회사 전체의 서버 원장으로 간주하지 마세요. 연동센터의 복사 미리보기로 명시적으로 자료를 옮길 수 있지만 송수신 이력이 있으면 교체를 차단합니다.

서버 초기화는 회사코드와 업무 수정 번호를 확인하고 복구 백업을 만듭니다. API 처리 이력이 있으면 초기화하지 않습니다. 초기화 후 새 업무가 있으면 자동 복구를 차단합니다. CSV/TSV/엑셀 붙여넣기는 전체 행을 검증한 미리보기만 적용하고 중복 적용을 방지합니다.

## 실행과 검증

`npm install`, `npm test`, `node scripts/check-release.cjs`, `npm run build` 순서로 검증합니다. 로컬 서버는 `npm run dev:api` (127.0.0.1:8781). 독립 실행의 최초 등록은 직접 로컬 접속에서만 허용하며 앱 계정 로그인 없이 업무에 진입하지 못합니다. `.artifacts`의 DB와 분석 원문은 배포하지 않습니다.

REA 재실행은 `python3 -X utf8 scripts/rea_rebuild.py capture`, `baseline`, `original`, `rebuilt` 모드 및 `node scripts/rea_evidence.mjs --focus`를 사용합니다. `capture`는 원본 자료 확보가 명시적으로 필요한 별도 작업에서만 실행합니다. 공개 원본 코드는 실행하지 않고 정적 텍스트로만 분석합니다. 인증정보·세션 쿼리·회사 업무 자료를 분석 입력에 포함하지 않습니다.

브라우저 검증과 자동 검증은 별개입니다. 로컬 합성 계정으로 로그인·회사정보 저장·새로고침·API센터·매뉴얼·로그아웃을 확인합니다. 배포에서는 최초 관리자 등록 화면과 저장소/암호 엔진 상태를 확인하고 실제 관리자 비밀번호는 사용자가 직접 입력합니다. 실 이카운트 호출·외부 발송·공유 사용자 접근 검증은 별도입니다.
