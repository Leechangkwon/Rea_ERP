# Windows 주도 개발 인계 — 2026-10-19

## 현재 운영 · 0.46.3 양방향 송수신 검증 완료 (2026-10-19)

실제 양방향 송수신과 기존 계정 로그인을 확인했다. purchase@qaredi.com → pkdkak1@gmail.com은 Gmail INBOX 도착 및 SPF/DKIM/DMARC 모두 pass다. 사용자가 추가 시험1통을 승인해 Gmail → purchase@qaredi.com을 발송했고 19:23:23 KST에 받은편지함 저장, 운영 화면 본문·첨부0·읽음 저장과 해당 Message-ID 레코드1건을 확인했다. 원래 시험도 자동 재시도로 19:24:37 KST에 도착했다. 외부 시험은 회사→Gmail1통, Gmail→회사2통이며 모두 연결 안내만 포함했다.

수신 Worker의 redirect:error 미지원 예외를 manual로 수정한 소스 5780f5f를 업로드 후 기존 WSL 서버와 Worker에 반영했다. 전체 verify:local·관련 Node54개·합성 브라우저19개·릴리스4개 및 실제 workerd 회귀 검사가 통과했다. 기존 계정·비밀번호·회사·설정·권한·업무자료·비공개 설정값을 보존했고, 최종 메일 백업3함/5메시지/1파일의 무결성과 추가 복원 미리보기0충돌을 확인했다. 복원은 실행하지 않았다. 현재 운영 버전은0.46.3이며 이 검증은 코드 변경 없이 수행했다.

## 이전 활성화 기록 · 0.46.2 (2026-10-19)

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


## 현재 배포 기준 — 사용자 재확인 (2026-10-19)

사용자가 현재 구성을 **로컬·Supabase·Cloudflare**로 재확인했다. 이 지시가 아래 과거 Sites/D1 배포 기록보다 우선한다. 로컬 개발·검증은 `/home/lck/projects/Rea_ERP`에서 계속하며, Supabase 연결과 Cloudflare 공개 경로는 기존 설정을 확인한 뒤 이 기준으로 준비한다. Sites 업로드·새 버전 저장·배포를 실행하지 않는다.

기존 D1 호환 API를 보존하는 Supabase 어댑터와 독립 로컬 실행기를 추가했다. `npm run dev:api`와 `npm run serve:local`은 같은 실행기를 사용하며 기본은 기존 로컬 SQLite다. 기존 `rea` Supabase 프로젝트의 REA 전용 테이블·RLS·서버 권한은 읽기 전용으로 확인했다. 사용자의 재지시에 따라 REA 전용 서버 키 `rea_erp_server`를 생성해 사용자 전용 설정(600)에 저장하고 기존 default 서버 비밀키를 폐기했다. 폐기 후에도 새 키로 두 테이블의 실제 읽기 전용 연결 검사가 통과했으며 공개용 default 키는 유지했다. 사용자가 Cloudflare 도메인 `rea.qaredi.com` 유지를 확정했고 전용 `rea-erp-local` Tunnel과 수동 실행·사전 검사 구성을 준비했다. 사용자가 기존 계정·자료를 보존하는 운영 전환을 명시적으로 요청해 원본 SQLite와 설정을 백업하고 비밀번호 해시·회사·설정·수정 번호를 검증하여 Supabase로 이관했다. 0.43.0 커밋 `d0a26ff`를 원격에 올린 뒤 로컬 서버를 Supabase로 재시작하고 `rea.qaredi.com`을 전용 Tunnel에 연결했다. 외부 HTTPS의 0.43.0 로그인 화면과 로그인 전 업무 접근 차단을 확인했으며 기존 계정의 실제 로그인·메인 화면 진입·새로고침 후 인증 유지, Supabase의 로그인 성공 기록·유효 세션 저장과 계정·회사 설정 보존까지 확인했다. 운영 근거는 `evidence/deployment-local-supabase-cloudflare-20261019.json`이다. `.openai/hosting.json`과 `rea.qaredi.com`의 과거 기록만으로 현재 대상을 확정하지 않는다. 상세 상태와 검증은 `docs/plan-local-supabase-cloudflare-20261019.md`를 따른다. 기존 앱 로그인·업무자료·운영 설정과 브라우저/서버 자료 분리를 보존하며 자동 이관하지 않는다.

아래 내용은 위 사용자 재확인 이전의 인계 기록이며, Sites 배포 관련 표현은 과거 기록이다.

Windows의 현재 채팅이 브라우저 관찰·작업 결정·검증을 주도하고, 명령과 소스 수정은 기존 WSL 작업 폴더에서 수행한다. 별도 Windows 소스 복제나 중복 의존성 설치는 필요하지 않다. 이전의 Windows 관찰 / Linux 구현 분담은 실행 위치를 나눈 것이며, Windows 채팅에서 Linux 명령을 직접 실행하는 것도 검증됐다. 이 문서는 인계용이며 프로젝트 [AGENTS.md](../AGENTS.md)를 대체하지 않는다.

## 1. 작업 위치와 현재 변경

- 기준 저장소: `/home/lck/projects/Rea_ERP`. WSL 배포판 `Ubuntu`, 사용자 `lck`, WSL2 커널 확인. Windows의 `C:\Users\PL-PD-CHANGGWON-LEE\Desktop\rea_erp`는 브라우저 인계 파일/실행기를 두는 위치이며 별도의 기준 소스가 아니다.
- Git: `main`, HEAD `008c735313aeeddad3815ab16c7b7a71a652982e`, 앱 `0.42.0`. 로컬에 기록된 `origin/main`과 같다. 이번 인계에서 원격 fetch나 현재 호스팅 버전 조회는 하지 않았다.
- 시작 시 **수정 8개**: `AGENTS.md`, `README.md`, `docs/plan-purchase-manual.md`, `package.json`, `package-lock.json`, `scripts/rea_evidence.mjs`, `scripts/rea_rebuild.py`, `scripts/request-preview.cjs`.
- **미추적 13개**: `.node-version`, `.python-version`, `evidence/development-environment-20261019.json`, `playwright.config.cjs`, `scripts/browser-handoff.mjs`, `scripts/browser-runtime.cjs`, `scripts/check-environment.cjs`, `scripts/install-browser.cjs`, `scripts/rea-analyze.mjs`, `scripts/rea-sources.cjs`, `tests/browser-handoff.cjs`, `tests/browser/request.spec.cjs`, `tests/dev-tools.cjs`. 기존 환경 구성과 브라우저 연결 변경이므로 보존한다. 이 인계 문서는 별도로 추가된다.
- 검증 사이트: https://rea.qaredi.com . 기존 사이트 식별자는 [`.openai/hosting.json`](../.openai/hosting.json), 관리 페이지는 https://chatgpt.com/space/page_61170ef3893c81919dd7d59c77385674 . 현재 지침의 public 공개 범위와 ERP 자체 인증·권한을 유지한다.
- 로컬 합성자료·브라우저 저장소·로컬 API SQLite·호스팅 D1·원본 ECOUNT는 구분한다. 서로 자동 이관하지 않는다. 배포는 `dist/`만 사용하며 원문·캐시·관찰 자료는 `.artifacts/`에 둔다. 원본 서비스, 다른 앱, 운영 설정과 Supabase는 이번 인계 대상이 아니다.

## 2. 도구와 실행 명령

이번에 `npm run env:check`를 읽기 전용으로 다시 실행하여 `platform=linux`, `passed=true`를 확인했다. Windows 채팅에서도 아래 WSL 명령의 성공을 전달했다.

```powershell
wsl.exe -d Ubuntu -u lck --cd /home/lck/projects/Rea_ERP -- npm run env:check
```

같은 접두어 뒤에 아래 명령을 붙여 Linux에서 실행한다. 셸이 필요한 연속 작업은 WSL 터미널에서 저장소로 이동해 수행한다.

| 도구 | 확인 버전 / 설치·고정 기준 |
| --- | --- |
| Node / npm | `24.22.0` / `11.19.1`; `/usr/local/bin/node`, `/usr/local/bin/npm`. `.node-version`, `package.json` engines 참고 |
| Python | `3.14.4`; `/usr/bin/python3`, `.python-version`. 명령은 `python3` 사용 |
| Git / procps | `2.53.0` / `4.0.4`; `/usr/bin/git`, `/usr/bin/ps`. 설치 버전 확인이며 프로젝트에서 이 둘의 버전을 고정한 것은 아님 |
| npm 의존성 | `package.json`의 정확한 버전과 `package-lock.json`; 설치 경로는 저장소의 `node_modules/` |
| Chromium | 기존 Playwright 브라우저 캐시 사용. 프로젝트 OS 라이브러리는 `.artifacts/browser-libs/`, Chromium 프로세스에만 적용 |

| 목적 | 기존 명령 / 범위 |
| --- | --- |
| 최초 준비·복구 | `npm ci` → `npm run browser:install` → `npm run env:check`. 현재 설치는 정상이라 인계만을 위해 재설치하지 않음 |
| 정적 화면 시작 | `npm start` → `http://127.0.0.1:8780`, `dist/` 전용. 원본 ERP 프록시나 인증 API 서버가 아님 |
| 합성 발주요청 시작 | `npm run dev` → 기본 `http://127.0.0.1:4173`, 가상자료/모의 인증 |
| 로컬 API 시작 | 필요 시 `npm run build`, 이후 `npm run dev:api` → `http://127.0.0.1:8781`, `.artifacts/preview.sqlite` 사용. 호스팅 신원은 로컬 모의 처리 |
| 종료 | 시작한 터미널에서 `Ctrl+C`. 백그라운드라면 자신이 시작한 서버의 PID를 확인한 뒤 `kill -TERM <PID>`. `npm stop` 스크립트는 없음; 전체 WSL이나 다른 서버를 종료하지 않음 |
| 관련 검사 | 해당 `node --test tests/<관련파일>.cjs` 또는 기존 npm 스크립트. `npm run test:tools`, `npm run test:browser` |
| 통합 검증 | `npm run verify:local`: 환경 → 도구 → 전체 `npm test` → 릴리스 검사 → 빌드 → 합성 브라우저 |
| 메뉴 재생성 | `npm run menu:prepare`를 명시적으로 실행할 때만. 의존성 설치 중에는 실행하지 않음 |

사용하는 환경변수는 이름과 용도만 인계한다. 일반 개발·인계 분석에 별도 비밀 환경변수는 필요하지 않다.

| 이름 | 용도 |
| --- | --- |
| `PATH` | 기존 Linux Node/npm/Python/procps 실행 파일 선택; 현재 명령 실행 검증됨 |
| `HOST`, `PORT` | `scripts/request-preview.cjs`의 바인딩 주소·포트 선택. 합성 테스트는 `playwright.config.cjs`가 루프백과 별도 포트를 지정 |
| `LD_LIBRARY_PATH` | `scripts/browser-runtime.cjs`가 Chromium 실행 환경에 프로젝트 라이브러리를 추가. 전역 셸 설정을 바꿀 필요 없음 |
| `REA_PACKAGE` | 과거 `scripts/rea_evidence.mjs`의 선택적 설치 경로 재지정. 현재 로컬 고정 패키지 자동 탐색 사용 |
| `LOCALAPPDATA` | 같은 과거 스크립트의 Windows npm 캐시 보조 탐색. 현재 Linux 경로에는 필요 없음 |
| `TAR_OPTIONS` | 릴리스 절차에 있는 Windows 패키징 보조 설정. 일상 WSL 개발에는 필요 없음 |

## 3. 지침과 합격 기준

최신 사용자 작업 범위를 확인한 뒤 프로젝트 `AGENTS.md`를 적용한다. 기능 현황은 `evidence/global-rea-20261018/current-release.json` → 그 파일이 참조하는 현재 기능 계약/문서 순서로 판단한다. [docs/plan-purchase-manual.md](plan-purchase-manual.md)의 **현재 인계**가 협업 계획이고, 그 아래 옛 경로·작업자·비공개 배포 표현은 과거 기록이다. `docs/plan-browser-linux.md`는 실제로 없으므로 참조하지 않는다. 배포 실행은 [docs/release-workflow.md](release-workflow.md)와 그때 읽는 Sites 스킬을 따른다.

- ERP 개발 우선순위: **발주요청 → 발주계획 → 발주서 → 구매**. 현재 완료한 범위는 브라우저 관찰 → 실제 REA 분석 → Linux 코드 검토 지점 연결이다. 다음 ERP 세부 기능은 별도로 확정한다.
- 원본 관찰, 공개 코드 정적 분석, 자체 구현, 합성 검사, 미확인 서버 동작을 구분한다. 버튼·하위 메뉴·팝업·입력 조건·권한·결과·취소·오류·보관 범위에 사용 예와 합격 조건을 둔다. 메뉴 존재·정적 후보·테스트 통과만으로 원본 동등성을 선언하지 않는다.
- 원본 주 입력행 입력, 행 번호·선택·순서·이동 컨트롤 조작은 중단된 상태다. 값 입력 없이 행 링크만 열어도 임시초안이 자동 저장된 전력이 있다. 원본 저장·삭제·취소·발송·설정 저장을 임의 실행하지 않는다. 정적 DOM·조회 전용 화면·공개 코드만 허용 범위에서 조사한다.
- 로그인 정보·입력값·쿠키·세션 URL·회사 업무자료를 수집/전달/배포하지 않는다. Playwright는 localhost 합성자료 전용이며 원본 ERP 자동 탐색·자동 복구에 사용하지 않는다.
- 기본 주 에이전트 1명. 독립 조사/복잡한 검토가 필요한 경우에만 보조 작업을 고려하고 같은 파일 동시 수정을 피한다. Sol/Astra/Luna는 기존 지침의 작업 성격별 후보이며 계정 모델 설정을 바꾸는 지시가 아니다.
- 저장 구조 변경 시 기존 백업 검증·변환·복원을 함께 정한다. 배포를 요청받으면 버전 갱신·검사·정확한 커밋 업로드·같은 사이트 배포·호스팅 검증·관리 페이지 갱신 순서를 지킨다. lock의 버전 갱신은 최상위와 빈 패키지 키만 바꾸며 의존성 버전/engines를 건드리지 않는다.

## 4. 오픈소스와 REA 사용

아래 저장소와 버전은 설치된 패키지 메타데이터/lock 기준이다. 최신 버전 추천이나 업데이트 지시가 아니다. 설치 위치는 모두 `/home/lck/projects/Rea_ERP/node_modules/<패키지>/`다.

| 패키지 | 고정 버전 | 공식 저장소 / 사용 목적 |
| --- | --- | --- |
| `rea-agents` | `6.4.0` | https://github.com/morluto/rea — 실행하지 않은 JS 정적 분석 |
| `@playwright/test` | `1.64.1` | https://github.com/microsoft/playwright — 합성 브라우저 검사 |
| `jsdom` | `27.0.1` | https://github.com/jsdom/jsdom — Node에서 DOM/통합 검사 |
| `drizzle-kit`, `drizzle-orm` | `0.31.11`, `0.45.4` | https://github.com/drizzle-team/drizzle-orm — 기존 DB 스키마·도구 |
| `bcryptjs` | `3.0.3` | https://github.com/dcodeIO/bcrypt.js — 자체 앱 인증 |
| `jsbarcode` | `3.12.1` | https://github.com/lindell/JsBarcode — 자체 바코드 표시 |

REA CLI는 `node_modules/rea-agents/scripts/rea.mjs`다. 현재 프로젝트는 **고정 설치 CLI와 검증 라이브러리**를 사용한다. `/home/lck/.codex/config.toml`에서 REA MCP 항목은 발견하지 못했고 현재 Linux 채팅에 REA MCP 도구도 없다. CLI 실행은 이미 성공했으므로 MCP 추가 설치를 전제로 하지 않는다.

```bash
npm run rea:analyze -- menu
# menu / request / reports / api / all 중 하나
npm run rea:sources
node node_modules/rea-agents/scripts/rea.mjs analyze-javascript-application --help
```

- `rea:analyze`의 입력은 자체 `dist/`·`worker/`의 허용된 JS/CJS뿐이다. `request`는 10개 파일이며 전체 ERP가 아니다. 요약은 `.artifacts/rea-cache/<그룹>-latest.json`, 원시 근거는 같은 폴더의 해시별 `result.json`, 입력 스냅샷은 `.artifacts/rea-inputs/`에 있다.
- 원본 분석용 CLI의 `analyze-javascript-application <path>`는 로컬 디렉터리 또는 ASAR를 받는다. JS 번들·관련 HTML/source map을 정적 입력으로 다룬다. 현재 옵션은 `--artifact-format directory --max-heap-mb 4096 --analysis-timeout-ms 45000 --format json`. 원본은 배포 폴더에 넣거나 실행하지 않는다.
- 캐시는 입력·설정·REA 버전 해시, 결과 해시, REA 근거 검증이 일치할 때만 재사용한다. 실패한 결과는 재사용하지 않는다. 부분 의미 그래프·시간/메모리 한계는 완료로 바꾸지 않고 더 작은 입력 단위로 보완한다.
- `rea:sources`는 과거 11개 목록과 지정 원시 분석 파일의 존재/해시만 검사하며 자동 다운로드하지 않는다. 과거 `python3 -X utf8 scripts/rea_rebuild.py rebuilt` 및 `node scripts/rea_evidence.mjs --focus`는 입력 의존 관계를 확인한 뒤 사용한다. 후자의 original/baseline 원시 분석은 현재 없어 그대로 재실행하면 실패한다. `capture`는 원본 수집이 명시적으로 필요한 별도 작업에서만 사용한다.

## 5. 최근 브라우저 인계 연결

구현은 [scripts/browser-handoff.mjs](../scripts/browser-handoff.mjs), 경계 검사는 [tests/browser-handoff.cjs](../tests/browser-handoff.cjs)다. 입력은 Windows가 실제 AX/read-only DOM에서 읽은 로그인 화면 구조이며 Linux 자체 브라우저 관찰로 기록하지 않는다.

```powershell
wsl.exe -d Ubuntu -u lck --cd /home/lck/projects/Rea_ERP -- npm run rea:handoff -- /mnt/c/Users/PL-PD-CHANGGWON-LEE/Desktop/rea_erp/browser-handoff/ecount-login-20261019.json
```

- Windows 입력: `C:\Users\PL-PD-CHANGGWON-LEE\Desktop\rea_erp\browser-handoff\ecount-login-20261019.json`. 실행기: 같은 상위 폴더의 `Analyze-Saved-Browser-Handoff.cmd`. 이 실행기는 저장된 관찰을 재분석하며 브라우저를 새로 수집하지 않는다.
- 프로토콜 v1: `schemaVersion/captureId/capturedAt/source/page/controls/assets/observations/unverified`. 현재 알려진 로그인 제목·컨트롤 구조·서술 및 공개 로그인 JS 경로만 받는다. `type=password`, `id=passwd` 같은 메타데이터는 허용하지만 입력값·쿠키·헤더·비밀 필드·업무자료·임의 서술/URL·query/hash는 거부한다. 일반 업무 화면이나 임의 DOM 수신기가 아니다.
- 검증 후 인증 없는 공개 GET 한 건 → SHA-256 기록 → 고정 REA 실행 → 근거 검증 → 기존 자체 코드 검토 지점 연결. 리다이렉트·로그인 HTML·크기 초과·분석 실패는 성공으로 처리하지 않는다. 검증/다운로드 실패는 오류 종료하며, 분석 단계 실패는 실행 폴더의 `failure.json`·REA 로그에 남는다.
- 출력: `.artifacts/browser-handoff/<실행별 폴더>/`의 `handoff.json`, `input/`, `source-manifest.json`, `rea-result.json`, `rea-stderr.log`, `summary.json`, `development-plan.json`. 결과는 현재 계획과 자체 `dist/auth-ui.js:18`의 검토 지점을 참조하며 ERP 기능 코드를 자동 변경하지 않는다.
- Windows 독립 실행 근거: [FHyYR5/summary.json](../.artifacts/browser-handoff/ecount-login-20261019-FHyYR5/summary.json), [개발 연결](../.artifacts/browser-handoff/ecount-login-20261019-FHyYR5/development-plan.json). Windows의 `browser-handoff/linux-summary.json`, `linux-development-plan.json`은 복사본이다. 입력·결과 파일 모두 실제 존재한다.

## 6. 보유 자료·검증·미확인

| 범위 | 이번 인계에서 확인한 상태 |
| --- | --- |
| 환경 | `env:check` 전체 통과. Chromium 경로 존재 확인이며 이번 문서 작업에서 새 브라우저 흐름을 실행하지 않음 |
| 자체 REA 캐시 | `menu-latest.json`: 1파일·부분 아님. `request-latest.json`: 10파일·부분 의미 분석. 두 캐시의 현재 입력/결과 SHA-256 일치 확인. 근거 스키마 검증은 기존 생성·재사용 실행에서 통과 |
| 발주요청 분석의 한계 | `inventory-core.js`, `inventory-ui.js`의 의미 그래프가 부모 결과 용량 한계로 생략됨. 정적 사실은 남아 있으나 기능/호출 그래프 완료가 아님 |
| 현재 확보한 원본 | 공개 로그인 JS 61,698B, SHA-256 `fd048c85645cb2684a16e4e520abf3bf9e51f3731f662f489882389c38152167`. `.artifacts/browser-handoff/`의 `kL5CXy`, `oec7b6`, `FHyYR5` 실행에 같은 본문이 있음. 원문과 REA 결과 해시를 모두 재확인 |
| 실제 로그인 REA | 위 3회 실행 결과 모두 종료 0/파싱 1/오류 0/의미 노드 6,043/부분 아님. 정적 분석 성공이며 로그인 실행·서버 검증은 아님 |
| 누락 자료 | `evidence/self-public-sources.json`의 과거 11개는 지정 위치 `analysis/source-self/`에 모두 없음. `.artifacts/rea-original.json`, `.artifacts/rea-baseline.json`, `.artifacts/rea-rebuilt.json`도 없음. 로그인 JS는 위의 별도 경로에 재확보된 것이므로 모든 원본이 없다고 해석하지 않음 |
| 전체 누계 | current-release의 86본문/25,293,345B는 과거 근거 누계. 이번에 86개 전체 원문 보유를 검증하지 않았으며 같은 로그인 본문 재분석으로 누계를 증가시키지 않음 |
| 기존 검사 | 연결 구현 시 `npm run test:tools` 7개 통과, 실제 Windows→WSL 실행 종료 0. [환경 기록](../evidence/development-environment-20261019.json)은 이전 전체 npm 검사·릴리스 4개·빌드·합성 브라우저 4개 통과를 기록. `.artifacts/browser-report/index.html` 존재. current-release의 전체 998개는 해당 릴리스 기준이며 신규 도구 검사와 임의 합산하지 않음 |

로그인 성공, 로그인 후 원본 업무 화면, 현재 회사별 버튼 연결/권한/저장·출력·서버 처리, 호스팅 로그인 후 업무 검증과 원본 동등성은 미확인이다. 정적 이름 일치는 실제 action 연결을 입증하지 않는다. 기존 의존성 감사에서 개발용 drizzle-kit/esbuild 계열 moderate 4개가 기록됐지만 이번에 감사를 다시 실행하거나 강제 업데이트하지 않았다. 현재 활성 배포 버전·사이트 상태·전체 원본 86개의 실재는 이번 문서 확인 범위 밖이다.

## 7. 다음 채팅의 시작 순서

먼저 아래 **5개 파일**을 읽는다. 경로는 모두 `/home/lck/projects/Rea_ERP/` 기준이며 실제 존재한다.

1. `AGENTS.md` — 작업 경계와 원본 관찰 금지 동작.
2. `evidence/global-rea-20261018/current-release.json` — 현재 기능 계약·누계·미검증 범위.
3. `docs/plan-purchase-manual.md` — 현재 인계/연결 구현 결과; 과거 계획과 구분.
4. `README.md` — WSL 명령, 원본/합성자료 경계, 브라우저 인계 형식.
5. `docs/release-workflow.md` — 배포가 실제 범위에 들어갈 때의 절차.

그다음 `git status --short --branch`로 기존 변경을 확인하고 `npm run env:check`로 실행 환경을 점검한다. 저장된 로그인 연결만 재확인하려면 위 `rea:handoff` 명령을 사용한다. 새 ERP 작업은 사용 예·합격 조건을 확정하고 Windows에서 허용된 관찰을 한 뒤, 해당 기능의 현재 계약을 읽고 Linux에서 REA·구현·관련 검사를 수행한다. 화면 계약이 달라지면 로그인 전용 수신기를 우회하지 말고 별도 입력 경계를 정한다. 기존 변경 보존과 변경 파일 소유를 먼저 정하여 동시 편집을 피한다.

이번 인계에서 작성하는 파일은 이 문서 한 개다. 환경 검사와 경로·해시·설치 메타데이터 확인만 수행했으며 새로운 분석/테스트 실행, 의존성 설치, ERP 기능 수정, 커밋·배포·계정 설정 변경은 하지 않았다.
