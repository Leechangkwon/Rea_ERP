# 구매실 매뉴얼 보완을 위한 부분 REA 분석

공개 JavaScript 4개에서 업무 질문에 해당하는 AST 조각 13개만 추출해 REA 6.4.0으로 분석했다. 원본 이카운트 저장·발송과 인증 API 호출은 실행하지 않았다.

- 원본 합계: 5,212,755 바이트
- 분석 입력: 2개 파일, 81,957 바이트, 1.57%
- 구문 분석 실패: 0
- REA Evidence: `ev_114260c4d7c0a68eee93dd3962648b250db17618de5ba56a327017ba6ca888c2`
- 입력 루트 SHA-256: `26bddc0bc5e3cbe61dd38244342f429a9438e7cd6511aaf555132788dab9b304`
- 전체 기록: `evidence/purchase-manual-rea.json`

## 업무에 반영할 수 있는 관찰

### REA-MAN-01: 전표불러오기 변환 경로

선택 팝업에서 원본 전표를 받은 뒤 GetTransformDataAction 또는 GetTransformV5DataAction을 호출하고 외부 common.resultDataModel에 매핑을 위임한다. 신규/복사는 교체, 수정은 상세 행 추가 경로로 분기한다.

적용: 불러온 원본 식별과 변환 결과, 신규/수정 적용 방식을 구분한다.

한계: 서버 매핑 및 common.resultDataModel 구현은 이 4개 자산 범위에 없다. 창고이동→판매에서 출고창고를 원본 출발/도착 중 어느 것으로 바꾸는지는 확정하지 못했다.

### REA-MAN-02: 불러온 전표의 진행상태 변경

finish_step_button_tf가 있으면 complete_tf에 따라 complete/in_progress를 설정하며 없으면 complete를 설정한다. 별도 order_management 명령은 PROC_NO·PROC_STEP·PROGRESS 및 finish_type을 서버에 전달한다. 저장 준비 단계에 from_progress_status DMC를 합친다.

적용: 원본 연결과 진행상태 변경 의도를 단순 잔량 계산과 구분해 보관한다.

한계: 이 코드의 존재는 현재 회사 메뉴에서의 기본 체크값·권한·저장 성공을 입증하지 않는다. 실제 잔량 정책과 서버 갱신 결과는 관찰하지 않았다.

### REA-MAN-03: 시리얼 배분 수량과 전표불러오기 예외

일반 품목 입력은 serial_array.detail 요소의 qty를 합쳐 행 qty에 반영한다. is_trans_slip인 전표불러오기에서는 이 합계 적용을 바로 건너뛴다. 같은 품목의 시리얼 행과 비시리얼 행을 품목별로 합친 수량을 보호하는 주석과 조건이 함께 있다.

적용: 시리얼 배분 합계와 전표의 총 수량을 별개로 검증하고 불러오기에서 일부 시리얼 수량으로 전체 행 수량을 덮어쓰지 않는다.

한계: 정적 의미 추적의 동적 this 호출은 해소되지 않았다. qty의 소수점·시리얼별 한도·서버 저장 검증까지 확인한 것은 아니다.

### REA-MAN-04: 시리얼 존재 상태 및 품목 변경

serial_array.detail 존재 여부를 serial_tf에 반영한다. 품목이 삭제되면 관련 serial_array 등을 초기화하며 품목 코드가 바뀌고 이전 품목과 시리얼 사용 조건이 충족되면 이전 시리얼을 제거하는 분기가 있다. 사용하지 않는 품목의 serial_array.detail을 비우는 코드도 있다.

적용: 시리얼 배분이 다른 품목으로 잘못 이어지지 않게 품목 변경·사용 여부를 검증한다.

한계: 설정 기본값과 전체 품목별 예외는 외부 sourceData에 의존한다. 이 조건을 모든 원본 메뉴에 일괄 적용한다고 단정하지 않는다.

### REA-MAN-05: 호환 변환의 시리얼·창고·메일 상태 필드

ContractOutProcTransformUserAction 안의 호환 매핑은 상세 SERIAL_IDX→inv_m$serial_array, QTY→inv_m$qty, 헤더 WH_CD→inv_s$wh_cd, P_FLAG→inv_s$progress_status, SEND_FLAG→inv_s$mail_send_tf를 포함한다.

적용: 시리얼 배분은 구매 품목행과 연관된 값이며 업무 진행상태와 메일 상태를 별도 필드로 다루는 설계에 참고할 수 있다.

한계: 이 함수는 외주 변환 문맥의 부분 호환 매핑이다. 모든 구매·판매 API의 계약 또는 메일 실제 전송 성공 판정 규칙으로 사용할 수 없다.

### REA-MAN-06: 창고 변경 후속 처리 범위

창고 코드가 바뀌었는지 비교하고 io_type별 창고 VAT 속성을 골라 change_vat_rate_by_popup 기능을 호출한다.

적용: 창고 변경 시 세율 영향도 검토가 별도로 필요하다.

한계: 이 함수는 창고이동→판매의 출고창고 선택 규칙을 결정하지 않는다. 출고창고 정책을 이 함수에서 추론해서는 안 된다.

## 아직 확인하지 못한 내용

- 시리얼 기본수량·유효기한·원본전표 연결: 시리얼 배열과 수량 연결은 확인했지만 신규 시리얼 팝업의 기본수량 1/0, 유효기한, 개별 시리얼의 연결전표 저장 구조는 이 4개 공개 JS에서 확인하지 못했다. 문자열 미발견은 이카운트 전체에서 해당 기능이 없다는 증거가 아니다. 자산 자동 생성·감가상각 처리도 확인하지 않았다.
- 발주서 이메일 거래처 분리와 발송 상태: mail_send_tf 호환 필드 외 거래처별 수신 문서 분리·발송 성공·오류·재시도 구현은 선택한 소스에 나타나지 않았다. 원본 메일 발송을 실행하지 않았으며 메일 팝업 자산도 이번 허용 범위에 없다.
- 발주서 분개와 원가·재고 정책: 발주서 거래처·납기별 분개, 부분입고 잔량 정책, 이동→판매 소비 인식, 원가 평가, 실사·계속기록 산식의 전체 구현을 이번 13개 AST 조각만으로 해소하지 못했다. 전체 프로그램·서버 분석 또는 원본 저장 실행을 하지 않았다.

매뉴얼 72~76쪽 이미지는 구매 품목행의 시리얼 선택/배분, 기본수량, 유효기한과 시리얼 재고수불부의 연결전표를 설명한다. 이번 공개 자산 분석은 그 모든 필드의 저장·서버 정책을 확인하지 못했다. 사진의 실물 제조번호나 회사 업무자료를 코드·문서에 옮기지 않았다.

## 출처 위치와 재현

| AST 선언 | 공개 자산 파일 | 원본 줄 | UTF-8 바이트 범위 [start,end) |
| --- | --- | --- | --- |
| PostSetWareHouseProgram | inventory.5b28ea0e.js | 7071–7135 | 349640–352685 |
| SetProdDataInGridProgram | inventory.5b28ea0e.js | 8745–9207 | 439974–463395 |
| getNewMasterDataModel | inventory.5b28ea0e.js | 11711–11739 | 596136–597366 |
| OpenSelectSlipUserAction | inventory.5b28ea0e.js | 13620–14015 | 695703–719101 |
| ChangeSerialArrayUserAction | inventory.5b28ea0e.js | 15968–15975 | 835379–835801 |
| SubscribeProdUserAction | inventory.5b28ea0e.js | 16927–17015 | 890557–895141 |
| ChangeLoadSlipStatusUserAction | inventory.5b28ea0e.js | 17752–17770 | 937558–938682 |
| getPropsMapByTransform | inventory.5b28ea0e.js | 22912–23103 | 1233161–1246655 |
| SaveApiParamProgressStatusContributor | inventory.order_management.ff2d28de.js | 16–39 | 926–2002 |
| getApiOrderMngTransformData | inventory.order_management.ff2d28de.js | 1239–1273 | 59321–61081 |
| getNewMasterDataModel | inventory.order_management.ff2d28de.js | 1281–1309 | 61413–62671 |
| CompleteOrderManagementStepUserAction | inventory.order_management.ff2d28de.js | 2171–2196 | 104426–105665 |
| OrderManageValueChangeUserAction | inventory.order_management.ff2d28de.js | 2636–2746 | 124406–130291 |

원본 URL·SHA-256, UTF-16 문자 범위, UTF-8 바이트 범위, 조각 SHA-256, focused 파일 위치는 JSON에 보존했다. 소스 본문·raw REA 기록은 배포하지 않는 `.artifacts/manual-rea-*`에만 있다.

실행 절차는 private `manual-rea-download.cjs`, `manual-rea-extract.cjs`, `manual-rea-trace-inputs.cjs`, `manual-rea-report.cjs`에 있다. 본 분석 명령은 다음과 같다.

```text
npx.cmd --yes rea-agents@6.4.0 analyze-javascript-application .artifacts/manual-rea-focus --artifact-format directory --max-heap-mb 4096 --analysis-timeout-ms 45000 --format json
```

## 분석 범위

REA는 7,957개 AST 노드를 방문했고 application graph 13개 노드·12개 간선, semantic graph 5,301개 노드·3,360개 관계를 만들었다. semantic unknown은 2,112개이며 범위 상태는 unknown/partial이다. 전체 번들을 분석하거나 런타임 호출을 관찰했다고 주장하지 않는다.

추가 feature trace는 export 노드 1개만 도달했고 메서드 호출과 매핑 함수의 semantic trace도 각 함수 1개와 동적 unknown을 반환했다. 따라서 이 trace를 전표불러오기 전체 호출 경로를 입증하는 근거로 쓰지 않는다. 직접 읽은 AST 조건과 REA가 보존한 위치·노드 식별을 함께 제시한다. trace Evidence와 결과 범위는 JSON에 구분해 기록했다.
