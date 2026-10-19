# 구매 기능 기존 구현 감사 — 2026-10-19

발주요청 → 발주계획 → 발주서 → 구매 흐름을 현재 소스와 관련 검사 코드로 대조했다. **저장 모드·행별 거래처·독립 확인/진행 상태·이력·현황 집계는 이미 구현돼 있다.** 감사 중 병행 작업에서 계획 행 불러오기·행 거래처 필터·목록 프로젝트/품목 검색·F3/F8이 보완되어 최종 소스로 다시 대조했다. 현재 우선순위는 남은 원본 검색/Option 계약과, 원본 재관찰 없이 검토 가능한 양식 변경 후 전체선택 불일치다.

## 감사 기준과 한계

- 기준: [현재 릴리스](../evidence/global-rea-20261018/current-release.json) `0.42.0`, 기준 커밋 `008c735313aeeddad3815ab16c7b7a71a652982e` 이후의 현재 작업 파일. 미커밋 F3 수정도 읽었다. 다른 작업자가 같은 저장소를 수정하므로 아래 판단은 이 문서에 기록한 소스 시점에 해당한다.
- 이번 수행: 제품 코드·검사 코드·기능 계약·기존 관찰 메타데이터의 **정적 읽기**, 이 문서 하나 작성. 제품 코드 실행, 검사 재실행, 원본/운영 브라우저 조작, API 호출, 설치·커밋·배포는 수행하지 않았다. 아래 “기존 검사”는 읽은 검사 파일이며 이번 통과 결과가 아니다.
- 원본 근거: [발주요청 F3 후속 문서](plan-request-search-shortcut.md), [10월 19일 연결 근거](../evidence/browser-rea-linux-20261019.json), 그 근거가 지정한 값 없는 `request-observation.json`의 검색 라벨/컨트롤 메타데이터, 현재 릴리스의 기능 계약. 이 감사자가 새로 원본 DOM을 관찰한 것은 아니다.
- 릴리스의 86본문·998검사는 기존 누계다. 10월 19일 공개 로더 2개/1,470B/의미 노드 134개 분석은 외부로 위임된 목록 본체·키 바인딩·서버 검색의 분석 완료가 아니다. 누계를 변경하지 않았다.
- **구현 확인**은 실행 경로와 관련 검사 코드가 있다는 뜻이다. **실제 미지원**은 비활성/읽기 전용/분기 부재가 코드에 명시된 경우다. **원본 근거 부족**은 자체 기능이 있어도 원본의 필드·권한·결과·보관 계약을 아직 입증하지 못한 경우다. 두 상태를 혼동하지 않는다.

## 코드 지도와 메뉴 범위

표의 약어는 다음 실제 파일을 가리킨다. 함수명으로 찾아갈 수 있고, 행 번호는 감사 시점 기준이다.

| 약어 | 구현 위치 / 주요 진입점 |
| --- | --- |
| IU | [inventory-ui.js](../dist/inventory-ui.js): `requestList` 268, `docFilters` 150, `docEditor` 156, `documentDialog` 114, `openDocumentHistory` 67, `renderReport` 325, `renderCurrent` 378 |
| IC | [inventory-core.js](../dist/inventory-core.js): `saveDoc` 246, `convert` 275, `transition` 299, `planLineProgress` 310, `command` 488, `validateBackup` 526 |
| EC / EU | [entry-core.js](../dist/entry-core.js): `documentCandidates` 37, `stageDocuments` 107, `stockCandidates` 52, `stageStock` 154 / [entry-ui.js](../dist/entry-ui.js): `openDocuments` 44, `openStock` 69 |
| ET / EX / EXU | [entry-tools.js](../dist/entry-tools.js), [entry-extra-core.js](../dist/entry-extra-core.js), [entry-extra-ui.js](../dist/entry-extra-ui.js): 품목 찾기·정렬·붙여넣기·바코드·My품목·금액·소요 보조 |
| PC / PU / PL | [purchase-plan-core.js](../dist/purchase-plan-core.js): `candidateRows`, `preview`, `commit` / [purchase-plan-ui.js](../dist/purchase-plan-ui.js): `open` / [purchasing-plan-list-ui.js](../dist/purchasing-plan-list-ui.js): `render` |
| RC / RU | [purchasing-report-core.js](../dist/purchasing-report-core.js): `search`, `summarize`, `summaryOutput`, `drilldown`, `graphData` / [purchasing-report-ui.js](../dist/purchasing-report-ui.js): `render`, `query`, `snapshot`, `restore` |
| PR / PRU | [purchase-room-core.js](../dist/purchase-room-core.js): `command`, `reconcile`, `periodSummary`, `validateStore` / [purchase-room-ui.js](../dist/purchase-room-ui.js): `open` |

[menus.json](../dist/menus.json)의 구매관리 하위 메뉴와 `IC.resolve`/`IU.renderCurrent`의 실제 연결도 읽었다. 요청 3개, 계획 3개, 발주서 4개, 구매 8개 메뉴가 있으며, 단가요청과 구매일괄회계반영 그룹을 연결 범위로 확인했다. 메뉴가 존재한다는 사실을 화면별 원본 동등성으로 계산하지 않는다.

최종 대조에는 Windows 담당자가 병행 수정한 `dist/entry-core.js`, `dist/inventory-ui.js`, 새 [purchasing-review.cjs](../tests/purchasing-review.cjs) 3사례와 [purchasing-integration.cjs](../tests/purchasing-integration.cjs) 선두 2사례를 포함했다. 변경 코드와 검사 내용을 읽었으며 실행 통과 여부는 이 감사에서 판정하지 않는다. 후속 작업의 범위는 [Windows 재검토 계획](plan-purchasing-review-20261019.md)에 이어진다.

## 발주요청

| 항목 | 이미 구현된 기능 | 코드 / 기존 검사 | 명시적 비활성·실제 미지원 | 원본 근거가 부족한 부분 |
| --- | --- | --- | --- | --- |
| 목록 | 선택 포함 11열, 상태 탭, 빠른검색, 신규/상세 모달, 페이지 선택·선택 건수, 보이는 검색 결과만 작업 대상으로 사용 | IU `requestList`, `table`, `documentDialog`; `tests/request-list.cjs`, `tests/inventory-modal.cjs` | 결재중 탭 비활성. 수정자/최초작성일의 없는 값을 새로 생성하지 않음 | 최신 열별 원본 계산·기본 정렬·작성자/시간대·사용자 양식 연결 |
| 검색 | 시작/종료일, 거래처(헤더 또는 행 supplier), 창고·프로젝트·품목, JSON 통합검색, 자체 추가항목 필터. Enter·F3 토글/포커스 복귀·검색(F8) 버튼/키 연결 | IU `docFilters(true)`, `requestList.refresh`, `renderCurrent`; `tests/request-list.cjs:7`, `:8`, `:9`, `tests/browser/request.spec.cjs:38`, `tests/purchasing-integration.cjs`의 새 필터/키 검사 | 원본 19개 항목 전체 미구현. 상세조건 change/input 즉시 필터링은 유지 | 피커 선택/해제/복수선택·검색 적용 시점·원본 검색식·서버 결과. 자세한 대응은 아래 별도 표 |
| 입력 | 헤더의 일자·담당자·창고·통화·납기·프로젝트, 행별 거래처, 같은 품목의 서로 다른 조건과 안정적 lineId, 수량/단가/세액, 신규·수정 모달 | IU `docEditor`; IC `saveDoc`, `validateLineProgress`; `tests/purchasing-input.cjs:10`~`:14`, `tests/purchasing-model.cjs` | 거래유형/참조 읽기 전용, 낱개수량 환산 미연결. 통화 코드는 보관하지만 환산은 구현하지 않음 | 원본 세무·필수/기본값·품목 단위 환산·참조·서버 검증 |
| 저장 모드 | F8 저장, F7 저장 후 자체 인쇄, 저장/내용유지로 동일 ID 수정, 저장/신규로 새 초안, 실패/권한 상실/오래된 수정 초안 보호 | IU `docEditor.save`, `editorDialog`, `draftBases`; `tests/entry-save.cjs:16`~`:22`, `tests/entry-save-new.cjs` | 저장/전자결재 비활성. 보류 초안은 세션 Map이며 새로고침 후 복구 저장소가 아님 | 원본 save 액션별 현재 연결·성공 응답·초기화/유지 필드 전체·서버 동시 수정 |
| 품목 보조 | 행 찾기 F3, 정렬, 창고/품목 안전재고, My품목·설정, 소요, 주문/전표 불러오기, 재고 표시, 바코드·전표바코드, 입력 검증, 하단 CSV/TSV 붙여넣기 | IU `entryActions`; EC/EU/ET/EX/EXU; `tests/entry-core.cjs`, `entry-ui.cjs`, `entry-tools.cjs`, `entry-extra.cjs`, `purchasing-input.cjs` | 목록의 웹자료올리기는 비활성이나 **입력의 웹자료올리기는 동작**. 자체 붙여넣기는 품목/수량/단가/할인율/적요 5종만 지원 | 원본 피커·항목 매핑·그룹 공유·스캐너·업로드 양식·보조별 적용/취소 동등성 |
| 상태·변환 | 확인 여부와 진행을 분리, 미확인 재고/후속 처리 제외, 일괄 상태 확인창. 목록의 다른전표생성은 발주계획 한 종류이며 한 건 선택 후 수량/저장 확인 | IC `purchasingState`, `transition`, `convert`, `validateLinks`; IU `changeStatus`, `convertDialog`; `tests/request-list.cjs:5`, `:6`, `tests/purchasing-model.cjs` | 선택삭제 비활성. 요청 목록에 발주서/이동 직행 버튼 없음. 이는 핵심 변환 엔진 부재와 다름 | 원본 상태 enum·확인/종결 권한·삭제/복구·서버 잔량 규칙 |
| 이력 | 선택 없이 이력 팝업, 요청 전용 10열, 작업/전표 기간·코드·행위·통합검색, F3/F8/Escape, CSV. 요청은 보관된 전체 이벤트를 검색 | IU `openDocumentHistory`; IC `recordDocumentHistory`, `documentHistory`; `tests/document-history.cjs`, `document-history-ui.cjs` | 작업자 미기록, 이력 상세·전표 버전 복원·출력/발송 이력 없음. 금액/작업자/수정일자 정렬 조건 미구현 | 현재 `IHistoryListPage` 실제 쿼리·필드 연결·서버 보관/정렬 규칙. 발주서 ES303M 정책을 요청에 그대로 적용하면 안 됨 |
| 출력 | 선택 한 건 자체 인쇄 미리보기, 조회 결과/이력 CSV, 기존 사용자 양식 투영 | IU `printDoc`, `projection`, `csv`; `tests/request-list.cjs`, `tests/form-dom.cjs`, `tests/document-history-ui.cjs` | Email·보내기·전자결재·바코드(품목) 출력 비활성. XLSX/외부 전송 없음 | 원본 출력 양식·일괄 인쇄·다운로드 권한·발송 결과 |
| 현황·집계 | 발주요청현황 이중 머리글, 날짜/번호/내외자/납기/창고/프로젝트/거래처/품목 검색, 최대 5축 집계·방향·소계·총합계·CSV/인쇄. 계획 전환 후에도 요청 전체 입력 수량 집계 | RC `specifications.request`, `search`, `summaryOutput`; RU `render`; `tests/request-aggregate.cjs`, `tests/purchasing-report.cjs`, `tests/purchasing-integration.cjs:100`~`:101` | 관리항목, 기간 비교, 그래프, 명시적 다중 정렬, 집계대상 선택, 구매 전용 drilldown 미지원 | 원본 서버 수량/세액·집계 조건·동명이인/동일 코드 표시·회사별 양식 |
| 권한·보관 | 조회/입력 권한, 저장 직전 재확인, 계정별 브라우저 DB, 선택적 독립 상태/행 ID와 구 v2 백업 호환 | IU `writeAllowed`, `commit`, `load`, `backupDialog`; IC `command`, `validateBackup`; `tests/entry-save.cjs`, `tests/purchasing-model.cjs`, `tests/document-history.cjs` | 서버 공유/기기 간 초안 동기화, 전표·필드별 세분 권한, 원본 서버 동시 수정은 이 로컬 구현의 기능이 아님 | 원본 권한/보관 정책과 호스팅 로그인 후 업무 검증 |

## 발주서

| 항목 | 이미 구현된 기능 | 코드 / 기존 검사 | 명시적 비활성·실제 미지원 | 원본 근거가 부족한 부분 |
| --- | --- | --- | --- | --- |
| 목록 | 기본 10열. 기존 상태/참조/생성전표/작성일 4열은 기본 숨김이며 기존 양식 ID 의미 보존. 확인/진행중/완료/미확인 탭, 선택·상세 | IU `requestList`의 `isPO`, `optionsForTable`, `rowData`; `tests/purchasing-integration.cjs:44`~`:47` | 발주서발송은 미연결. 작성자/수정자는 기존 문자열이 없으면 미기록 | 현 원본 열 prop 연결·발송 상태/클릭·작성자 표시·전체/잔량 금액 기준 |
| 검색 | 요청과 공통 기간/거래처/창고/프로젝트/품목/통합검색/추가항목, Enter·F3·F8 버튼/키 연결 | IU `docFilters(true)`, `requestList`, `renderCurrent`; `tests/purchasing-integration.cjs`의 새 필터/키 검사 | 원본 전체 검색 피커/복수 선택의 구현은 아님 | 발주서의 현 검색 항목/피커/F3 실제 동작을 요청 관찰만으로 확정하지 않음 |
| 입력 | 거래처 필수 헤더, 입고창고·납기·통화·프로젝트, 품목/규격/낱개수량/단가/금액/VAT 포함 단가, 원본 연결 품목 보호 | IU `docEditor`; IC `saveDoc`; `tests/purchasing-input.cjs:15`, `tests/plan-order-retain.cjs` | 거래유형·참조·첨부 읽기 전용, 박스수량 환산과 행 ↓ 메뉴 비활성 | 원본 환산·첨부/참조·회사 기본값·세무 및 실제 저장 검증 |
| 저장 모드 | 저장·저장/전표·내용유지·신규, 동일 ID 유지·경합 감지·기존 신규 초안 충돌 방지. 계획 배분/후속 구매 연결 보존 | IU `docEditor.save`; `tests/plan-order-retain.cjs`, `tests/entry-save-new.cjs` | 저장/전자결재 비활성. 다중 사용자 서버 버전 충돌 처리는 없음 | 원본 저장 성공/실패 및 양식별 필드 유지/초기화 |
| 품목 보조 | 공통 보조 외 거래내역보기(발주), 계획/단가요청 잔량 불러오기, 소요·안전재고·주문·바코드·붙여넣기. 계획 행 progress 정규화 보완 확인 | IU 발주서 `entryActions`; EU `openDocuments`, EC `stageDocuments`; `tests/entry-core.cjs`, `tests/purchasing-input.cjs`, `tests/entry-extra.cjs`, 새 `tests/purchasing-review.cjs` | 입력의 생성한 전표 버튼은 비활성. 목록의 숨김 생성전표 열은 자체 sourceId 관계 표시가 있으므로 별개 | 원본 생성전표 팝업·불러오기 계약. 아래 A는 현재 보완 확인 항목 |
| 상태·변환 | 독립 확인/진행, 발주서→구매 부분 잔량 변환, 동일 품목의 원본 행별 배분·중복 소비 차단. 계획 일괄 생성 경로도 구현 | IC `remaining`, `convert`, `validateProvenance`; PC `preview`/`commit`; `tests/purchase-plan.cjs`, `tests/purchasing-model.cjs`, `tests/self-policy.cjs` | 목록 선택삭제·외부 결재 비활성. 변환은 선택 한 건씩 | 원본 발주/입고 권한·종결·복구·부분입고 서버 규칙 |
| 이력 | ES303M 관찰 형태 11열, 최종이력 기본 체크, 보관된 전표별 마지막 이벤트 선택 후 조건 적용, CSV | IC `documentHistory`; IU `openDocumentHistory`; `tests/document-history.cjs`, `tests/document-history-ui.cjs` | 작업자/버전 상세 미지원. 200건 이외 과거 기록 복원 안 함 | 원본 최종이력 필터 적용 순서·3개월 경계·수정일 정렬·Excel |
| 출력 | 자체 인쇄·CSV. 구매실에서 거래처별 발주 메일 **초안** 저장/내보내기 | IU `printDoc`/`csv`; PR `mail.save`, PRU `receipt`; `tests/purchasing-integration.cjs`, `tests/purchase-room-core.cjs`, `tests/purchase-room-ui.cjs` | 목록 Email/보내기/전자결재·바코드 출력 비활성. 초안은 `sent:false`, 송신 미확인 | 실제 발송 채널·권한·전송/재전송·원본 인쇄 규칙 |
| 현황·집계 | 발주서현황 7열 이중 머리글, 품목별 납기, 2→5축 집계·비최하위 소계·합계·집계대상 4종 선택, 미구매현황은 별도 잔량 계산 | RC/RU; IC `report`의 미구매 분기; `tests/order-aggregate.cjs`, `tests/order-targets.cjs`, `tests/purchasing-integration.cjs:97`~`:107`, `tests/purchase-plan.cjs` | 그래프·기간 비교·결재방·전표/라인 집계축·집계 상세·명시적 정렬 미지원 | 일반 발주서 집계는 자체 전체 입력 수량. 원본 금액/잔량 공식·동적 출력 양식은 미확인 |
| 권한·보관 | 공통 inventory 권한·원본 연결/회계반영/월마감 보호·v2 백업. 계획 생성 preview의 원본 변경/변조를 commit에서 재검증 | IU `commit`; IC `guardClosedPeriods`; PC `commit`; `tests/purchase-plan.cjs`, `tests/plan-order-retain.cjs` | 원본 문서별 승인/발송 권한과 서버 공유 저장 미연결 | 원본 역할별 허용 범위·보관기간·호스팅 실업무 QA |

## 구매

| 항목 | 이미 구현된 기능 | 코드 / 기존 검사 | 명시적 비활성·실제 미지원 | 원본 근거가 부족한 부분 |
| --- | --- | --- | --- | --- |
| 목록 | 기본 12열, 공급가액/부가세는 기존 ID 유지하며 기본 숨김. 전체/미확인/확인 탭, 자체 확인·진행 복합 상태, sourceId 표시 | IU `requestList`의 `isPurchase`; `tests/purchasing-integration.cjs:48`~`:49` | 행의 인쇄는 고정 비활성, CSV에는 미지원. 최초작성자/일자는 미기록 가능 | 원본 상태 enum·인쇄 연결·불러온전표 표시·최초작성일/시간대·금액 계산 |
| 검색 | 공통 기간/거래처/창고/프로젝트/품목/통합검색/추가항목, Enter·F3·F8 버튼/키 연결 | IU `docFilters(true)`, `requestList`, `renderCurrent`; `tests/purchasing-integration.cjs`의 새 필터/키 검사 | 원본 전체 검색 피커/복수 선택의 구현은 아님 | 구매 원본의 현재 검색·피커·결과 정렬·권한 계약 |
| 입력 | 거래처·창고·담당자·통화·프로젝트, 품목행, 로컬 VAT/공급가액/세액·할인·반올림, 구매 재고/채무 연계 | IU `docEditor`; IC `lineTotals`, `saveDoc`, `movements`, `outstanding`; `tests/purchasing-input.cjs`, `tests/self-policy.cjs`, `tests/purchase-operations.cjs` | 거래유형 읽기 전용, 박스단위 계산·행 ↓ 메뉴 미지원. 외화 환산 없음 | 원본 세무·환산·회사 양식·반올림·실제 저장 결과 |
| 저장 모드 | F8, F7, 내용유지, 신규. 저장 후 동일 ID 재편집·중복 재고 방지, stale 초안/실패 보존, 연결 발주 잔량 보호 | IU `docEditor.save`; `tests/entry-save.cjs:5`~`:13`, `tests/entry-save-new.cjs` | 현금지급 분기·저장/전자결재 비활성 | 원본 결제/회계/저장 액션과 권한. 자체 별도 지급 메뉴와 현금지급 원본 분기를 동일시하지 않음 |
| 품목 보조 | 거래내역보기(구매), 발주 잔량·주문 복사, My품목, 할인 금액/반올림 보조, 바코드·검증·전표바코드, CSV/TSV 미리보기 적용 | IU/EC/EU/ET/EX/EXU; `tests/purchasing-input.cjs:5`~`:7`, `tests/entry-extra.cjs`, `tests/entry-tools.cjs` | 원본 업로드 양식/공유 My품목/실장비 지원 미확인. 붙여넣기 2MB·500행·5필드·중복품목 제한 | 원본 보조 기능별 단위/항목·스캔 입력·범위·적용/취소 계약 |
| 상태·변환 | 확인 변경은 진행 상태를 보존. 구매→부분 신용/교환반품→교환입고, 원본 수량·VAT 배분·재고·채무 보호 | IC `transition`, `convert`, `setReturnAmounts`, `rebalanceReturnAmounts`; PRU `receipt`; `tests/purchase-operations.cjs`, `tests/purchase-return-ui.cjs` | 구매 목록에 다른전표생성 없음. 반품/교환은 구매실에서 접근. 현금 환불·외부 회계 처리 없음 | 원본 반품/교환 화면·정산/세금·취소/복구 권한과 결과 |
| 이력 | 발주서와 같은 ES303M 형태·최종이력/검색/CSV, 실제 성공한 자체 문서 변경만 기록 | IC `recordDocumentHistory`/`documentHistory`; IU `openDocumentHistory`; `tests/document-history.cjs`, `tests/document-history-ui.cjs` | 상세·과거 복원·작업자·원본 출력/발송 이력 없음 | 원본 버전 보관·쌓이는 행위·권한·정렬·서버 결과 |
| 출력 | 하단 선택 한 건 자체 인쇄는 동작. 목록/현황/집계/이력 CSV, 구매 그래프/소계/선택 집계 상세의 인쇄 | IU `printDoc`, `renderReport`; RU `createSummaryTable`/`createGraph`; `tests/purchasing-integration.cjs`, `tests/document-history-ui.cjs` | 행 인쇄와 하단 인쇄를 구분. 외부 발송·XLSX·전자세금계산서 발행 없음 | 원본 행 인쇄·하단 인쇄 경로·법정/회사 출력 양식·인쇄 권한 |
| 현황·집계 | 구매 내역 19열, 최대 5축·방향·소계·총합계·5순위 정렬, 그래프 4지표/필터/색상/HSV, 비식별축 집계 상세, 성공 검색과 미적용 조건 분리, 다시작성 복원 | RC/RU; `tests/purchasing-report.cjs`, `purchasing-report-sort.cjs`, `purchasing-graph*.cjs`, `purchasing-subtotals.cjs`, `purchasing-drilldown.cjs`, `purchasing-rewrite.cjs`, `purchasing-integration.cjs` | 거래유형/시리얼·로트 검색, 기간 비교, 전표/라인축 drilldown, 집계대상 선택, 검색 설정 저장은 미지원. 혼합통화 집계 거절 | 원본 서버 계산·기간 비교·선택축의 역사적 마스터 값·보고서 양식/권한 |
| 권한·보관 | 공통 권한 외 기지급 채무·후속 반품·회계반영·창고 월마감의 원자적 실패 보호. 검수/대사 등 구매실 저장과 JSON 복원 검증 | IU `commit`/`backupDialog`; IC `command`/`validateBackup`; PR `validateStore`; `tests/purchase-operations.cjs`, `tests/purchase-room-core.cjs`, `tests/entry-save.cjs` | 브라우저 DB와 D1 업무 영역 별도. 변조 방지 감사 로그·다중 사용자 동시 제어 아님 | 원본 서버 권한·원가/회계·자료 보관 정책과 운영 QA |

## 연결 메뉴와 구매실: 구현을 빠뜨리지 말아야 할 범위

| 범위 | 실제 연결 / 기존 검사 | 한계 |
| --- | --- | --- |
| 발주계획 | PL 행 목록의 수량/단가 staged 편집→확인 저장, 행별 진행 변경, 미처리 행 선택. PC/PU의 거래처·납기·라인/품목·1장·직접설정 5모드 생성, 미리보기 변경 감지, 정확한 배분과 잔량. `tests/purchasing-plan-list-ui.cjs`, `purchase-plan.cjs`, `purchase-plan-ui.cjs`, `purchasing-model.cjs`, `plan-aggregate.cjs`, `aggregate-targets.cjs` | 원본 즉시 저장과 자체 명시적 확인은 의도된 차이. 목록 삭제/메신저 비활성. 집계대상은 계획뿐 아니라 **발주서에도 이미 확장됨** |
| 단가요청 | IC `resolve`→공통 목록/입력/업무흐름/보고서, `nextTypes.pricerequest`→발주서, EU 불러오기 대상 | 단가요청 원본 전체 감사·전용화 완료가 아님. 이번 3개 주요 대상의 연결 경로만 확인 |
| 미구매현황 | IC `report`의 발주서→구매 `remaining`; 입력 수량/처리 수량/잔량 출력. `tests/purchase-plan.cjs`, `tests/purchase-operations.cjs`에 연결/잔량 관련 검사 | 일반 발주서현황 집계의 전체 수량과 다른 지표. 원본 미구매 전용 화면/검색 계약 부족 |
| 구매단가일괄변경 | IU `renderBulk`→IC `command('bulkprice')`; 선택 구매 단가 비율 변경, 회계반영·연결/마감 검증을 통과해야 저장. `tests/inventory-core.cjs` 등 공통 명령 검사 | 원본 가격 변경 대상·일괄 편집/확인 UI와 결과 미검증 |
| 지급현황·구매할인현황·거래처별채무 | IU `renderPayment`/`renderReport`; IC `payment`, `outstanding`, `report`. 자체 지급/할인 기록·취소·채무 계산, 구매반품 반영. `tests/inventory-core.cjs`, `tests/purchase-operations.cjs` | 은행 송금/지급 연동 없음. 원본 현금지급 버튼과 동일 기능으로 간주하지 않음 |
| 회계미반영·구매일괄회계반영·매입계산서 메뉴 | IU `renderAccounting`/`renderReport`, IC `resolve`/`transition`/`report`. 자체 accounted 플래그와 공통 전표 조회 | 실제 회계전표/전자세금계산서 발행 미지원. 메뉴명만으로 세금계산서 전용 기능 완료를 선언할 수 없음 |
| 구매실 업무센터 | PR/PRU: 입고 검수, RACK/FIFO 기록, 거래처별 발주 메일 초안, 명세/원장 대사→검토→구매확정/해제, 세금계산서 요청/수령/금액 확인, 지급 인계, 월보고·품의/단계 승인, 수불/실사·자산·일/주/월 체크, 월마감/재개방. `tests/purchase-room-core.cjs`, `purchase-room-ui.cjs`, `purchase-manual-simulation.cjs`, `purchase-return-ui.cjs` | 자체 매뉴얼 업무 기록. 검수만으로 입고가 생성되지는 않음. 이메일·세금계산서·지급·전자결재의 외부 실행 없음. 담당자 문자열 기반 승인 기록을 원본 인증/권한 엔진과 동일시하지 않음 |

## 발주요청 검색: 기록된 원본과 현재 구현의 실제 차이

원본 메타데이터 출처는 `.artifacts/ego-authenticated-20261019/request-observation.json`이며 입력값은 없다. 19는 아래 라벨 수이고, 기준일자의 하위 input 6개를 6개 검색 항목으로 중복 계산하지 않는다. 아래 “없음”은 해당 원본 항목의 전용 컨트롤/검색 매핑이 현재 `docFilters`/`requestList`에 없다는 의미다.

| 원본 기록 라벨 | 현재 자체 대응 | 판정 / 다음 확인 |
| --- | --- | --- |
| 기준일자 | 시작일·종료일 2개 date input | 부분. 원본 날짜 하위 구성·단축기·범위 적용 규칙 추가 확인 |
| 내.외자구분 | 목록에는 없음. 현황에는 currency 필터 있음 | 목록 실제 누락. 현황 구현을 목록 구현으로 세지 않음 |
| 프로젝트 | 최종 코드에 마스터 select·문서 project 필터 추가됨 | 부분 구현. 원본 단일/복수 피커와 빈값 규칙은 미확인 |
| 거래처 | 사용 중인 마스터 select, 헤더 또는 행 supplier 매칭 | 부분. 원본 텍스트 피커의 선택·해제·복수/범위 계약 부족 |
| 품목 | 최종 코드에 마스터 select·문서 내 해당 품목 존재 필터 추가됨 | 부분 구현. 원본 피커·다중 조건/같은 행 매칭 규칙은 미확인 |
| 발송여부 | 없음 | 외부 발송 상태 데이터가 없으므로 임의의 성공/실패 상태를 생성하면 안 됨 |
| 발주요청No. | 통합검색에서 문서 ID 문자열 일부 매칭 가능 | 전용 번호 조건·입력/범위 규칙 없음 |
| 관리항목 | 원본 매핑 없음. 자체 `x_` 추가항목 필터만 있음 | 회사별 관리항목을 임의의 추가필드와 같은 것으로 매핑하지 않음 |
| 적요1·적요2·적요3 (3개) | 전용 조건 없음 | doc.memo/line.memo/원본 각 prop 연결 미확인 |
| 문자형식1~5 (5개) | 전용 조건 없음 | 원본 검색 전용 필드와 자체 사용자 필드의 매핑 미확인 |
| 장문형식1·제목 (2개) | 전용 조건 없음 | 저장 모델/원본 조회 필드 의미 미확인 |
| 기타: 수정일자순(정렬) | 전용 체크박스·정렬 없음 | 원본은 체크박스 기록. 자체 문서에는 수정 시각 자동 기록도 없으므로 정렬 키부터 확정해야 함 |
| 검색(F8) — 항목 수에는 미포함 | 최종 코드에 버튼 추가, `renderCurrent`의 키 검색 대상과 연결됨 | 구현 확인. change/input 즉시 필터도 유지되어 원본 적용 시점/취소 계약은 별도 확인 필요 |
| Option — 항목 수에는 미포함 | FormOptions의 양식·항목·검색항목·조건양식·페이지 설정 5개 자체 기능 | 실제 기능이 있으나 현재 원본 Option 하위 계약의 동등성은 미확인 |

요청 F3와 병행 작업의 F8·프로젝트/품목 검색을 미구현 목록에 다시 넣지 않는다. 원본 검색 구조가 확정되는 항목부터 합성자료 검색으로 확장하고, 발송/작성자/원본 서버 상태처럼 자료 근거가 없는 조건은 독립적으로 미지원 표시해야 한다.

## 원본 새 DOM 없이 검토한 내부 불일치와 현재 판정

초기 읽기에서 발견한 A/B는 최종 대조 전에 다른 작업자의 코드 보완이 반영됐다. 현재 남은 후보는 C이며, A/B는 회귀 검토 근거로 보존한다. 이번 감사에서는 제품 코드/검사를 실행하지 않았으므로 실행 재현 성공이나 검증 완료로 기록하지 않는다.

### A. 보완 코드 확인 — 계획 행 진행상태의 다른 전표 유출

- 초기 근거: 이전 EC `stageDocuments`는 `copy(line)` 후 `progress`를 그대로 복사하지만 IC `validateLineProgress`는 행 progress를 **plan에서만** 허용했다. IC `convert`와 PC `preview`는 이미 비-plan 대상의 progress를 제거했다.
- 현재 판정: 최종 EC 142행에 `if(result.type!=='plan')delete row.progress;`가 추가됐고, `tests/purchasing-review.cjs:12`에 최종 저장·sourceLineId·잔량·원본 무변경을 확인하는 검사가 추가됐다. **현재 미구현/미수정 항목으로 세지 않는다.** 이 감사에서는 검사를 실행하지 않았다.
- 발생 경로: IU 발주서 입력의 “계획”→EU `openDocuments(mode:'linked', sourceType:'plan')`→EC `stageDocuments`→IC 저장. 전표 바코드의 EX `stageVoucher`도 EC를 재사용한다.
- 수정 전 재현/현재 회귀 절차: 정상 plan을 `warehouse:'W001'`, 헤더 partner 없음, 행 `{item:'M001', supplier:'V001', lineId:'L1', qty:2, price:100, progress:'진행'}`으로 준비한다. 빈 purchaseorder 초안에 `partner:'V001'`, 같은 창고를 두고 이 행을 잔량 연결한다. 이전에는 progress가 남아 최종 `command('document', staged)`가 “품목행 진행상태를 확인하세요.”로 거절됐다. 현재 코드에서는 progress 제거 후 저장/잔량 보존을 확인한다. 이번 감사 자체 재현은 미실행이다.
- 수정 방향: 대상 전표 종류에 따라 허용되는 행 필드만 전달하되 plan→plan의 진행상태, sourceLineId/배분/잔량·사용자 필드는 보존한다. 완료 행을 불러올지의 업무 정책은 별도로 정해야 하며 이 수리로 몰래 바꾸지 않는다.
- 후속 검사 후보: 새 검사의 linked plan→purchaseorder 외 copy→request/purchase, plan→plan의 progress 보존, 전표 바코드 경로. 기존 `tests/purchasing-model.cjs:9`의 convert 정규화와 일관성을 유지한다.

### B. 보완 코드 확인 — 전표 불러오기 거래처 필터의 행 거래처 누락

- 초기 근거: 이전 EC `documentCandidates`의 partner 조건은 `d.partner===partner`만 보았지만 요청/계획은 행 거래처를 저장한다. IU 목록과 RC 현황에는 이미 행 거래처 검색이 있었다.
- 현재 판정: 최종 EC 44~50행에 요청/계획 문서의 행 supplier 후보, 해당 거래처 행 필터, 행 거래처명 표시/검색이 추가됐다. `tests/purchasing-review.cjs:22`, `:35`에 요청/계획 행 구분과 일반 전표 헤더 거래처 보호가 있다. **현재 미구현/미수정 항목으로 세지 않는다.** 실행 결과는 별도 담당 기록을 따른다.
- 수정 전 재현/현재 회귀 절차: 헤더 partner가 빈 request에 V001/V002 행을 각각 넣고 확인 상태로 저장한다. 발주계획 입력→발주요청 불러오기에서 “원본 거래처 V001”을 고른다. 이전에는 문서 전체가 탈락했고, 현재 코드는 V001 행만 남기도록 바뀌었다. request→plan 전환 문서와 기존 헤더 거래처 자료도 확인한다. 이번 감사 자체 재현은 미실행이다.
- 수정 방향: 문서 후보와 행 후보에 공급처를 일관되게 적용하고 표시 이름도 대응시킨다. 혼합 거래처 전표에서 V001 검색 후 V002 행까지 전부 가져오는 과잉 수정은 피한다. 거래처 일치가 필수인 발주서→구매 연결 검증은 유지한다.
- 필요한 검사: `tests/entry-core.cjs:25`의 후보 필터 확장, EU 피커의 V001/V002 구분, 요청/계획의 빈 헤더와 기존 헤더 거래처 백업 양쪽. `tests/document-history.cjs:45`에 있는 행 거래처 검색 보호를 불러오기에도 일관되게 적용할지 검토한다.

### C. P2 — 조회 양식에서 선택 열 이동/이름 변경 시 전체선택 컨트롤 소실

- 근거: 최종 IU `requestList.refresh` 287행은 `box.querySelector('thead th')`로 **첫 번째 헤더**를 고르고 `textContent==='선택'`일 때만 전체선택 체크박스를 만든다. 반면 `projection`은 안정적인 c0 ID를 유지하면서 사용자 열 순서·라벨 변경을 허용한다.
- 합성 재현: 요청/발주서/구매의 자체 목록 양식에서 c0 선택 열을 두 번째로 이동하거나 라벨을 변경해 적용한다. 개별 행 체크박스는 남지만 “현재 페이지 전체 선택” 헤더 컨트롤을 붙이는 조건이 거짓이 된다. 기존 사용자 양식 JSON으로도 재현 가능하다.
- 수정 방향: 표시 라벨/물리 첫 열 대신 투영된 필드 ID c0의 위치를 기준으로 컨트롤을 구성한다. 선택 열을 의도적으로 숨긴 경우와 현재 페이지 범위는 존중한다.
- 필요한 검사: `tests/request-list.cjs:4`와 `tests/purchasing-integration.cjs:46`, `:47`, `:49`을 연결하여 이동·라벨 변경·숨김·페이지 이동을 검사. 기존 검사는 기본 전체선택과 legacy 열/CSV 의미 보존을 따로 다룬다.

## 권한·보관·검증의 공통 경계

- 메뉴는 [menu-core.js](../dist/menu-core.js)의 `canOpen`에서 inventory.read, 변경은 IU `commit`과 보조 창의 최종 적용에서 inventory.write를 확인한다. [auth-ui.js](../dist/auth-ui.js)의 권한과 [self-core.js](../dist/self-core.js)의 역할 구조는 존재한다. 원본의 회사·부서·전표별 세분 권한을 재현했다는 뜻은 아니다.
- 업무 DB는 계정에 따라 나뉘는 `ecount-inventory-v2` 계열 localStorage다. D1 업무 영역으로 자동 동기화하지 않는다. 같은 브라우저 앱 메모리 안의 문서 JSON 비교는 구현됐으나 다른 탭/사용자/서버와의 수정 번호 충돌 제어는 아니다.
- 전표 이력은 optional `documentHistory` v1, 구매 4종 전체 합계 최신 **200건**. 성공 후 실제 바뀐 문서만 기록하며 기존 문서에서 과거 이력을 만들어내지 않는다. 이벤트 시점 메타데이터를 저장하지만 전체 before/after 본문·작업자·변조 방지 서명은 없다.
- 보류/편집 초안은 Map이다. My품목은 EX.accountKey 기반의 별도 회사/사용자 localStorage이며 개인 그룹만 지원한다. IU JSON 업무 백업은 db를 내보내므로 별도 My품목 저장소와 메모리 초안을 포함하지 않는다.
- 복원은 IC `validateBackup` 후 교체 확인을 거친다. 기존 상태와 연결·재고·지급·구매실 보관 구조를 검증한다. 원본 동등성 확대 중 저장 필드 추가가 필요하면 기존 v2와 사용자 양식의 복원/변환 정책도 정해야 한다.
- 현재 릴리스의 호스팅 로그인 후 업무 QA는 false다. 10월 19일 기록의 Node 15개/localhost 브라우저 5개 결과는 F3 작업의 과거 실행 증거이며 이번 감사 전체나 원본 동등성 검사 결과로 확대하지 않는다.

## 권장 진행 순서와 합격 조건

1. **이미 보완된 A/B와 목록 F3/F8·프로젝트/품목 검색의 실행 근거 확보.** 새 검사와 연결/잔량/권한/실패 시 무변경 검증은 구현 담당자가 수행한다. 이 감사의 정적 확인을 실행 통과로 대신하지 않는다.
2. **발주요청 검색의 남은 계약을 좁혀 완성.** 19개 기존 구조를 출발점으로 Windows 담당자가 검색 피커와 Option의 현재 하위 계약을 관찰한다. 내외자·번호·관리항목/사용자 항목·수정일 정렬의 범위와 검색 적용/취소·조건/선택 유지 합격 조건을 정한다. 원본 조회와 자체 즉시 필터의 차이를 의도적으로 결정한다.
3. **목록 양식 정합성 후보 C.** 요청부터 확인하고 공통 `requestList`를 사용하는 발주서·구매의 기본/기존 양식과 CSV를 같이 보존한다.
4. **발주서→구매 대조 확대.** 현재 원본 검색·상태·하위 버튼·출력 연결을 추가 확인한다. 이미 구현된 저장 모드/이력/집계는 회귀 대상으로 두고, 작성자·발송·첨부·단위 환산·서버 금액 등 미확정 계약을 새 관찰 없이 채우지 않는다.
5. 후속 구현마다 사용 예·성공/취소/오류·권한·보관을 기록하고 관련 Node/jsdom 및 localhost 합성 브라우저 검사만 먼저 수행한다. 배포·운영 QA는 별도 릴리스 절차로 진행한다.

## 감사 시점 식별

아래 해시는 읽은 현재 소스와 기존 F3 근거를 구분하기 위한 것이다. 다른 작업자의 후속 수정은 이 문서 내용을 자동 갱신하지 않는다.

| 파일 | SHA-256 |
| --- | --- |
| dist/inventory-ui.js | `fc20df7c0c89347923d03bd9f064deef664fd89a13c83b706af5f5595c8286c7` |
| dist/inventory-core.js | `6b135d433f32237d292b30cf8d7b7c7f5c0b0b7a69ecc7f2121c8038baeb717a` |
| dist/entry-core.js | `517f2a1384f493e679c72091cdd476c874b7f58721c60a846d7de9dad33ff461` |
| dist/purchasing-report-core.js | `7a5af23f3b39945e446166ec3438f1c478eeea06717cbf893a9333ed6547bc17` |
| dist/purchasing-report-ui.js | `8dc694ff6d5fb17bef47d95857f430881107bf459cc5bf1bdd526270fbdd3520` |
| evidence/global-rea-20261018/current-release.json | `fd8be65206a43ac062a7264645c266d1058d64d8367dffe92a348220a807b9fd` |
| evidence/browser-rea-linux-20261019.json | `be18eec0ce8ccd02893b6a5b0d194861d618b24e3b22a47d5e0baea87a09a2f9` |
| .artifacts/ego-authenticated-20261019/request-observation.json | `5fa8563cd647f1bde6b4c0a92275e00948a30ed0f1cfdd2463c88458579a9a95` |

현재 원본 계약의 상세 기준: [발주서 목록](../evidence/global-rea-20261018/order-list-columns/ui-own-policy.json), [구매 목록](../evidence/global-rea-20261018/purchase-list-columns/ui-own-policy.json), [이력](../evidence/global-rea-20261018/document-history/ui-own-policy.json), [요청 이력 구분](../evidence/global-rea-20261018/document-history/request-history-distinction-supplement.json), [내용유지](../evidence/global-rea-20261018/plan-order-retain/ui-own-policy.json), [저장/신규](../evidence/global-rea-20261018/save-new/ui-own-policy.json). 과거 `request-list.md`의 “독립 상태/행 거래처/이력 미구현”이나 초기 구매 문서의 “저장 하위 분기/집계 미구현”을 현재 미구현 목록으로 옮기지 않았다.
