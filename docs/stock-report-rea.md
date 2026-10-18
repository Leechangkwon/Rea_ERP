# 출력물 재고현황 원본 대조·REA 근거

## 조사 범위

원본 ERP의 출력물 재고현황을 직접 관찰한 화면·버튼 반응과 공개 배포 JavaScript의 정적 근거를 구분해 기록한다. 원본 회사 자료·로그인·세션 URL·쿠키는 수집하지 않으며, 원본 저장·삭제·발송은 실행하지 않는다. `sources/`는 읽기 전용으로 유지한다.

## 기존 공통 페이지의 근거 한계

기존 `.artifacts/purchasing-original/reportPage.js`는 `app.inventory.inventory_status`라는 공통 현황 페이지 셸이다. SHA256은 `6bdc598e619328fe08e0d0fa8211b5d3c8c3ba777dc876863ed7d12621806dce`다.

이 파일은 `InventoryStatusPage`, `IInventoryStatusPage`, `IGetInventorySetupProgram`, `IGetInventoryDataModelProgram`의 연결과 공통 하위 메뉴 setup 호출을 포함한다. 이 파일만으로 재고현황 전용 검색 조건·열·정렬·원가 계산·드릴다운 또는 Excel/인쇄 동작을 입증하지 않는다. 신규 조사에서는 root가 직접 관찰한 재고현황에 실제 연결된 공개 파일을 받아 확인한다.

## 실행 방식

REA 6.4.0 직접 in-process 정적·의미 분석 함수를 사용한다. 대상 JavaScript는 실행하지 않는다. 기존 CLI의 프로세스 소유권 조회 오류를 반복 실행하거나 해결했다고 보고하지 않는다. 결과는 CLI 애플리케이션 그래프나 런타임 호출 확인과 구분한다.

재고현황 전용 신규 공개 입력을 받아 실제 분석을 완료했다. 입력 SHA256·바이트·파싱 결과·함수와 호출 수·동적 미확인 수 및 원본 위치를 아래에 기록한다. 단순 버전 호출이나 기존 공통 파일을 신규 전체 분석 성공으로 기록하지 않는다.

## 자체 구현과 분리

현재 자체 `InventoryCore.report`의 일반 재고현황은 품목·창고별 기초/입고/출고/현재고/안전재고/재고금액을 계산한다. `stock`은 기초 수량과 확인된 수불 이동을 합산하고, 재고금액은 자체 등록 매입단가에 현재고를 곱한다. 이는 기존 독립 모델이며 원본 재고현황과 동일한 원가·기간·품목/창고 범위라고 입증된 규칙이 아니다. 새 원본 관찰과 대조하기 전에 이를 원본 동등성의 근거로 취급하지 않는다.

## 재고현황 전용 공개 파일 실제 분석

- 입력: `.artifacts/stock-original/stockReport.js`, 18,386바이트
- SHA256: `1d0111594c06335202690011de44195a0640725f3aa699e8ec1a343e78147805`
- REA: `rea-agents@6.4.0` 직접 정적·의미 분석, 문법 분석 완료, 파싱 오류 0
- AST 4,150개, 함수 62개, 호출 지점 234개, 동적 미확인 frontier 237개
- 원시 결과: `.artifacts/stock-rea-report/rea-inprocess-{static,ir,summary}.json`
- 함수별 REA callable ID, 1행 열 범위, UTF-8 바이트 범위, 조각 SHA256: `.artifacts/stock-rea-findings.json`

이는 ESZ001R 페이지의 정적 구조 분석이다. 서버의 재고 계산이나 실제 호출·권한·회사 기본일자 검증을 실행했다고 주장하지 않는다.

| 항목 | 원본 코드로 확인한 범위 | 위치: 1행 열 범위 |
|---|---|---|
| 기준일 스냅샷 | 검색 시 `BASE_DATE`를 `BASE_DATE_TO`에 복사하고 `BASE_DATE_FROM`을 제거한다. | api, 4451–4769 |
| 검색·Excel 경로 | `GetListStatusInventoryBalance`; IS_INCLUDE_QUICKSEARCH=true가 설정된다. | initProperties 및 api |
| 제로 수량 | QTY_CALC.value에 NORESIDUALS가 포함되면 ZERO_QTY_INCLUDE_YN=Y, 아니면 N이다. 숫자형 검색 위젯의 표현식 전체 문법은 이 파일에 없다. | api, 4451–4769 |
| 기타 조건 | NON_STOCK_PROD_INCLUDE_YN, DEACTIVATE_PROD_INCLUDE_YN, PROD_SAFETY_STOCK_UNDER_YN을 체크 여부에서 Y/N으로 만든다. **사용중단품목 포함은 소스에서 select(Y)로 초기 선택된다.** 따라서 이 초기값은 회사 설정을 복사한 것으로 판단하지 않는다. | onInitUnitWidgetEtcChk, 9442–10398 |
| 창고별 동적 열 | 첫 결과 행의 이름이 STOCKS로 시작하는 속성을 stockQty 셀로 정의한다. 실제 창고 ID·이름·값은 복사하지 않는다. | getGridCellInfo, 5547–5701 |
| 기본 재고 수량 표시 | mainStockQty는 label이다. 전체 창고 조회이며 사용자 ALL_GROUP_WH가 1이 아닐 때 BAL_QTY가 SAFE_QTY보다 작으면 연한 붉은 배경을 적용한다. 창고·창고그룹 선택 시 이 총계 안전재고 강조는 하지 않는다. | onInitUnitGridCellMainStockQty, 10806–11398 |
| 창고별 재고 수량 표시 | stockQty도 label이다. STOCKS별 SAFE_QTY와 비교해 미만일 때 같은 배경색을 적용한다. OTHERS 열은 별도 예외다. | onInitUnitGridCellStockQty, 11426–11900 |
| 품목 드릴다운 | 품목 코드·명 baseSlip은 일반 자료행에서 link이며 수불현황 ESZ003R, 프로그램 E040702로 연결한다. 별도 그룹/합계 행은 label이다. | slip, 7141–8592 / baseSlip click, 8895–8950 |
| 미처리 수량 드릴다운 | out_bal / in_bal / pr_bal은 미판매·미구매·미생산 관련 조회로 연결된다. 품목·기준일·창고 조건을 전달한다. | onInitUnitGridCellOutStanding, 15186–18130 |
| 기초일자 검사·재집계 연결 | framework summaryCheck에 GetBatchUpdateBalanceForInventory가 등록된다. inventory=true/account=false/MonthlyClosing=true 설정 및 회사 기초일자 검사가 있다. 조사 에이전트가 이를 별도 호출하거나 원본 재집계를 실행하지 않았다. 표준 검색 자체의 framework 동작 여부는 별도 런타임 경계다. | param, 6677–7055 / onSearchValidate, 14304–15153 |

검색 화면의 root 직접 관찰에서는 기준일자·창고·품목, 수량관리제외품목 포함·사용중단품목 포함·안전재고설정미만표시, 수량 최소/최대, 적용양식·결재방표시·정렬/소계기준 설정, 검색(F8)·금일·전일·설정·다시작성이 확인됐다. 이 UI 관찰은 정적 분석 결과와 구분하며, 결과 양식과 각 버튼의 하위 반응은 추가 관찰 기록에 따르도록 한다.

서버 반환의 동적 창고 열, 형식·수치 반올림, 미처리 잔량·원가금액의 정확한 계산 규칙 및 재고 권한 필터는 이 공개 파일 하나로 입증되지 않는다. 자체 구현에서는 이 미확인 부분을 원본 동등성으로 표시하지 않는다.

## 관찰된 기본 결과와 독립 UI

root가 직접 확인한 현재 재고현황 결과의 열은 `품목코드 / 품목명[규격] / 재고수량 / 금액(재고수량*입고단가) / 입고단가`다. 이 열 순서와 품목 코드·명의 수불 드릴다운을 독립 UI에 적용했다. 원본 회사 양식이나 회사 데이터를 복사한 것이 아니며, 다른 동적 창고 양식 전체가 구현됐다고 주장하지 않는다.

`StockReportUI`는 기준일·선택 창고·품목·세 가지 포함/안전재고 조건·수량 범위를 `StockReportCore.query`에 전달한다. 검색 전에는 조건 화면을 보여 주고, 검색 후에는 5열 결과와 현재 조회만의 인쇄/CSV를 제공한다. 빠른검색은 조회된 품목 코드·명·규격을 Enter 시 필터링한다. 필터 오류가 나면 이전 결과를 지워 잘못된 조건에 과거 결과를 내보내지 않도록 한다. 조회와 정렬은 업무 자료를 변경하지 않는다.

정렬/소계/합계설정의 root 직접 관찰을 바탕으로 단일 열 정렬 방향과 현재 결과의 수량·금액 합계 표시만 적용했다. 다중 기준·소계·페이지분할·입고단가 합계·회사 양식 선택·결재방·외부 자동 알림과 미관찰 하위 설정은 비활성 사유를 표시한다.

`tests/stock-report-ui.cjs`의 자체 합성 자료 검사 10개는 초기 조건, 정확한 5열과 클릭 영역, 조건 전달·빠른검색·출력, 잘못된 범위와 과거 결과 차단, 창고/품목/안전재고 조합, 정렬·합계 표시, 초기화와 모달 정리를 검증한다. 창고·품목 선택은 검색 입력란과 선택 버튼으로 팝업을 열며, 팝업의 검색·사용중단 필터·50행 페이지·적용 전 임시 선택·닫기 취소를 확인했다. 5,000품목을 100페이지로 나누고 여러 페이지의 선택이 보존되며 한 번에 최대 50개 자료 행만 렌더링되는지도 검사했다. 결과 열 머리글의 클릭 정렬은 직접 관찰 근거가 없어 제공하지 않으며, 일반 텍스트 머리글만 표시한다. 정렬은 직접 관찰한 정렬/소계기준설정 팝업에서만 적용한다. 이 jsdom 결과는 호스팅 브라우저 검증이나 원본 서버 계산의 동등성 검사가 아니다.
