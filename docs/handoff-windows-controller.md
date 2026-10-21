# Windows 주도 개발 인계 — 2026-10-19

## 현재 인계 · 0.64.0 운영

운영 `release/0.64.0-purchase-return-state` / `a04eb5c`, 소스 `a578ba3`/fixture `422b83b`. 차감반품 확인·미확인/혼합선택과 반영 후 음수 읽기 전용 상세를 연결했다. 기존 배분금액/수불/채무/원구매/양식 보존, 교환·회계 권한 확대 없음. 신규Node12/관련44·전체 verify:local/브라우저63, 독립P2 수정·동일 재현 해소. 운영 반품0건으로 저장/상태/반영 후 상세 합격은 합성 검증이다.

근거 `evidence/manual-purchase-return-state-20261022.json`, manifest `.artifacts/manual-return-state-20261022/candidate-manifest.json`, worktree `.artifacts/releases/0.64.0-purchase-return-state`. 런타임 세션7859, bundle SHA `24f4bc33bf21e52f959ee05069b97d769a590104e779215807ca5906f78f7e25`, 롤백0.63.0 보존. 기존로그인·상태 창 열기/닫기, 브라우저8전표/양식 byte/JSON·서버fresh app30/gateway0·runtime.env·메일3함8통1첨부 전후 동일. 운영 업무/설정/인쇄/발송/복원 없음. main VAT5 미완료 빌드 설치 금지.

부서·직위/직급·직책 조건은 사용자등록 저장/등록 참조 계약 확장이 선행되어야 하므로 보류한다. 다음은 구매현황의 실제 작업 탭 조건/결과 보존을 원본·매뉴얼·portal 연결과 대조한다. 전체수량/상이단가 불러오기, 직접 음수 구매/혼합부호·환불, 실제 반품 상태변경·회계/일괄인쇄·이력도 미완료다. 이미 반영한 차감반품 확인 연결을 반복 개발하지 않는다. 본문13/요구사항24·전체합격0, 모아 마지막 게시0.51.0·43갱신 대기. 아래는 과거 이력이다.

## 이전 인계 · 0.63.0 운영

운영 `release/0.63.0-role-conditional-forms` / `279f4ef`, 소스 `fd26896`. 기존 인증 roleId와 등록그룹 참조를 조건양식의 단일 같음에 연결했다. 기존 flat/v1·ID/PC-MOBILE/3AND·전표/양식/활성값 보존. 신규Node16/관련35·전체 verify:local/브라우저62, 독립9비동기 경계 재현 통과. 새API/권한/계정필드 없음. 로컬 실제인증2계정과 합성 UI 적용/저장/재조회 확인, 운영 두사용자/설정저장 합격은 미완료.

근거 `evidence/manual-role-forms-20261022.json`, 계획 `docs/plan-conditional-forms-20261022.md` 마지막 단일권한그룹 단계, manifest `.artifacts/manual-role-forms-20261022/candidate-manifest.json`, worktree `.artifacts/releases/0.63.0-role-conditional-forms`. 런타임 `rea-erp-dev run` 세션37156, bundle SHA `05360a5dcb7da5267fb6d45dce557a7159f812c1735f9021044a4f2f2e0aa3aa`, 롤백0.62.0 보존. 기존로그인·일반구매44,000 미리보기·사용자양식0 안내 확인.8전표/양식·서버fresh app30/gateway0·메일3함8통1첨부 전후 동일. 운영 업무/설정/인쇄/발송/복원 없음. main VAT5 미완료 빌드 설치 금지.

다음은 부서/직위·직급/직책의 실제 사용자 저장 및 등록 참조·flow 비교계약 확인 후 검증된 속성만 확장한다. 보유 원본 flow function 경로가 없어 비교 엔진은 미검증. 단일 권한그룹 외 다중값/전체flow/일괄인쇄 첫전표도 미완료. 미확인 구조를 추정하지 말고 반품 confirmation/회계반영 조회·전체수량/상이단가/작업탭 독립차이표로 이어갈 수 있다. 본문13/요구사항24·전체합격0, 모아 마지막 게시0.51.0·인증 변화없음/42갱신 대기. 기존4품목 공란구매처를 임의 지정하지 않는다. 아래는 과거 이력이다.

## 이전 인계 · 0.62.0 운영

운영 `release/0.62.0-purchasing-supplier-layout` / `1dda446`, 소스 `f02093b`. 사용자 신고 우선: 등록 구매처 필수/모달 선택·신규 등록, 품목→요청→계획→발주서 기본 거래처 연결·수동값 보존 및5조회 공통 반응형. 신규Node11/브라우저8, 전체 verify:local/브라우저61·26개 화면/폭 조합 통과. 독립 경계 재현 후 남은P1/P2없음. 기존 로그인 유지·품목/구매처/신규 모달 열기/취소·요청조회 배치 확인, 운영 업무/설정 저장·발송 없음.

근거 `evidence/purchasing-supplier-layout-20261022.json`, 계획 `docs/plan-purchasing-supplier-layout-20261022.md`, manifest `.artifacts/purchasing-supplier-layout-20261022/candidate-manifest.json`, worktree `.artifacts/releases/0.62.0-purchasing-supplier-layout`. 실행 `rea-erp-dev run` 세션95720 유지. bundle SHA `9c52d684beac219a5ad3d77033cc945031fd30668bb043ad7c6eedda9c368fc5`, 롤백0.61.0 보존.8전표/양식·서버fresh app30/gateway0·메일3함8통1첨부 전후 동일. 기존4품목 구매처 공란은 보존했으며 품목등록에서 한 번 지정해야 자동 상속된다. main VAT5충돌 빌드 설치 금지.

본문13/요구사항24·전체합격0. 다음은 원래 큐(조건양식 권한그룹/부서/직위·직급/직책·flow editor 계약, 반품 confirmation/회계반영 조회·전체수량/상이단가/작업탭)로 복귀한다. 원본 품목 공개 자산의 최신 해시가 과거와 달라 새 동등성 근거로 사용하지 않았다. 모아 마지막 게시0.51.0·인증401,41갱신 로컬 대기. 새 인증 없는 반복 오류 조회 금지. 아래는 과거 이력이다.

## 이전 인계 · 0.61.0 운영

운영 `release/0.61.0-conditional-forms` / `c56d15b`, 소스 `d65e9eb`. 기존 flat/store v1 보존·새 conditionVersion1 ID(loginId)/PC-MOBILE/최대3AND 조건 저장→재조회→입력/조회/인쇄. 신규Node17/관련56·전체 verify:local/브라우저53 통과. 독립5경계 수정·동일 재현 차단 확인. 기존 로그인·일반 구매44,000원 미리보기·빈 사용자양식 안내를 확인, 운영 설정/업무 저장 없음.

근거 `evidence/manual-conditional-forms-20261022.json`, 계획 `docs/plan-conditional-forms-20261022.md`, manifest `.artifacts/manual-conditional-forms-20261022/candidate-manifest.json`, worktree `.artifacts/releases/0.61.0-conditional-forms`. 실행 `rea-erp-dev run` 세션87597 유지. bundle SHA `4b4a8f12308335445964b3776cf2ce3ed4be5ff7b99512719c55a05c4d8293a7`, 롤백0.60.0 보존.8전표/양식·서버fresh app30/gateway0·메일3함8통1첨부 전후 동일. main VAT5충돌 빌드 설치 금지.

본문13/요구사항24·전체합격0. 다음은 구매 현대식 조건의 권한그룹/부서/직위·직급/직책과 flow editor의 실제 참조/평가/저장 계약 대조, 검증된 사용자 속성만 확장. 일괄 첫 전표·실제 두 사용자·운영 설정 저장은 미완료. 반품 confirmation/회계반영 조회·전체수량/상이단가/작업탭도 남아 있다. 모아 마지막 게시0.51.0·인증401,40갱신 로컬 대기. 새 인증 없는 반복 오류 조회 금지. 아래는 과거 이력이다.

## 이전 인계 · 0.60.0 운영

운영 `release/0.60.0-purchase-return-print` / `2fb85fe`, 소스 `fc42683`. 구매조회 차감반품 선택 → 기존 전용 반품/공동 구매 양식 → 고정금액 음수 미리보기 → 닫기/재조회 보존. 신규Node7/관련35, 전체 verify:local·브라우저51 통과. 기존 로그인·운영 일반 구매 미리보기/닫기,8전표/양식·서버app28/gateway0·메일3함8통1첨부 전후 동일. 운영 반품0건으로 음수 출력은 합성 검증, 실제 프린터/업무 저장 없음.

근거 `evidence/manual-purchase-return-print-20261022.json`, 계획 `docs/plan-purchase-return-print-20261022.md`, manifest `.artifacts/manual-return-print-20261022/candidate-manifest.json`, worktree `.artifacts/releases/0.60.0-purchase-return-print`. 실행 `rea-erp-dev run` 세션21603 유지. bundle SHA `f50e3b6a1887d8f435bfe4bfb31916b3c7db42ebc8cf6513d9f83a5ef3f1161d`, 롤백0.59.1 보존. main VAT5충돌 빌드 설치 금지.

본문13/요구사항24·전체완료0. 다음은 원본 구매별 조건항목 확인 후 REQ-COM-FORMS-001 ID/3AND/PC-Mobile 조건양식 저장→재조회→적용(기존 단일조건/양식 보존). 일괄인쇄 첫 전표 조건·반품 confirmation/회계반영 조회/직접 음수 구매 예외는 미완료. 모아 마지막 게시0.51.0·인증401,39갱신 로컬 대기. 새 인증 없이 변화 없는 인증검사 반복 금지. 아래는 과거 이력이다.

## 이전 인계 · 0.59.1 운영

운영 `release/0.59.1-purchase-negative-return` / `fc52ded`, 소스 `dfba9ee`/표시수정 `bb16902`. 원구매 → 반품처리 → 음수 수량 편집 → 단일 canonical purchasereturn/credit 저장 → 구매조회/현황 음수 재열기. 기존 양식/자료 변환 없음. 신규Node18·관련62, 0.59.0 전체 verify:local/브라우저50 및 0.59.1 표시수정 Node18·브라우저1·release/build 통과. 계정 전환 전 열기 P1 독립 재현·수정·재검증 완료. 운영 미리보기/취소와 기존 로그인·자료·양식·메일 보존 확인, 실제 업무 저장 미검증.

근거 `evidence/manual-purchase-negative-return-20261022.json`, 계획 `docs/plan-purchase-negative-return-20261022.md`, manifest `.artifacts/manual-negative-purchase-20261022/candidate-manifest.json`. worktree 디렉터리는 `.artifacts/releases/0.59.0-purchase-negative-return`, 최종 branch/commit은 위 0.59.1이다. 다음은 직접 음수 구매/환불·반품 추가항목/가격·confirmation/출력과 원본 예외 규칙 대조. 전체적용/상이단가 합산/작업 탭 초기화는 미확인 유지. main VAT5충돌 연구 빌드 설치 금지. 모아38갱신 대기·전체완료0. 아래는 시점별 이력이다.

## 2026-10-21 · 운영 0.53.7 최초 확정의 요청단가 기본 선택

공식 EC-VID-13917 03:34에서 요청단가 기본선택과 저장(F8)을 확인했다. 확정값이 전혀 없는 ready 비교자료에서 확정단가선택/수정 시 요청단가를 미저장 기본값으로 표시한다. 기존 부분 확정자료의 선택/미선택 상태는 보존한다. 단순 진입·닫기·Escape·새로고침·화면이동은 저장하지 않으며 명시 저장 때만 반영한다. 기존 부분선택 보존은 자체 정책이며 원본 다중행 동등성은 미확인이다.

집중102개(신규3), 분리후보 전체 verify:local 및 합성 브라우저44개(신규1)가 통과했다. 최초 기본값/0원·정밀단가/수동 거래처 선택/취소/저장·재조회/권한·계정·원본·revision·용량오류 보존을 검증했다. 기존 기본값 없음 브라우저 기대값1건을 수정한 뒤 전체 재검사를 통과했다. 데스크톱/390px 화면을 확인했고 REA6.4.0 자체2범위 파싱실패0·coverage unknown·truncated false 및 원본 라우팅 캐시 해시를 검증했다. 원본 서버 동등성 근거로 확대하지 않는다.

소스fae7a84, 운영a613d8c 기반 분리후보b2b73d2를 push 후 기존 WSL·Supabase·Cloudflare에 반영했다. 공개0.53.7/자산해시·익명메일401·내부health404·Supabase200과 기존 로그인 유지/단가요청조회를 확인했다. 운영 비교자료0건이므로 실제 저장 합격은 남아 있다. 원본 ERP 저장/실업무 저장/메일 발송은 없다.

Supabase app28/gateway0 본문·수정번호, 비공개 설정, 브라우저8전표·양식 JSON, 메일3함8메시지1첨부가 배포 전후 동일하다. 백업검증/복원미리보기0충돌, 복원없음. 30일 세션 설정을 유지했고 재로그인을 요청하지 않았다. 운영 번들SHA 6950ca579242fe15220e3da2f9f1b5a5f39c3c452ef8c7a9f81c239c07631d52, manifest .artifacts/manual-price-default-20261021/candidate-manifest.json. 0.53.6 롤백과 모든 기존 후보/백업을 보존했다. main 미완료VAT 빌드 설치 금지.

다음은 헤더 일괄/부분 확정선택의 다중행 규칙과 발주서의 단가요청 피커를 관찰해 거래처·품목·단가·원본참조·유효기간 계약을 확정한다. 영상04:04의 발주서25,000 결과만으로 전체 절차를 완료 처리하지 않는다. 외부 회신/실제 운영 저장/전체 매뉴얼 완료는 미완료이며 VAT5충돌·전역완료0 유지. 모아는 마지막401 이후 새 인증이 없어 게시·재조회 대기이며 기존 문서용 추가본문을 로컬 보존했다. 인증 복구 시 기존 본문의 누락분만 추가하고 실제 저장 본문을 재조회한다.


## 2026-10-21 · 운영 0.53.6 신규 단가요청 다중 거래처

공식 영상 EC-VID-13917의00:54 거래처2개 토큰,02:04 요청조회1전표,02:24 같은 요청번호에 거래처2개 수신행을 관찰했다. 신규 입력에서1~5개 등록 거래처를 선택하고 명시 저장하면 요청1건과 비교snapshot을 한 명령으로 저장한다. 기존 전표는 자동 변환하지 않고 저장된 공급사와 기존 회신·단가·양식을 보존한다. 목록과 거래처 필터·CSV에서도 복수 거래처를 표시한다. 원본 ERP 입력/저장은 없다.

집중99개(신규10), 격리후보 전체 verify:local 및 합성 브라우저43개(신규1)를 통과했다. 신규→다중선택→저장→새로고침→0원 직접회신과 미회신 구분을 검증하고 데스크톱/390px 화면을 확인했다. 독립 검토에서 editor진입 전 계정전환과 복수거래처 조회 누락을 재현·수정하고 회귀검사를 추가했다. 권한/계정/raw 변경·늦은 피커 이벤트·저장실패 시 기존자료와 초안을 보존한다. 기존 불러오기 검사는 새 companion과 공급사 선택을 검증하도록 보완했다.

REA6.4.0 후보8범위 파싱실패0/coverage unknown/truncated false, 원본 라우팅 캐시 해시를 검증했다. 이는 원본 서버 동등성 완료가 아니다. 소스4a5c58f, 운영ce2e569 기반 격리후보a613d8c push 후 WSL·Supabase·Cloudflare에 반영했다. 공개0.53.6/자산해시/익명메일401/내부health404/Supabase200, 기존 로그인 유지와 신규화면·피커 열기/취소를 확인했다. 실제 운영 저장은 실행하지 않았다.

Supabase app28/gateway0 본문·수정번호, 비공개 설정, 브라우저8전표/양식, 메일3함8메시지1첨부가 배포 전후 동일하다. 백업검증·복원미리보기0충돌/복원없음. 기존30일 세션 설정 유지 및 재로그인 요청 없음. 번들SHA 05033a3548c1e68b75f1ab5d8a61d393a7945b22396f0cbca4cd504f593397b0, manifest .artifacts/manual-price-start-20261021/candidate-manifest.json. 0.53.5 롤백과 모든 이전백업 보존. main 미완료VAT 빌드 설치 금지.

다음은 확정단가 기본/헤더 일괄/부분선택과 발주서 적용 절차를 관찰하여 구현한다. 유효기간·기존 공급사 변경·외부 회신·실제 운영 저장 및 전체 매뉴얼 합격은 미완료다. VAT5충돌/전역완료0 유지. 모아는 마지막401 이후 새 인증이 없어 게시·재조회 대기이며 기존 문서용 추가본문을 로컬 보존했다. 인증 복구 시 기존 부모/PRD/아키텍처/로드맵의 누락분만 추가하고 저장 본문을 재조회한다.

## 2026-10-21 · 운영 0.53.5 수취단가 직접입력

공식 EC-VID-13917의03:10 거래처별 수취단가 직접입력,03:20 단가 입력/저장(F8)/닫기,03:30 회신25,000 반영을 확인했다. 캡처는 실제 파일을 다시 열어 확인했다. 원본 ERP 저장·행 입력은 하지 않았다. 이번 구현은 기존 ready 비교자료의 가격만 변경하며 원본 수량·요청가·전표·부가세·특별단가·확정선택·다른 거래처·양식을 보존한다.

replyMany 명령은 변경한1~500행을 원자적으로 검증하며 성공 시 수정번호/감사1회만 반영한다. 후반 행 오류·중복행·초과 정밀도·오래된 revision·마감·선택된 공급사 가격 변경을 차단한다. 미회신/0원/소수10자리 구분, 기존 회신을 빈칸으로 지우는 UI 차단, F8 명시 저장·닫기/Escape 무저장, 권한/계정/raw 원문/원본지문 재검사와 오류 시 초안 보존을 구현했다. 마감 후 직원 예외·헤더/수량/부가세 변경 효과는 미확인으로 유지한다.

집중83개(신규11), 독립 충돌검사5경로, 분리후보 전체 verify:local/합성 브라우저42개(신규1)를 통과했다. 데스크톱/390px 입력·저장·새로고침·닫기와500행 원자성을 확인했다. REA6.4.0 자체9범위 파싱실패0·coverage unknown·truncated false, 원본 라우팅 캐시 입력/결과 해시를 검증했다. 원본 서버 동등성 완료로 처리하지 않는다.

소스3939439와 운영c23ec8e 기반 분리후보ce2e569를 push 후 기존 WSL 서버에 반영했다. 공개0.53.5/자산6개 해시·익명메일401·내부health404·Supabase200, 기존 로그인 유지 및 단가요청조회를 확인했다. 운영 비교자료0건이므로 직접입력 저장은 합성검사 결과이며 실제 운영 저장 합격은 남아 있다. 사용자 재로그인은 요청하지 않았다.

Supabase app28/gateway0 본문·수정번호, 비공개 설정, 브라우저8전표/양식 JSON, 메일3함8메시지1첨부가 배포 전후 동일하다. 복원미리보기0충돌, 복원·업무저장·발송 없음. 기존30일 세션 설정 유지. 운영 번들 SHA49ead4bad3261696a7da21ffba682da226dffa0cbc7afc213884bd86fa6cc09b, manifest .artifacts/manual-price-reply-20261021/candidate-manifest.json, 근거 evidence/manual-price-request-direct-reply-20261021.json. 0.53.4 롤백과 이전 후보/백업 보존. main VAT 연구 빌드 설치 금지.

다음은 공급사 등록/token 피커와 거래처별 전표 생성 구조를 확인한 뒤 비교 시작 UI를 연결한다. 이후 기본/헤더 일괄/부분 확정선택, 발주서 적용·외부 회신을 진행한다. 기존 VAT 충돌5건과 전역 매뉴얼 완료0은 그대로다. 모아는 마지막 확인401 이후 새 인증이 없어 게시·재조회 대기이며 기록을 로컬에 보관했다. 인증 복구 시 기존 문서의 누락분만 추가하고 저장 본문을 재조회한다.

## 2026-10-21 · 운영 0.53.4 거래처별 입력마감/취소

공식 단가요청 영상 EC-VID-13917의 03:28 비교표와 03:30~03:36 자막에서 거래처별 입력마감/입력마감취소 및 마감 후 상대 거래처의 단가 변경 차단을 확인했다. 기존 ready 비교자료에 마감/취소를 연결하며 회신가·확정단가·다른 거래처·원본 전표·특별단가·양식을 보존한다. 확정선택 편집 중에는 마감 버튼을 숨기고, 클릭 시 권한/사용자/원문/원본지문/수정번호를 다시 검사한다. 제거된 버튼이나 닫힌 창의 이벤트는 무시한다.

관련 Node 72개(신규8), 독립 충돌검사3경로, 분리 후보 전체 verify:local 및 합성 브라우저41개(신규1)를 통과했다. 데스크톱/390px 화면과 저장→새로고침→마감취소 후 가격/선택/양식 보존을 확인했다. 자체 REA6.4.0 7범위 파싱실패0·coverage unknown·truncated false이며 원본 라우팅 캐시의 입력/결과 해시를 검증했다. 원본 서버 동등성 근거로 확대하지 않는다.

소스6e140aa와 운영8434b1c 기반 분리후보c23ec8e를 push 후 기존 WSL 서버에 반영했다. 공개0.53.4/변경 자산 해시·익명메일401·내부health404·Supabase200을 확인했고 기존 로그인으로 새로고침 및 단가요청조회를 확인했다. 운영 비교자료0건이므로 실제 마감 저장은 합성검사 범위다. 원본 ERP/운영 업무자료 저장과 메일 발송은 하지 않았다.

Supabase app28/gateway0 본문·수정번호, 비공개 설정, 브라우저8전표/양식 JSON, 메일3함8메시지1첨부가 배포 전후 동일하다. 백업 검증·복원미리보기0충돌이며 복원은 실행하지 않았다. 기존30일 로그인 정책을 유지했고 이번에는 환경변수를 변경하지 않았다.

운영 번들 SHA afa84209f75223aef31d95956aa0690e318f54dcc2afda5b151c6215ba8c00ba. manifest .artifacts/manual-price-close-20261021/candidate-manifest.json, 근거 evidence/manual-price-request-input-close-20261021.json. 0.53.3 롤백과 이전 후보/백업 보존. main에는 미완료 VAT 연구가 있으므로 main 빌드 설치 금지. 다음은 공급사 등록/시작과 수취단가 직접입력의 원본 필드·저장·취소 확인 및 구현이다. 원본 마감취소 서버/직원 예외/외부 회신·발주 적용, 실제 운영 저장과 전체 매뉴얼 완료는 미확인이다. 전체 완료0과 VAT 충돌5건 상태를 유지한다.

모아 연결은 HTTP401로 게시/재조회 대기다. 기존 문서를 중복 생성하지 않고 이 기록을 로컬에 보존했다. 인증 복구 시 기존 부모/PRD/아키텍처/로드맵을 읽고 누락분만 추가한 뒤 저장 본문을 재조회한다.

## 2026-10-21 · 운영0.53.3 직원 로그인 유지

사용자의 반복 로그인 개선 요청으로 비공개 runtime.env에 REA_STAFF_SESSION_MINUTES=43200을 추가했다. 비밀번호를 환경변수에 저장하지 않으며 직원 세션은 최초 로그인부터 최대30일이다. 아직 유효한 현재 세션을 같은 토큰/CSRF로 연장하고 로그아웃·비밀번호 변경·계정차단/IP 제한과 DB만료/폐기 거절을 유지한다. 고객포털 및 이카운트·모아 로그인은 별도다. 기간축소는 현재정책 접근차단이며 영구폐기는 기존 세션폐기를 사용한다.

분리후보8434b1c(f181c53 기반)를 push 후 기존 서버에 반영했다. 이미 검증된100선택/입고창고·검수RACK보호/단가요청 불러오기·비교저장·읽기조회·명시확정선택을 포함하며 미완료VAT는 제외했다. 최초 전체검사에서 API문서 버전불일치를 수정했고 최종 verify:local 종료0, 합성브라우저40/집중인증메일45/독립24 검사를 통과했다.

운영 새로고침2회에서 기존 로그인과0.53.3을 확인했다. 현재 세션 만료는2026-11-20 19:13:51 KST이며 로그인 추가 없이 app27→28, 변경은 세션expiresAt과 감사1건뿐이다. 기존 계정/비밀번호해시/회사/설정/로그인기록·gateway0·브라우저8전표/양식 JSON·메일3함8메시지1첨부는 동일하다. 비공개 설정은 기존 바이트를 보존하고 변수1줄만 추가했다. 백업복원미리보기0충돌, 복원/업무저장/메일발송 없음.

운영 번들 SHA712914484c93c8a0e2af86822d97526045444ec8d1038c89f7b11ec07bb44db9. 근거 evidence/session-retention-0533-20261021.json, manifest .artifacts/session-retention-20261021/candidate-manifest.json. 운영0.53.1 롤백/비공개설정 백업과 이전후보 보존. main은VAT연구 포함이므로 main 빌드로 운영 재시작 금지. 새 구매기능의 실제 저장 검증·원본동등성은 미완료이며 기존 VAT/매뉴얼 다음 작업을 이어간다. 모아401로 게시·재조회는 대기이고 로컬 기록을 준비했다.


## 최신 개발 인계 · 0.53.2 후보 9e4efd1 / 운영0.53.1 유지

발주계획 생성100선택 제한에 구매 입고창고 선택·검수/RACK 기록 보호를 추가한 분리후보 9e4efd1를 push했다. 전체 verify:local 종료0/브라우저36 통과다. 최신 manifest는 .artifacts/purchase-receiving-warehouse-20261021/candidate-manifest.json이며 이전 a71301a는 과거 후보다. 설치false, 운영 f5234fb7…는 그대로다. 아래 과거 개발 상태는 이력이다. 현재 계획은 docs/plan-manual-purchase-gaps-20261021.md 마지막 인계와 docs/manual-parity/ROADMAP.md를 따른다. 인증 후 운영UI/브라우저JSON 대조·새 비공개 백업·후보 설치/사후 보존·모아 누락분 저장/재조회가 남아 있다. main 미완료VAT 빌드로 재시작하지 않는다.

## 현재 운영 · 0.53.1 구매 연결 보호 (인증 후 검증 대기)

2026-10-21 release/0.53.1의90958ac를 기존 WSL/Supabase/Cloudflare rea.qaredi.com에 반영했다. 공개 버전/변경 파일 해시·접근 차단과 서버 계정/설정/자료·메일 보존을 확인했다. 브라우저 정체가 해소되어0.53.0 최종 JSON 대조는 통과했다. 저장 세션은 배포 전에 이미 만료되어0.53.1 재로그인 후 UI·브라우저 백업 대조는 대기다. 모아도 로그인 복구 후 기존 본문 읽기→누락분 추가→저장 본문 재조회가 필요하다. 상세 근거는 evidence/deployment-purchase-links-0531-20261021.json 및 docs/manual-parity/PROGRESS.md다.

운영은 분리 후보90958ac, main에는 미완료 부가세 연구/구현이 있으므로 main 빌드로 운영을 재시작하지 않는다. 재시작 전 .artifacts/isolated-link-release-20261021/candidate-manifest.json의 후보 번들 SHA와 dist/server/index.js를 대조한다. 기존 롤백0.53.0을 보존한다. 다음 개발은 VAT 입력식·최소구매단위 등 미확인 계약의 읽기 전용 조사이며 전체 매뉴얼 완료0이다.


## 현재 개발 · 거래별 부가세 순수 계산 (운영 미연결)

0.53.0 다음 단계로 `dist/transaction-vat-core.js` preview/verify와 신규21검사를 추가했다. 기존 lineTotals/default/saveDoc/HTML은 바꾸지 않았으며 운영의 거래별 저장 기능은 아직 구현되지 않았다. 현재 계획은 [부가세 계산·저장 통합](plan-manual-transaction-vat-20261021.md), 근거는 `evidence/manual-transaction-vat-20261021.json`이다. 같은 문서에 PDF·반품·전표 복사/변환·코드변경까지 금액 계약을 통일할 순서를 기록했다. 다음 실행에서 계획과 해당 수정 파일부터 읽는다. 원본 업무설정·공개 필드 매핑은 미확인이다. 모아 계산 코어/아키텍처 추가 기록은 로그인 복구 후 기존 문서에 반영하고 재조회한다.

## 현재 운영 · 0.53.0 요청 주문 라인별 보존

주문을 라인별로 불러올 때 동일 품목도 합쳐지던 문제를 수정했다. 요청+주문 내용복사+라인별에서 선택 행과 기존 입력 행을 각각 보존한다. 품목별의 동일 조건 합산은 기존에 있었으며, ‘합산 부재’라는 이전 차이표를 정정했다. 상이한 단가/거래처/납기 처리의 원본 정책은 미확인이다.

전체 verify:local, 관련Node54(신규6), 브라우저30(신규1) 통과. 원본4범위/자체4함수 REA6.4.0 파싱 성공, 의미coverage unknown/truncated false. 소스5fb7836 push 후 기존 WSL 서버를 재시작했고 공개0.53.0/변경파일 해시·Supabase 정상·익명 접근 차단을 확인했다. 기존 로그인에서 동일 주문을1개씩 두 번 불러와 같은 품목2행으로 유지됨을 확인했다. 저장은 실행하지 않았다.

서버 상태25/0 본문·수정번호, 비공개설정, 메일3함8메시지1첨부가 배포 전후 동일하며 복원미리보기0충돌이다. **브라우저 최종 JSON 대조는 대기**: 작성 중 화면의 닫기 확인 단계 뒤 탭21 입력/포커스 응답이 멈췄다. 대체 탭23은 기존 목록을 표시하지만 백업 버튼이 반응하지 않았다. 원본 전표 저장/발송/실제 복원은 없다. 마지막 브라우저 백업은 배포 전8전표이며 저장 시나리오는 합성 검사다. 모아는 로그인 만료로0.52/0.53 결과 게시·재조회 대기다.

근거: evidence/manual-order-import-20261021.json. 다음은 docs/plan-manual-transaction-vat-20261021.md. 브라우저 복구 후 멈춘 REA 탭21의 미저장 입력/닫기 상태와 운영 브라우저 JSON을 먼저 확인한다. 미확인 항목을 완료 처리하지 않는다.


## 현재 우선 지시 · 전역 매뉴얼 기반 재현 (2026-10-21)

사용자가 전체 기능의 완료 기준을 이카운트 매뉴얼의 실제 절차·결과 일치로 지정했다. 먼저 매뉴얼 목록, PRD와 아키텍처를 작성하고 모아 커뮤니티에 게시한 뒤 순차 개발한다. 현재 계획은 [docs/manual-parity/README.md](manual-parity/README.md), [PRD](manual-parity/PRD.md), [아키텍처](manual-parity/ARCHITECTURE.md), [진행 순서](manual-parity/ROADMAP.md)를 따른다. 공개 교육목차551항목/고유영상545개를 조사했으나 로그인 도움말/API 전체 목록과 영상 본문은 미완료다. 기존 구매실26절차는 재확인 후보이며 공식 동등성 완료가 아니다. 모아의 실제 주소 changkwon.mso.so에서 로그인과 기존 Rea_ERP 프로젝트 접근을 확인했다. 이전 웹1033 판정은 잘못된 주소 확인으로 정정하며, MCP 인증과 웹 접근은 별도로 추적한다. 원본 재로그인도 사용자가 완료했다. 실제 게시/로그인 상태와 다음 작업은 manual-parity/PROGRESS.md 및 evidence/manual-parity-20261021/publication.json을 확인한다. 아래0.50.0은 이전 운영 기록이며 자료·계정·양식·메일을 그대로 보존한다.

## 이전 운영 · 0.52.0 발주요청 BOM 1단계

원본 소요량계산의 BOM구분 전체/1단계와 공개 BOM_TYPE 매핑을 확인해 요청 소요 팝업에 추가했다. 전체는 기존 말단 전개를 유지하고1단계는 직전 자재/반제품을 가져온다. 구분 변경은 계산 결과를 무효화하며 합산 행에도 추가 소요량의 출처를 남긴다. 기존 자료/양식의 자동 변경은 없다.

전체 verify:local, entry-extra51(신규6), 합성 브라우저29(신규1)를 통과했다. 원본1파일/자체5함수 REA 파싱 성공·실패0, 의미coverage unknown·truncated false이며 동등성 전체 완료는 아니다. 소스92f927e를 push 후 기존 WSL 서버만 재시작했다. 공개0.52.0/변경3파일 해시·익명메일401·내부health404와 Supabase를 확인했다. 기존 로그인 유지, 운영 소요의 전체 기본값/1단계 선택/미리보기 무효화/재계산/닫기를 확인했다. 2단계 BOM 저장·재조회는 합성 브라우저 검사이며 운영에서 적용·전표 저장은 하지 않았다.

배포 전후 브라우저8전표/등록자료/설정/양식 JSON이 바이트 단위로 같다. Supabase app25/gateway0 본문·수정번호, 비공개설정, 메일3함/8메시지/1첨부 동일. 복원미리보기0충돌, 복원/발송 없음. 상세 evidence/manual-bom-20261021.json 및 docs/plan-manual-purchase-gaps-20261021.md. 다음은 요청 주문 불러오기의 품목별 수량 합산과 상이한 단가/거래처/납기/출처 규칙 조사다.

## 이전 운영 · 0.51.0 매뉴얼 기반 작성일·수정일 검색

원본 발주요청 도움말36항목과 본문4개를 읽어 공식 요구사항13개를 분해했다. 최초작성일자/최종수정일시 기간을 전표 기준일자와 함께 검색하고 신규 전표 최초 저장 시각을 유지하도록 구현했다. 날짜 없는 옛 자료에 시각을 만들지 않으며 사용자 양식·기존 필드ID·자료를 보존한다. 원본 서버 시간대/전역 매뉴얼 동등성은 미확인이다.

소스 bdb71de를 push 후 기존 WSL 관리 서버만 재시작했다. 전체 verify:local, 관련Node43(신규7), 합성 브라우저28(신규1) 통과. 공개0.51.0/변경3파일 해시·익명 메일401·내부health404·로컬Supabase200을 확인했다. 기존 로그인 유지와 운영 요청조회에서 입력 중 목록유지→F8 적용→역전기간 오류→작성/수정일 해제 후 원래1행 복구를 확인했다. 유효한 생성/수정 시각을 가진 전표 저장·검색은 합성 검사이며 운영 업무전표는 저장하지 않았다.

브라우저8전표/양식 JSON 전체가 배포 전후 바이트 단위로 동일하다. Supabase app25/gateway0 본문·수정번호, 비공개설정, 메일3함/8메시지/1첨부 모두 동일하다. 복원 미리보기0충돌, 복원/발송 없음. 상세: docs/plan-manual-document-dates-20261021.md · evidence/manual-document-dates-20261021.json. 모아 설계 문서와 순차 진행 기록은 docs/manual-parity/PROGRESS.md를 따른다.

## 현재 운영 · 0.50.0 거래유형·관리항목 (운영 확인 완료)

원본 구매 거래유형21/22·요청 관리항목 분리 팝업을 대조해 구매조회 거래유형/발주요청조회 관리항목 다중 검색, 네 구매 입력 거래유형 선택과 선택적 관리항목 BODY 연결을 추가했다. 기존 controls·양식ID·숨김·읽기전용·기본값과 옛 전표 코드·금액을 유지한다. 신규22/22로 명시 변경 시 로컬 세율0은 자체 정책이며 원본 회사·품목·창고 세율 전체 동등성은 미확인이다.

전체 verify:local·신규Node12·합성 브라우저27(신규2)·릴리스4를 통과했다. REA6.4.0 원본4범위/팝업2개 파싱·해시/근거 검증, 자체3파일 구문분석과 큰 UI 일부 생략 명시/변경10범위 보완을 기록했다. b7726ee 업로드 후 기존 WSL 서버만 수동 재시작(PID670106)해 공개v0.50.0/수정3파일 해시·익명 메일401·내부health404·로컬Supabase200을 확인했다. 사용자 재로그인 후 구매 거래유형 복수 선택/재개·닫기/F8·해제 후 기존 목록 복구, 요청 관리항목 사용중단포함/빈 검색/닫기와 네 신규 입력 거래유형/BODY 옵션을 확인했다. 관리항목 등록0건이므로 유자료 선택·저장·검색 및 세금 저장은 합성 검사만 수행했다.

브라우저8전표/등록자료/설정/양식은 배포 전후 JSON 파일까지 정확히 같다. app21→23은 재로그인 인증 기록만 갱신됐고 계정/비밀번호/회사/권한/설정·gateway0·비공개설정·메일3함/8메시지/1첨부는 보존됐다. 추가 복원 미리보기0충돌, 복원 실행 없음. 운영 전표/양식 저장·발송 없이 검증 조건을 해제했다. 관리 페이지77과 docs/purchasing-transaction-management-0.50.0.md · docs/plan-purchasing-transaction-management-20261020.md · evidence/purchasing-transaction-management-20261020.json을 현재 근거로 삼는다.

## 현재 운영 · 0.49.0 다중 선택·수정일자순 (운영 확인 완료)

사용자 요청으로 네 구매 조회 기준자료에 다중 피커를 추가하고, 원본에서 확인한 요청·구매에 수정일자순을 보완했다. 기존 단일 값/양식ID/검색 적용 시점·미저장 변경/충돌 검사를 보존한다. 선택은 최대200개, 팝업 50행, 닫기/Escape 취소와 개별/전체 해제를 지원한다. 원본 서버의 정렬 방향은 미확인이고 자체 최근 수정순/기록 없는 옛 자료의 기존 순서를 명시했다. 기존 백업에 시각을 만들지 않는다.

전체 verify:local·브라우저25(신규3)·신규Node13·릴리스4와 자체4파일/원본 작은4+범위2 REA근거를 검증했다. 기존 브라우저8전표/양식·Supabase19/0·메일3함/8메시지/1파일을 비공개 백업했다. 1893acd 업로드 후 기존 관리 서버만 수동 재시작(PID387067)했다. 공개v0.49.0/새 피커 파일 해시·익명 메일401·내부health404를 확인했다. 사용자 재로그인 후 운영 네 조회에서 복수 선택2개/재개·취소·F8 적용·원래 행/열 복구, 다른12피커의 검색/닫기와 요청·구매 정렬 옵션 적용을 확인했다. 브라우저8전표/양식 백업은 배포 전후 파일까지 정확히 같다. 재로그인의 인증 기록만 갱신(app19→21), 계정/회사/설정/권한과 gateway0·비공개설정·메일3함/8메시지/1파일은 보존됐다. 실제 정렬 순서는 합성 저장 검사이며 운영 전표 저장/발송은 하지 않았다. 검증용 조건은 해제했다. 상세: docs/plan-purchasing-multiselect-sort-20261020.md · docs/purchasing-multiselect-sort-0.49.0.md · evidence/purchasing-multiselect-sort-20261020.json.


## 현재 운영 · 0.48.0 구매 조회 검색 적용·목록 보존

발주요청·발주계획·발주서·구매 원본 조회를 실제 재대조해 검색(F8) 적용과 적용 후 패널 접힘을 보완했다. 입력 중에는 마지막 성공 결과·상태탭·선택·CSV를 유지하며 비동기 메일 상태 갱신은 대기 조건을 적용하지 않는다. 전표 연결/상세 저장/양식 재표시 후 조건·선택·페이지/스크롤과 계획 미저장 수량·단가·원본 충돌 검사를 보존한다. 기존 저장 구조·계정·업무자료·메일 연결과 수동 WSL/Supabase/Cloudflare 운영은 유지한다.

전체 verify:local·관련Node92(신규9)·합성 브라우저22(신규2)·릴리스4 통과. 현재 원본 공개3번들·구문분석 실패0·전체 의미그래프2부분과 검색 선언2개 범위 보완, 자체 수정2파일 REA 해시/근거 검증을 기록했다. 원본 현재 열 순서를 전역 기본값으로 덮어쓰지 않았으며 피커/관리항목/거래유형/수정일자순·원본 서버/출력/결재 동등성은 남아 있다. 소스46b9766을 업로드 후 기존 수동 WSL 서버만 재시작해 운영0.48.0을 확인했다. 기존 로그인으로 네 조회의 검색 적용/접힘·요청 날짜 오류 보존을 확인했고 운영 전표 저장/발송은 하지 않았다. app/gateway 본문·수정번호19/0, 기존 비공개 설정과 메일3함/8메시지/1파일이 배포 전후 동일하다. 상세: docs/purchasing-search-state-0.48.0.md · docs/plan-purchasing-search-state-20261019.md · evidence/purchasing-search-state-20261019.json.


## 이전 기능 · 0.47.2 메일함 자동 수신 연동

회사 메일을 pkdkak1@qaredi.com(이창권)으로 변경했고 REA 메일함 저장→Cloudflare 수신 규칙 자동 반영·재조회와 명시 재확인을 운영에서 확인했다. 같은 메일함ID/구성원과 기존 메일6건/첨부를 보존했으며 CF 규칙ID·규칙2개·전체수신 비활성·다른메일함/규칙을 유지했다. 주소/이름/사용 여부를 저장하면 연결된 회사 도메인 수신 규칙을 자동으로 맞추고 연결/실패/재시도 상태를 표시한다.

기능67c50fd, 좁은 화면 보완840d2b3, 실행 번들 의존성 보완305cde5를 업로드 후 기존 수동 서버에0.47.2를 반영했다. 최종 전체 verify:local·관련 Node66·브라우저20(390px 포함)·릴리스4·REA 자체3파일 검증을 통과했다. 실제 컴파일 Worker의 메일함 저장 회귀도 포함한다. Supabase route_sync 열과 서버 전용 인증을 적용했고 RLS·계정/비밀번호/회사/설정/업무자료/기존 설정값은 보존했다. 최종 비공개 백업3함/6메시지/1파일의 무결성·복원 미리보기0충돌을 확인했으며 복원은 실행하지 않았다.

새 주소 시험 각1통을 사용자가 승인해 양방향 모두 완료했다. Gmail→pkdkak1@qaredi.com은21:10:57 KST REA 받은편지함에 도착했고 본문·첨부0·읽음 저장을 실제 화면에서 확인했다. 재로그인 후 REA 회신1통을 발송해21:34경 Gmail 첫 조회INBOX/UNREAD·SPF/DKIM/DMARC pass·Reply-To/회신ID 일치를 확인했다. 메일 이동/필터 추가 없이 확인했으며 승인각1통을 모두 사용했다. 기존메일6건·첨부·계정/업무자료/기존설정/다른CF규칙을 보존했고 최종 백업3함/8메시지/1파일·복원미리보기0충돌이다. 신고한 test의 최초SPAM/사용자스팸아님 이동은 별도 기록이며 그 분류 원인과 향후 모든 메일의 수신함 분류는 미확정이다. 상세는 docs/mail-routing-0.47.0.md·docs/plan-mail-routing-20261019.md·evidence/mail-routing-20261019.json을 따른다.

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
