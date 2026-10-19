# 로컬·Supabase·Cloudflare 연결 보완

사용자 요청: 기존 로컬·Supabase·Cloudflare 구성으로 빠진 연결을 보완한다. 실제 소스는 `/home/lck/projects/Rea_ERP`이며 기존 구매 수정과 미커밋 환경 변경을 보존한다. 이번 작업은 현재 채팅이 담당한다.

## 확인한 연결과 경계

- Supabase `rea` 연결의 기존 프로젝트 `bzyvdergqijwswnjvozs`는 ACTIVE_HEALTHY다. 기존 `public.rea_app_state`, `public.rea_gateway_state`가 존재하며 둘 다 RLS가 켜져 있다. 열은 `id text`, `revision integer`, `body text`, `updated_at text`다. 공개 역할 권한 없이 service_role만 SELECT/INSERT/UPDATE를 가진다. 이번에는 메타데이터만 읽고 원격 자료를 변경하지 않았다.
- 서버 API는 D1의 prepare/bind 인터페이스이며 로컬 미리보기는 SQLite다. 같은 상태·revision 검증을 유지하는 제한된 Supabase REST 어댑터를 연결한다. Supabase 장애 시 다른 DB로 조용히 전환하지 않는다.
- 기존 자체 ERP 로그인·쿠키·CSRF·권한을 유지한다. 독립 실행에서는 Sites 소유자 헤더를 신뢰하지 않으며 최초 관리자 등록은 직접 로컬 접속에서만 허용한다.
- Windows의 기존 qaredi.com Tunnel은 다른 앱의 localhost:3000에 연결된다. REA 전용 Cloudflare 주소와 Tunnel/Worker는 미확인이다. 사용자에게 확인을 요청했고 기존 Tunnel·DNS·Sites를 변경하지 않는다.
- 사용할 서버 비밀키는 현재 프로세스/프로젝트에 없다. 키는 채팅/소스/명령행에 넣지 않고 별도 사용자 전용 설정의 숨김 입력으로 구성한다. 실제 비밀키가 없으면 실제 REST 저장 검증은 미확인으로 남긴다.
- 브라우저 업무자료와 서버 API 자료는 기존 분리를 보존하며 자동 이관하지 않는다. 계정이나 업무자료의 자동 복사도 하지 않는다.

## 구현과 검증

1. 기존 테이블로만 접근하는 Supabase 어댑터: 초기 행 충돌 무시, revision 조건 갱신, 오류/비밀값 비노출, TLS·키 종류 검증, 타임아웃, 읽기 전용 연결 확인.
2. 독립 로컬 HTTP 실행기: SQLite/Supabase 명시적 선택, 루프백 바인딩, Host·Origin·헤더 경계, 로컬 관리자 등록, Cloudflare의 확인된 공개 origin만 수용, 수동 시작/종료.
3. 비밀키 숨김 구성과 읽기 전용 상태 검사, Cloudflare 연결 예제. 기본 개발은 기존 SQLite를 유지한다.
4. 합성 HTTP/저장소 회귀 검사로 인증·동시 수정·장애·잘못된 설정·정적 응답의 비밀값 노출을 확인하고 기존 전체 검사·빌드·브라우저 검사를 실행한다.

배포나 원격 스키마 변경은 이 계획만으로 실행하지 않는다. 실제 연결·배포 상태와 합성 검사를 분리해 결과를 기록한다.

## 이번 구현 결과

- `worker/supabase-db.cjs`를 Worker에 포함하고 기존 두 상태 테이블의 SQL 사용만 Supabase의 두 REA 테이블에 매핑했다. 초기 행은 기존 값을 덮어쓰지 않으며 PATCH의 id/revision 조건으로 동시 갱신을 검사한다. PostgREST의 본문 없는 201 INSERT 응답도 처리한다. 오류·비정상 응답에 키나 업무 본문을 노출하지 않으며 다른 DB로 자동 전환하지 않는다.
- `scripts/standalone-server.cjs`와 기존 `dev:api`를 연결했다. 기본 로컬 SQLite·포트·수동 Windows 실행기는 유지하고 사용자 전용 설정으로 Supabase를 선택한다. 루프백 외 바인딩은 없으며 확인된 공개 origin만 허용한다. 최초 계정 등록은 직접 로컬 접속에만 허용하고 공개 경로의 위조 Sites 헤더는 무시한다.
- `npm run configure:supabase`는 터미널 숨김 입력과 읽기 전용 확인 후 `~/.config/rea-erp/runtime.env`(600)에 설정을 저장한다. `npm run connection:check`는 행 생성 없이 네 열의 접근을 확인한다. Windows 진입점에 `Configure-Rea-Supabase.cmd`도 추가했다. 기본 SQLite와 Supabase 사이의 자동 자료·계정 이관은 없다.
- 빌드/환경/릴리스 검사의 Sites 매니페스트 의존을 제거했다. 기존 원본 매니페스트는 과거 기록으로 보존하고 생성된 배포 매니페스트는 제거한다. 숨김 파일·분석 자료·비밀 설정을 정적 자원에 넣지 않는다.
- Cloudflare 설정 예제는 `deploy/cloudflared.example.yml`, `deploy/wrangler.example.jsonc`다. 실제 도메인·터널·계정은 지정하지 않았고 기존 qaredi.com Tunnel은 수정하지 않았다.

## 최종 검증과 남은 연결

`npm run verify:local` 전체 통과: 환경 검사, 도구 7개, 기존 전체 npm 검사(새 런타임 16개 포함), 릴리스 4개, Worker 빌드, 합성 브라우저 6개. 검사 중 13개 소스/패키지 해시가 유지됐고 최종 파일과 일치한다. Worker 1,806,400B·정적 자원 51개. 새 독립 실행기를 실제 `npm run dev:api` 프로세스로 수동 시작해 고립 SQLite의 HTTP 200·로컬 최초 등록 허용을 확인하고 종료했다. 기존 로컬 SQLite 해시는 보존됐다. 추가 구문 검사와 `git diff --check`도 통과했다.

Supabase의 열·기본키·고정 id·본문 크기·수정 번호 제약 및 역할 권한을 원격 메타데이터로 확인했다. 보안 Advisor의 두 INFO는 서버 전용 테이블의 RLS 정책 부재이며 공개 역할 권한이 차단된 현재 설계를 유지한다. 정책을 열거나 원격 스키마를 변경하지 않았다. [공식 Advisor 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

서버 비밀키 설정과 REA 전용 Cloudflare 도메인/Tunnel 또는 Worker 확인이 남았다. 사용자에게 두 정보를 요청했으며 실제 REST 읽기/저장, 운영 계정 로그인·업무, 외부 접속·배포는 완료로 기록하지 않는다. 실행 근거는 [연결 검증](../evidence/runtime-connection-20261019.json), 전체 로그와 해시는 `.artifacts/runtime-connection-20261019/validation-final.json`에 있다. 이번에는 버전 변경·커밋·원격 업로드·배포를 하지 않았다.

## 사용자 회신 후 준비 — 2026-10-19

사용자는 도메인을 `rea.qaredi.com`으로 유지하고 저장한 서버 비밀키 파일은 없다고 답했다. 로그인된 Supabase 관리 화면에 기존 default 서버 비밀키가 있는 것을 마스킹된 화면으로 확인했다. 새 Supabase 키는 발급하지 않았다. 브라우저의 인증정보 저장 확인 규칙에 따라 기존 키를 로컬 REA 설정에 저장하고 읽기 전용 연결 검사에 사용하는 확인을 요청했다. 승인 전에는 키를 표시·복사·저장하지 않는다.

- 실제 DNS: `rea.qaredi.com CNAME custom-domains.chatgpt.site.`. 인증 없는 HTTPS는 Cloudflare의 403 응답이며 실제 업무 검증은 아니다. 전환 전 상태를 보존한다.
- 로컬 설정 `/home/lck/.config/rea-erp/runtime.env`(600)에 `REA_PUBLIC_ORIGIN=https://rea.qaredi.com`과 현재 SQLite 백엔드를 기록했다. 기존 서버와 로컬 계정 1개를 유지한다. Windows에서 WSL의 기존 `/api/auth/status` HTTP 200·초기화 상태를 확인했으며 계정명·비밀번호·업무 본문은 수집하지 않았다.
- 새 전용 Tunnel `rea-erp-local` / `1efb377f-79bd-4600-9a93-c0ec2a7b0959`를 준비했다. Windows `~/.cloudflared/rea-erp-local.yml`은 해당 도메인만 localhost:8781로 보내며 ingress 검증을 통과했다. 자격 파일은 현재 Windows 사용자만 접근하도록 ACL을 제한했다. 다른 앱의 Tunnel은 변경하지 않았다.
- 첫 미사용 Tunnel은 CLI 생성 JSON에 인증값이 포함되어 즉시 폐기하고 로컬 자격 파일을 제거했다. 새 Tunnel 생성 응답은 메모리에서 자격 값을 제외한 메타데이터만 출력했다. 폐기된 인증값을 문서·소스·산출물에 복사하지 않는다.
- 새 `npm run cloudflare:check`는 Supabase 설정·REA 공개 origin·원격 관리자·실행 중인 서버의 백엔드/프로젝트 일치를 읽기 전용으로 검사한다. 로컬 전용 `/__rea/health`는 공개 경로에서 404로 차단한다. 현재 SQLite 상태에서는 터널 시작 검사가 실패하도록 확인했다. 수동 `Start-Rea-Cloudflare.cmd`도 이 검사를 먼저 수행한다.
- 관련 런타임 검사 17개·빌드와 `git diff --check` 통과. 직전 전체 통합 검사·브라우저 6개 기록과 이번 관련 검사 결과를 구분한다. DNS 전환·터널 시작·Supabase 키 저장·실제 REST 저장은 아직 하지 않았다.

남은 순서: 기존 서버 키의 로컬 저장 확인 → 실제 읽기 전용 Supabase 연결 검사 → 기존 로컬 계정/설정과 새 서버 저장소의 명시적 이관·최초 관리자 절차 확정 → Supabase 백엔드로 수동 서버 시작과 업무 검증 → 기존 DNS 속성·복구 경로 확인 후 동일 도메인 전환 → 외부 로그인·업무 검증. 로컬 업무자료나 계정을 자동으로 올리지 않는다.

## 키 저장 승인 후 상태 — 2026-10-19

사용자가 기존 default 서버 키의 로컬 저장과 읽기 전용 연결 검사를 허용했다. 화면에서 읽은 키를 사용자 전용 설정(600)에 저장한 뒤, 파일의 SQLite 선택을 유지한 채 프로세스 내부에서만 Supabase를 지정하여 두 기존 테이블의 실제 GET probe를 실행했고 통과했다. 원격 행 생성·계정 등록·업무 저장·스키마 변경은 하지 않았다.

키를 읽는 동안 UI 문자열의 가림 처리가 불완전하여 키 일부 문자가 도구 출력에 남았다. 이 키를 운영에 사용하지 않도록 설정 파일의 키 항목을 제거하고 화면과 클립보드를 정리했다. 키 값이나 조각을 이 문서·근거·소스에 복사하지 않는다. 기존 default 키의 폐기와 새 서버 키가 필요하다. 새 키 이름 `rea_erp_server`와 설명만 생성 대화상자에 준비했고 생성 버튼은 누르지 않았다. 브라우저 도구의 인증정보 교체 사용자 인계 규칙에 따라 최종 생성·교체는 사용자에게 인계한다.

숨김 입력 도구도 키 저장 시 현재 백엔드를 유지하도록 수정했다. 새 키를 입력해도 기존 SQLite가 자동으로 Supabase로 바뀌지 않는다. 관련 런타임 18개가 통과했다. 기존 로컬 서버·계정·업무자료와 DNS는 보존했다. 현재 기준 근거는 [실제 읽기 검사와 키 교체 필요 상태](../evidence/supabase-readonly-20261019.json)다. 새 키 입력·기존 default 키 폐기 후 연결 검사부터 이어간다.

## 현재 상태 — 서버 키 교체 완료 (2026-10-19)

사용자가 직접 진행하라고 재지시했다. 자동 생성 서버 키 교체까지 사용자 직접 조작이 필요하다고 넓게 해석했던 이전 인계를 정정하고, 현재 채팅에서 `rea_erp_server` 키를 생성했다. 값은 출력하지 않고 `/home/lck/.config/rea-erp/runtime.env`에 원자적으로 저장했으며 파일 권한 600을 확인했다. 새 키로 두 기존 테이블의 실제 읽기 전용 GET probe를 통과한 뒤 기존 default 서버 비밀키를 폐기했다. 관리 화면에서 기존 서버 키가 사라지고 새 키만 남은 것을 확인했으며 공개용 default 키는 유지했다. 기존 키 폐기 후 새 키의 GET probe도 다시 통과했다.

이전 키 가림 처리 문제는 기존 키 폐기로 조치했다. 새 키 값이나 조각은 도구 출력·문서·소스에 기록하지 않았다. 최종 화면은 키를 가린 상태로 `.artifacts/runtime-connection-20261019/supabase-key-rotation-complete.png`에 저장했다. 현재 근거는 [서버 키 교체와 실제 읽기 검사](../evidence/supabase-readonly-20261019.json)다.

로컬 SQLite 선택과 실행 중인 서버·계정·업무자료를 유지했다. Supabase 행 생성·계정/업무자료 이관·실제 저장, DNS 전환·터널 시작은 아직 수행하지 않았다. 다음 운영 전환에는 기존 자료의 명시적인 이관 절차 또는 최초 관리자 설정이 필요하다. 키 교체 때문에 같은 승인을 다시 요청하지 않는다.

## 운영 전환 승인과 현재 계획 — 2026-10-19

사용자가 기존 계정과 자료를 보존하는 운영 서버 전환, `rea.qaredi.com` 연결과 실제 로그인을 명시적으로 요청했다. 이 요청은 앞선 자동 이관 금지와 구분하는 이번 명시적 이관 근거다. 계정·비밀번호 해시·설정·업무 상태를 사용자 전용 백업 뒤 비어 있는 같은 Supabase 저장소로 옮기며 기존 원본을 유지한다. 절차와 복구는 [0.43.0 운영 전환](deployment-0.43.0.md)에 있다. 원격 상태가 다르면 덮어쓰지 않는다. 전체 `verify:local`은 새 이관 4개·런타임 18개·합성 브라우저 6개를 포함해 통과했다. 다음으로 이관과 서버·DNS 전환, 실제 로그인 확인을 진행한다.
