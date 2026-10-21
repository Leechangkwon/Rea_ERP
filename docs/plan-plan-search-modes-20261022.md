# 발주계획 조회구분 차이표와 날짜 바로조회

0.69.1 운영/01932d7, main0563537 이후 사용자 UI 회귀수정 완료. 신규 조사는 원본 읽기전용 조회/공개 정적 분석으로 제한하고 기존자료·계정·양식·메일을 보존한다. main VAT5 연구 빌드 설치 금지.

## 조회구분 차이표

근거 .artifacts/manual-plan-search-modes-20261022/difference-table.json. 원본 건별0/전표별1·SUM_FLAG3/4, 전표별 NumberChk 숨김·ZERO_FLAG_CHK0, 건별로 돌아오면 미적용 수량값보존을 확인했다. 전표별 단가공란·label, 건별 수량/단가 grid-input-data와 저장계약은 공개코드에 나타난다. 원본 전표별23행/건별 렌더26행을 읽었지만 가상화/페이지와 대표품목·수량/필터 집계 규칙이 남아 있다. 사업자료 값은 파일/인계에 보존하지 않는다. 대표수량을 전체수량합으로 추정하지 않으며 전표별 구현·상태/선택 확대는 보류한다. 같은 빈조회/0수량 검사를 새 개발량으로 세지 않는다.

## 확인된 독립 단위 · 날짜 바로조회0.70.0

원본 F3의 금일/전일/금주(~오늘)/전주/금월(~오늘)은 자체 계획목록에 누락돼있다. 원본 금주10/18~10/22, 전주10/11~10/17로 일요일 시작을 직접 확인했다. 오늘/전일 및 월초~오늘도 현재화면에서 적용기간을 확인하고 기존 PurchasingReportCore.preset(weekStart0)을 재사용한다.

대상 dist/purchasing-plan-list-ui.js·inventory.css, 신규 tests/plan-list-shortcuts.cjs와 browser/plan-list-shortcuts.spec.cjs. 날짜단축키는 기존 pending 창고/프로젝트/거래처/품목/수량과 quick query를 함께 적용하며 성공 때만 기간입력/적용결과를 갱신·F3닫기한다. 기존 선택/미저장 수량단가/상세열기/CSV·snapshot보존, 읽기권한검색 허용·쓰기권한확대 없음. 오류 시 이전결과와 pending날짜·원본을 원자적으로 보존한다. 검색행은44px 태블릿/36px 데스크톱과 높이상한을 지킨다.

완료조건: 5버튼 기간 및 윤년/일요일/월경계, 기존조건결합, 무자료/권한회수/헬퍼부재오류, 미저장/선택/CSV·탭snapshot·백업보존 검증. 관련Node/실제app shell desktop/tablet/mobile→독립검토→0.69.1기반분리후보전체verify→commit/push→기존운영배포·기존로그인/readonly UI·전후보존대조. 원본/운영업무쓰기·발송없음. 매뉴얼본문15/요구사항25/전체합격0 유지, 모아는새인증없는재검사금지/기존기록업로드대기.

## 독립 P2 수정

미저장 음수단가가 포함된 기간 조회에서 lineTotals가 실패하면 applied/date만 먼저 바뀌던 문제를 재현했다. refresh는 새 rows/tabs/table/pager/count/권한을 모두 offscreen준비하고 한 번에 반영하며, applySearch 실패 시 이전applied/page를 복구한다. 날짜입력/숨김은 성공 뒤만 갱신, 오류 때 기존DOM·selection·edits·pending날짜를 보존한다. 실음수단가→검색실패→수정후회복을 신규Node8/관련78 및 실제shell브라우저에 추가했다.

## 운영 반영 결과

원본 건별/전표별 전환과 SEARCH_TYPE0/1→SUM_FLAG3/4, 전표별 수량조건숨김/ZERO_FLAG_CHK0·단가공란/읽기전용·건별복귀 시 수량값보존을 대조했다. 원본 전표별23행과 건별 렌더26행은 페이지/가상화가 있어 전체자료가 아니며 대표품목/수량·필터 후 전표합계·선택/상태의 서버규칙은 미확인이다. 이 부분은 구현보류/미완료로 분리했다. 실업무값을 파일·인계에 저장하지 않았고 원본 쓰기/발송은 없다.

같은 화면의 누락된5개 날짜 바로조회만 구현했다. 금일10/22·전일10/21·금주10/18~22·전주10/11~17·금월10/1~22를 원본에서 확인한 뒤 기존preset(weekStart0)을 연결했다. 날짜를즉시조회하고 pending 다른조건·미저장 수량단가/선택·CSV·snapshot을보존한다. 독립검토의 실음수단가/조회예외 P2를 수정해 offscreen준비성공 때만 조건·DOM을함께반영하고 실패시이전조건/필드/DOM을보존한다.

신규Node8/관련78·신규브라우저3, 운영0.69.1기반분리후보 전체 verify:local/브라우저81 통과. REA6.4 자체5범위·해시/근거검증해 재사용한 원본5범위 parse0/coverage unknown/truncated false, 독립P2동일재현해소/추가차단없음. release/0.70.0-plan-search-shortcuts / db9b68e, 소스6860816을push후기존WSL·Supabase·Cloudflare에반영했다. 운영로그인유지·5개적용기간/44px버튼·빈조회확인. 운영계획0건이므로 유자료검색/저장은합성검증이고 운영업무/설정저장·인쇄·발송·복원없음.

8전표/양식·전체JSON byte동일, fresh 서버app30/gateway0 본문·수정번호·비공개설정·메일3함8통1첨부전후동일. 근거 evidence/manual-plan-search-modes-20261022.json, manifest .artifacts/manual-plan-search-modes-20261022/candidate-manifest.json, worktree .artifacts/releases/0.70.0-plan-search-shortcuts. bundleSHA af9d4129565aed0dcca15d1b35d7f891d70bd92cf29d57a65496deccf0bc70ff, 롤백0.69.1보존, 런타임50715 KEEP ALIVE. mainVAT5 빌드설치금지.

본문15/요구사항25/전체합격0 유지. 모아마지막저장·재조회0.51.0/50갱신로컬대기이며 인증변화없는반복검사없음. 전표별대표수량을임의로합산해완료처리하지않는다.

발주계획조회 건별/전표별 차이표를 작성했다. 다음은 원본 발주계획조회 도움말의 조회구분·대표품목/수량·합계·필터 절차를 본문과 예외로 분해하고, 공개 GetListSearchPurchasePlan DTO/응답열 매핑과 대조한다. 대표수량을 전체수량합으로 추정하거나 전표 전체/부분 선택과 종결·생성 권한을 확대하지 않는다. 날짜 바로조회0.70.0과 UI회귀0.69.1은 반영·보존 검증을 마쳤으므로 같은 검사를 새 개발량으로 반복하지 않는다. 웹자료올리기 회사별 Flow/setup/dataModel·묶음/필수/부분실패·재시도 계약, VAT5·상이단가/전체적용·부서/직위/직책·직접음수/환불·회계/일괄인쇄·원본작업탭 동등성은 미완료다. 미확인 요청 전체계획 합산 제외는 원본근거가 없어 확정 요구사항이 아니다.
