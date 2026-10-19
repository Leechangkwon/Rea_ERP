# 개발과 검증 배포

## 현재 배포 기준 — 사용자 재확인 (2026-10-19)

사용자가 현재 구성을 **로컬·Supabase·Cloudflare**로 재확인했다. 이 지시가 아래 과거 Sites/D1 배포 기록보다 우선한다. 로컬 개발·검증은 `/home/lck/projects/Rea_ERP`에서 계속하며, Supabase 연결과 Cloudflare 공개 경로는 기존 설정을 확인한 뒤 이 기준으로 준비한다. Sites 업로드·새 버전 저장·배포를 실행하지 않는다.

기존 D1 호환 API를 보존하는 Supabase 어댑터와 독립 로컬 실행기를 추가했다. `npm run dev:api`와 `npm run serve:local`은 같은 실행기를 사용하며 기본은 기존 로컬 SQLite다. 기존 `rea` Supabase 프로젝트의 REA 전용 테이블·RLS·서버 권한은 읽기 전용으로 확인했다. 사용자의 재지시에 따라 REA 전용 서버 키 `rea_erp_server`를 생성해 사용자 전용 설정(600)에 저장하고 기존 default 서버 비밀키를 폐기했다. 폐기 후에도 새 키로 두 테이블의 실제 읽기 전용 연결 검사가 통과했으며 공개용 default 키는 유지했다. 사용자가 Cloudflare 도메인 `rea.qaredi.com` 유지를 확정했고 전용 `rea-erp-local` Tunnel과 수동 실행·사전 검사 구성을 준비했다. 사용자가 기존 계정·자료를 보존하는 운영 전환을 명시적으로 요청해 원본 SQLite와 설정을 백업하고 비밀번호 해시·회사·설정·수정 번호를 검증하여 Supabase로 이관했다. 0.43.0 커밋 `d0a26ff`를 원격에 올린 뒤 로컬 서버를 Supabase로 재시작하고 `rea.qaredi.com`을 전용 Tunnel에 연결했다. 외부 HTTPS의 0.43.0 로그인 화면과 로그인 전 업무 접근 차단을 확인했으며 기존 계정의 실제 로그인·메인 화면 진입·새로고침 후 인증 유지, Supabase의 로그인 성공 기록·유효 세션 저장과 계정·회사 설정 보존까지 확인했다. 운영 근거는 `evidence/deployment-local-supabase-cloudflare-20261019.json`이다. `.openai/hosting.json`과 `rea.qaredi.com`의 과거 기록만으로 현재 대상을 확정하지 않는다. 상세 상태와 검증은 `docs/plan-local-supabase-cloudflare-20261019.md`를 따른다. 기존 앱 로그인·업무자료·운영 설정과 브라우저/서버 자료 분리를 보존하며 자동 이관하지 않는다.

## 현재 진행 순서

1. 기존 로컬 소스·계정·업무자료와 설정을 보존하고 필요한 백업·복원 방법을 확인한다.
2. 기존 Supabase 프로젝트 연결과 Cloudflare 도메인·배포/접속 방식을 읽기 전용으로 확인한다. 현재 자료만으로 Pages/Workers 또는 로컬 서버 Tunnel 중 하나를 임의 선택하지 않는다.
3. 현재 D1 호환 API·로컬 SQLite·브라우저 저장소와 Supabase의 자료/인증 경계를 정하고, 필요한 어댑터·이관·동시 수정·권한·복구를 로컬에서 검증한다. 기존 자체 인증을 Supabase Auth로 임의 교체하지 않는다.
4. 배포할 버전과 커밋을 확정하고 `npm test`, `node scripts/check-release.cjs`, `npm run build` 및 관련 브라우저 검사를 실행한다. 분석 원문·관찰 자료·로컬 DB·인증정보는 공개 산출물에 포함하지 않는다.
5. 대상과 연결 방식이 확인된 Cloudflare 구성으로 반영하고, 실제 주소에서 로그인·권한·주요 업무·새로고침 후 저장을 검증한다. 배포 성공과 실제 업무 검증을 구분한다.
6. 변경·버전·커밋·접속 주소·자료 복원 방법·남은 제한을 현재 인계에 기록한다.

## 로컬 설정과 실행

```bash
# 기존 Windows 수동 실행기도 같은 dev:api 명령을 사용한다.
npm run build
npm run dev:api

# 별도 터미널에서 서버 비밀키 숨김 입력 + 읽기 전용 확인 후 저장
npm run configure:supabase
npm run connection:check
```

서버 키는 기본 `/home/lck/.config/rea-erp/runtime.env`(권한 600)에 저장한다. `REA_ENV_FILE`로 별도 사용자 전용 파일을 지정할 수 있다. 키를 소스·채팅·배포 예제에 넣지 않는다. 키 구성은 현재 백엔드 선택을 유지한다. 이관·최초 관리자 검증 후 `REA_STORAGE=supabase`를 명시한 다음 서버를 수동 재시작해야 Supabase를 사용한다. 기본 SQLite 파일과 계정은 그대로 남으며 자동으로 Supabase에 복사하지 않는다. 다른 백엔드의 최초 관리자가 없다면 직접 `http://127.0.0.1:8781`에서 등록한다. 공개 경로에서는 최초 등록과 Sites 소유자 헤더를 허용하지 않는다.

REA 전용 Cloudflare 주소가 확인되면 같은 비밀 설정 파일에 `REA_PUBLIC_ORIGIN=https://확인된-도메인`을 지정한다. 로컬 서버는 계속 127.0.0.1에만 바인딩하며, 공개 Host·HTTPS 전달 정보가 일치하는 요청만 수용한다. `deploy/cloudflared.example.yml`은 전용 Tunnel 설정 예제다. 기존 qaredi.com/다른 앱의 설정을 덮어쓰지 않는다. 직접 Worker 배포를 선택한 경우에만 `deploy/wrangler.example.jsonc`를 사용하며 서버 키는 Cloudflare secrets로 설정한다. 실제 계정·도메인·라우트는 예제에 가정하지 않는다.

연결 보완 결과는 [현재 구현 계획](plan-local-supabase-cloudflare-20261019.md)에 기록한다. 실제 비밀키와 Cloudflare 대상이 확인되기 전에는 REST 저장·외부 접속·배포 완료로 기록하지 않는다. 후속 운영 전환 요청으로 Supabase 이관과 REA 전용 DNS 전환을 실행했다. 현재 상태·복구와 수동 실행은 [0.43.0 운영 전환](deployment-0.43.0.md)을 따른다.

---

# 과거 Sites 배포 기록 — 현재 실행 절차 아님

아래는 이전 방식의 이력 보존용이다. 사용자 재확인 이후의 배포 지시로 사용하지 않는다.

## 기준

관리 페이지: https://chatgpt.com/space/page_61170ef3893c81919dd7d59c77385674

검증 사이트: https://rea.qaredi.com

사용자 요청으로 Sites 외부 접근은 public입니다. ERP 자체 로그인·회사별 권한은 유지하며, 다음 배포에서도 현재 audience를 보존합니다. 업무 화면의 브라우저 자료와 D1 API 자료는 별도 영역입니다.

## 반복 절차

1. 관리 페이지에 필요한 기능, 사용 예, 합격 조건을 기록합니다.
2. 현재 사용하는 코드에 변경을 적용합니다. 저장 구조 변경은 이전 백업 호환과 복원을 함께 검증합니다.
3. `package.json`, 잠금 파일, 화면의 버전 표시를 함께 갱신합니다.
4. `npm test`와 `node scripts/check-release.cjs`를 실행하고 `npm run build`로 Worker를 만듭니다. 관련 사용자 흐름은 실제 브라우저에서 따로 확인합니다. 스키마 변경은 `npm run db:generate`의 SQL과 메타데이터를 검토합니다.
5. Sites 스킬의 `site-workflow.mjs`로 이 독립 폴더의 소스를 커밋·업로드하고 `.artifacts/`에 패키지를 만듭니다. 도구가 반환한 정확한 커밋과 패키지를 사용합니다.
6. 기존 사이트 ID의 현재 audience를 `get_site`로 확인합니다. public에는 `save_site_version` 후 `deploy_site_version`을 실행하고 성공 여부를 확인합니다. 접근 범위를 바꾸지 않습니다.
7. 호스팅 주소에서 버전 표시·주요 기능·새로고침 후 보관을 확인합니다. 비공개 로그인 화면만 확인했다면 실제 기능 검증으로 기록하지 않습니다.
8. 관리 페이지에 버전, 커밋, 배포 결과, URL, 검사 결과와 알려진 제한을 갱신합니다.

자격 증명은 Sites 도구에서 받아 지원되는 도우미의 숨겨진 표준 입력으로만 전달합니다. 소스나 증빙에 보관하지 않습니다. Windows에서는 패키지 도우미가 Git Bash를 사용하도록 해당 실행의 PATH를 설정하고 `TAR_OPTIONS=--force-local`로 드라이브 경로를 처리합니다.

## 검사 근거

- 메뉴 핵심: `tests/menu-core.cjs` 10개
- 재고 핵심: `tests/inventory-core.cjs` 31개
- 재고 화면: `tests/inventory-dom.cjs` 7개. 230개 경로의 렌더링 검사 포함
- 옵션 핵심: `tests/form-core.cjs` 18개
- 옵션 화면: `tests/form-dom.cjs` 14개
- API 서버: `tests/api-gateway.cjs` 26개. 로컬 SQLite를 사용하는 D1 인터페이스 검증
- API 화면: `tests/api-dom.cjs` 8개. 같은 서버 모델을 사용하는 jsdom 검증
- API 매뉴얼: `tests/api-manual.cjs` 8개. 실제 26개 경로 대조·고립된 전체 API 호출·20종 전표·28개 대조와 역참조·59개 설명서 화면·검색·비실행·Worker 라우팅 검증.
- 로그인·안내: `tests/auth.cjs` 9개. 인증 식별자·안전한 반환 경로·SSR 계정 분리·캐시 차단·로그인/로그아웃 링크·버튼 대비 검사. 실제 계정 로그인은 호스팅 브라우저에서 별도 확인.
- 패키지 검사: `scripts/check-release.cjs`. 버전, 정적 자원, JavaScript 파싱과 알려진 원본 세션 문자열을 확인하고 `evidence/release-validation.json`에 해시를 남깁니다. 비밀정보 검사의 완전성을 보증하는 검사는 아닙니다.

자동 검사는 전체 기능의 원본 동등성이나 실 ERP 연결을 입증하지 않습니다. 새 배포의 브라우저 검증 결과는 배포 후 관리 페이지에 별도로 기록합니다.

## 실패와 복구

- 빌드·게시 실패 시 배포 상태와 오류를 관리 페이지에 기록합니다. 저장된 버전이 있으면 같은 버전을 이어서 게시하며 중복 저장하지 않습니다.
- 기존 정상 배포가 있을 때 그 버전을 재배포합니다. 첫 배포에는 이전 정상 버전이 없습니다.
- 앱 파일을 되돌려도 브라우저 자료는 자동 복구되지 않습니다. 구조 변경 전에 JSON 백업을 받고, 버전별 복원 지원 여부를 확인합니다.

## 다음 기능

1. 조건양식의 AND/OR와 예외 우선순위, 충돌 설명.
2. 양식 스키마 버전, 기존 백업 변환, 잘못된 설정 차단과 복구.
3. 사용자 역할과 양식 적용 범위.
4. 서버 저장과 여러 사용자 동시 수정 정책.
5. 공개 전 접근 통제·복구·운영 점검.
