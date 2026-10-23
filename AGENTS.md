# 이카운트 재현 개발 운영

## Linux 개발 환경

- 작업 경로는 `/home/lck/projects/Rea_ERP`이며 `npm ci`, `npm run browser:install`, `npm run env:check`로 준비합니다. `.node-version`, `.python-version`, package-lock의 고정 도구 버전을 사용합니다.
- 반복 개발은 관련 Node/jsdom 검사와 `npm run test:tools`, `npm run test:browser`를 사용합니다. 통합 검증은 `npm run verify:local`입니다. 메뉴 재생성은 명시적인 `npm run menu:prepare`만 사용하며 패키지 설치 중 실행하지 않습니다.
- REA는 `npm run rea:analyze -- menu|request|reports|api|all`로 기능별 실행합니다. 입력·설정 해시와 검증된 근거가 같은 경우만 캐시를 재사용합니다. 일부 의미 그래프 생략은 완료로 올리지 않고 더 작은 분석 단위로 보완합니다. 원본 자료의 실제 보유 상태는 `npm run rea:sources`로 확인하며 자동 다운로드하지 않습니다.
- Playwright는 localhost의 고립된 합성자료만 검사합니다. 실제 로그인·호스팅된 업무 검증·원본 동등성 검증과 구분합니다. 원본 ERP에 자동 탐색·테스트 복구를 적용하지 않습니다.
- 기본은 주 에이전트 1명입니다. 독립적인 근거 조사나 복잡한 변경 검토가 필요할 때만 보조 에이전트를 사용하고 같은 파일의 동시 수정을 피합니다. 일상 구현은 사용 가능한 Sol, 어려운 분석은 Astra, 정형 정리는 Luna를 후보로 삼되 실제 계정 설정을 임의 변경하지 않습니다.
- 현재 릴리스 근거와 이번 기능의 문서를 먼저 읽고 관련 자료만 추가로 읽습니다. 아래 과거 기능 문서 전체를 매번 읽을 필요는 없습니다. 도구·분석 원문·브라우저 결과는 `.artifacts/`에 두고 배포하지 않습니다.

작업 범위는 이 폴더의 독립 샘플입니다. 상위 C:\vibe의 다른 앱을 변경하지 않습니다.

## 현재 배포 기준 — 사용자 재확인 (2026-10-19)

사용자가 현재 구성을 **로컬·Supabase·Cloudflare**로 재확인했다. 이 지시가 아래 과거 Sites/D1 배포 기록보다 우선한다. 로컬 개발·검증은 `/home/lck/projects/Rea_ERP`에서 계속하며, Supabase 연결과 Cloudflare 공개 경로는 기존 설정을 확인한 뒤 이 기준으로 준비한다. Sites 업로드·새 버전 저장·배포를 실행하지 않는다.

기존 D1 호환 API를 보존하는 Supabase 어댑터와 독립 로컬 실행기를 추가했다. `npm run dev:api`와 `npm run serve:local`은 같은 실행기를 사용하며 기본은 기존 로컬 SQLite다. 기존 `rea` Supabase 프로젝트의 REA 전용 테이블·RLS·서버 권한은 읽기 전용으로 확인했다. 사용자의 재지시에 따라 REA 전용 서버 키 `rea_erp_server`를 생성해 사용자 전용 설정(600)에 저장하고 기존 default 서버 비밀키를 폐기했다. 폐기 후에도 새 키로 두 테이블의 실제 읽기 전용 연결 검사가 통과했으며 공개용 default 키는 유지했다. 사용자가 Cloudflare 도메인 `rea.qaredi.com` 유지를 확정했고 전용 `rea-erp-local` Tunnel과 수동 실행·사전 검사 구성을 준비했다. 사용자가 기존 계정·자료를 보존하는 운영 전환을 명시적으로 요청해 원본 SQLite와 설정을 백업하고 비밀번호 해시·회사·설정·수정 번호를 검증하여 Supabase로 이관했다. 0.43.0 커밋 `d0a26ff`를 원격에 올린 뒤 로컬 서버를 Supabase로 재시작하고 `rea.qaredi.com`을 전용 Tunnel에 연결했다. 외부 HTTPS의 0.43.0 로그인 화면과 로그인 전 업무 접근 차단을 확인했으며 기존 계정의 실제 로그인·메인 화면 진입·새로고침 후 인증 유지, Supabase의 로그인 성공 기록·유효 세션 저장과 계정·회사 설정 보존까지 확인했다. 운영 근거는 `evidence/deployment-local-supabase-cloudflare-20261019.json`이다. `.openai/hosting.json`과 `rea.qaredi.com`의 과거 기록만으로 현재 대상을 확정하지 않는다. 상세 상태와 검증은 `docs/plan-local-supabase-cloudflare-20261019.md`를 따른다. 기존 앱 로그인·업무자료·운영 설정과 브라우저/서버 자료 분리를 보존하며 자동 이관하지 않는다.

## 관리와 검증

- 관리 페이지: https://chatgpt.com/space/page_61170ef3893c81919dd7d59c77385674
- 검증 사이트: https://rea.qaredi.com
- `.openai/hosting.json`은 과거 Sites 배포 기록입니다. 현재 대상은 사용자 지정 로컬·Supabase·Cloudflare 구성이며, 정확한 프로젝트와 도메인 경로를 확인한 뒤 사용합니다.
- ERP 자체 로그인·권한과 기존 자료를 보존합니다. 과거 Sites의 public 접근 설정을 Cloudflare의 현재 접근 정책으로 간주하지 않습니다. 검증에는 새로 만든 가상 자료만 사용합니다.
- 기능마다 사용 예와 합격 조건을 정하고, 구현 후 관련 자동 검사와 브라우저 흐름을 확인합니다.
- 로컬 검사, jsdom 검사, 호스팅된 브라우저 검증, 원본 ERP 관찰은 구분해서 기록합니다.
- 배포 전 버전을 올리고 `npm test`와 `node scripts/check-release.cjs`를 실행합니다. 실제 배포는 `docs/release-workflow.md`의 현재 로컬·Supabase·Cloudflare 기준을 따릅니다.
- 배포할 커밋을 먼저 저장소에 올린 후 해당 커밋의 패키지를 배포합니다. 자격 증명은 콘솔·파일·명령행 인자에 남기지 않습니다.
- 배포 후 관리 페이지의 현재 버전, 변경 내용, 검사 결과, 커밋, URL, 남은 작업을 갱신합니다.
- 실패한 배포는 성공으로 기록하지 않습니다. 이전 정상 버전이 있을 때만 그 버전을 재배포할 수 있다고 기록합니다.

## 자료와 기능 경계

- 실행 파일은 `dist/`만 배포합니다. 원본 소스 분석·관찰 자료는 실행 파일과 분리합니다.
- 원본 ERP의 로그인 정보, 세션 URL, 쿠키, 회사 업무자료를 수집·배포하지 않습니다.
- 기존 재고 화면 자료는 브라우저 저장소, API 자료는 D1의 별도 검증 업무 영역에 있습니다. 자료를 옮길 때 미리보기·수정 번호·미완료 작업을 확인합니다. 원본 자료를 자동 교체하지 않습니다.
- 양식과 자료 구조를 변경할 때 기존 백업의 검증·변환·복원 정책을 함께 정합니다.
- 실 ERP 연결, 여러 사용자와 권한은 별도 합격 조건을 정한 뒤 구축합니다. 현재 API 서버는 소유자 전용 가상 자료 검증 단계입니다.

다음 작업과 운영 절차는 관리 페이지와 `docs/release-workflow.md`를 따릅니다.

## 원본 대조 개발 기준

사용자의 별도 요청이 없는 한 원본 화면을 직접 관찰하고 클릭 가능한 영역의 하위 항목·팝업·반응을 확인한 후 REA 근거와 대조해 구현합니다. 미확인 버튼 위치·동작은 추정하여 개발하지 않습니다. 구매관리 우선순위는 발주요청 → 발주계획 → 발주서 → 구매이며 현재는 발주요청부터 진행합니다. 화면 관찰, 공개 코드 정적 분석, 자체 구현, 합성자료 검증, 미확인 서버 동작을 각각 구분해 기록합니다. 원본의 저장·삭제·취소·발송·설정 저장은 임의 실행하지 않습니다.

## 전역 재현 합격 기준

사용자는 2026년 10월 18일 전역 메뉴뿐 아니라 버튼 하나하나의 상세 재현을 요청했습니다. 화면별 버튼·하위 메뉴·팝업·입력 조건·검증·권한·실행 결과·취소·오류·보관 범위를 기록합니다. 메뉴 존재, REA 파싱 성공, 정적 액션 후보 개수와 자체 테스트 통과만으로 원본 동등성 완료를 선언하지 않습니다. 버튼별 원본 관찰과 공개 코드, 자체 구현, 합성 검사, 미확인 서버 동작을 각각 구분합니다. 전역 기준표와 이번 관찰은 `evidence/global-rea-20261018/` 및 `docs/global-reconstruction-0.11.1.md`, `docs/verification-toolbar-0.11.2.md`, `docs/entry-toolbar-0.12.0.md`, `docs/entry-sort-0.13.0.md`, `docs/save-retain-0.14.0.md`, `docs/purchase-summary-0.15.0.md`, `docs/report-date-shortcuts-0.16.0.md`, `docs/request-save-retain-0.17.0.md`, `docs/report-sort-0.18.0.md`, `docs/summary-axes-0.19.0.md`, `docs/axis-directions-0.20.0.md`, `docs/date-axes-0.21.0.md`, `docs/item-groups-0.22.0.md`, `docs/voucher-lines-0.23.0.md`, `docs/classification-groups-0.24.0.md`, `docs/import-preview-0.25.0.md`, `docs/plan-order-retain-0.26.0.md`, `docs/save-new-0.27.0.md`, `docs/purchase-graph-0.28.0.md`, `docs/graph-filter-0.29.0.md`, `docs/graph-colors-0.30.0.md`, `docs/graph-hsv-0.31.0.md`, `docs/subtotals-0.32.0.md`, `docs/drilldown-0.33.0.md`, `docs/plan-aggregate-0.34.0.md`, `docs/order-aggregate-0.35.0.md`, `docs/request-aggregate-0.36.0.md`, `docs/purchase-rewrite-0.37.0.md`, `docs/aggregate-targets-0.38.0.md`, `docs/order-targets-0.39.0.md`, `docs/document-history-0.40.0.md`, `docs/order-list-columns-0.41.0.md`, `docs/purchase-list-columns-0.42.0.md`를 따릅니다.

원본 구매 입력은 품목 선택만으로도 임시초안을 자동 저장합니다. 확인용 임시초안 정리 후 원본 주 입력행 편집을 중단했습니다. 이후 비교는 조회·분리 팝업·공개 코드 및 자체 합성자료에서 수행하며 원본 주 입력행을 다시 채우지 않습니다.

행 번호/이동 링크를 읽기 위해 열어도 빈 임시초안이 자동 저장되는 것을 추가 확인했습니다. 이번 빈 초안도 정리했습니다. 원본 주 입력행의 값 입력과 행 번호·선택·순서·이동 컨트롤 조작을 중단하고, 원본 조사는 정적 DOM 읽기·조회 전용 페이지·공개 코드로 진행합니다.

공개 코드의 `SendSlipToInsideBookmarkUserAction`은 서버 `send` 저장 호출을 기다린 뒤 북마크 목록 열기 확인창을 표시합니다. 원본 전표 북마크 버튼을 조회용 팝업으로 눌러 관찰하지 않습니다. 확인창 취소가 앞선 저장을 취소한다는 가정도 하지 않습니다. 검증된 별도 읽기 전용 경로와 정적 분석만 사용하며 근거는 `evidence/manual-voucher-bookmark-20261023.json`입니다.

최신 누계와 배포 근거의 시작점은 `evidence/global-rea-20261018/current-release.json`입니다. 과거 global-summary는 당시 연구의 기준 자료로 보존하며 현재 누계로 오해하지 않습니다. 버전 변경은 package-lock의 최상위 version과 packages 빈 키의 version만 수정하고 의존성 engines·버전 문자열은 바꾸지 않습니다.

## 개발 기록의 변경 이유 — 사용자 요청 (2026-10-24)

기존 모아 Rea_ERP 프로젝트에 계획 단위별 개발 경위와 앞으로 할 일을 기록합니다. 모든 변동은 **당초 계획/근거 → 기존과 변경 → 왜 변경했는가 → 검증과 한계 → 기존 자료 보존 → 다음 일과 그 이유**를 포함합니다. 과거에 기록되지 않은 판단 이유나 세션 날짜는 추정하지 않습니다. 기록 색인은 `docs/development-records/README.md`이며 기존 PRD·아키텍처·로드맵을 대체하지 않습니다. 모아 기록은 실제 업무문서 조회·생성/갱신·저장 본문 재조회를 마친 경우만 게시 완료로 처리하고, 도구 미노출과 인증 실패를 구분합니다.
