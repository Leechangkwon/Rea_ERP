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
