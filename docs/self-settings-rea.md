# 기본값·설정 공개 코드 REA 조사

이 문서는 원본 공개 배포 JavaScript의 정적 근거만 기록한다. 화면 관찰 및 회사에 실제 적용된 값, 자체 구현과는 별도다. 원본 저장·삭제·설정 적용을 실행하지 않았고 원본 세션·쿠키·회사 자료를 복사하지 않았다.

## 실제 분석 입력과 방법

`rea-agents@6.4.0`의 `analyzeJavaScriptStaticSource`와 `analyzeJavaScriptSemantics`를 기존 `run-rea-inprocess.mjs`로 직접 실행했다. 대상 코드는 실행하지 않았다. CLI 애플리케이션 그래프나 REA Evidence ID를 생성한 결과가 아니며, 기존 CLI 프로세스 조회 오류를 우회했다고 주장하지 않는다.

| 입력 | 바이트 | SHA256 | AST / 함수 / 호출 / 동적 미확인 |
|---|---:|---|---|
| `.artifacts/self-original/defaults.js` | 24,330 | `d60a3b39cdd296aaae0ff8b885ac4c72521df861c13bca05d7485808a2038b7a` | 7,651 / 104 / 526 / 600 |
| `.artifacts/self-original/setupPage.js` | 746 | `88205d20042c05ec11669a836604dfa1a427aef474ad40f5ab03dbe12178c231` | 88 / 2 / 4 / 3 |

두 입력 모두 문법 분석 완료, 파싱 오류 0이다. 이것은 전체 제품 구조 분석 완료나 실행 시 연결 관계 확인을 뜻하지 않는다. 지역 호출·인수·반환·클로저는 정적 후보이며 동적 속성 및 함수 간 변경은 미확인이다.

원시 결과는 `.artifacts/self-rea-defaults/`, `.artifacts/self-rea-setupPage/`에 있다. `.artifacts/self-rea-findings.json`에는 각 분기와 REA callable ID, 원본 열 위치, UTF-8 바이트 범위, 조각 SHA256을 연결했다.

## 확인한 코드 역할

`defaults.js`는 `ecmodule.common.defaultValue`라는 **기본값 적용 시점의 해석기**다. 기본값 설정 화면 편집기나 저장 API 구현으로 볼 근거는 없다.

| 값 코드 | 코드에서 확인한 입력·처리 | 근거 함수·원본 1행 열 범위 |
|---|---|---|
| `LAST_SLIP` | 전달된 cookieKey와 programId, 항목 id, 마지막 전표 이름을 이용한다. 실제 쿠키는 읽거나 수집하지 않았다. | `f`, 343–946 |
| `BEFORE` | 현재 행의 바로 앞 행에서 복사할 코드·이름 열을 읽는다. | `e`, 949–1507 |
| `CUSTOM` | `Values.CUSTOM_VALUE`, `CUSTOM_NAME`을 코드·이름 열에 대응시킨다. | `o`, 1510–1922 |
| `RELATE_CUSTOM` | Options의 `UI_DEFAULT_VALUE`에 해당하는 사용자 값과 기본 사업장·프로젝트 이름을 참조한다. | `s`, 1925–2518 |
| `RELATE_CUST` | 거래처 코드, 관련 열 코드를 바탕으로 거래처 속성을 읽는다. | `h`, 2521–4005 |
| `RELATE_WH`, `RELATE_PJT` | 창고·프로젝트 속성을 참조한다. | `c`, 4008–5469 / `l`, 5472–6929 |
| `RELATE_PIC`, `RELATE_CARD` | 담당·카드 코드 관련 속성을 참조한다. | `a`, 6932–7998 / `v`, 8001–9031 |
| `RELATE_PROD`, `RELATE_EMP` | 전달된 품목·사원 관련 값을 해석한다. | `y`, 9080–10176 / `p`, 10179–10969 |
| `CALC`, `EC_CALC`, `BAL_AMT` | 전달된 계산식·잔액 설정을 처리하며 외화 등의 문맥에서 CALC 분기를 다르게 선택할 수 있다. | `w`, `b`, `k`, 10972–11533 |
| `TODAY` | 서버 날짜와 `DATE_ADJUST_TYPE`, `DATE_ADJUST`를 사용한다. `B`이면 이전 날짜 방향이다. | `d`, 11536–11847 |
| `DATE_CALC` | `DATE_COL_CD`로 전달된 날짜를 기준으로 일·주·월 조정을 한다. `YMD_ADJUST_TYPE`의 D/W/M에 따라 DAY, WEEK/WEEK_DAY, MONTH/DAY를 참조한다. | `g`, 11850–12641 |
| `RELATECODETYPE_NUM`, `RELATECODETYPE_TXT` | 관련 코드 종류와 정의된 열 경로에서 수치·문자 기본값을 읽는다. | `nt`, 12645–13325 / `tt`, 13329–14110 |

선택 순서는 입력 `Defaults`를 `DEFAULT_SEQ`로 정렬하는 디스패처에서 확인했다. `onlyTypeList`·`notTypeList`로 대상 분기를 제한하며 조건에 맞는 결과를 선택한다. **회사 기본값과 사용자 기본값 중 누가 우선하는지, 설정 화면에서 순서를 어떻게 저장하는지는 이 파일만으로 확인되지 않는다.**

`setupPage.js`는 `BizzConfigureSettingPage extends BasePage` 및 `IBizzConfigureSettingPage` / `IGetBizzConfigureSettingSetupProgram` 데코레이터 연결만 포함하는 746바이트 셸이다. 입력 항목·팝업·저장 구현은 들어 있지 않다.

## API 범위와 미확인 사항

확인한 `/SVC/Common/Form/GetLoadCustomerInfo`, `GetLoadLocationInfo`, `GetLoadProjectInfo`, `GetLoadPICInfo`, `GetLoadCardInfo`는 기본값 참조 자료를 불러오는 경로다. 공개 코드의 파라미터 이름만 조사했으며 실제 호출하지 않았다. 거래처의 경우 Request 안의 `BusinessNoKey.BUSINESS_NO`, `IoType`, `ACCT_CHK`, `SALE_CHK1`~`SALE_CHK4` 같은 문맥이 전달된다.

이 두 파일에서 설정 저장 경로·저장 파라미터·팝업 열기 호출·회사/개인 범위 저장 계약은 발견하지 못했다. 이 부재는 두 입력으로 제한된 검색 결과이며 전체 제품에 해당 기능이 없다는 뜻이 아니다. 해당 내용은 실제 UI에서 열린 설정 편집기·하위 팝업과 그 공개 모듈을 추가 관찰해야 확인할 수 있다.

기본값의 이름만 보고 버튼 위치·팝업 항목·저장 동작을 추정하여 구현하지 않는다. REA 해석기의 값 코드를 설정 화면 전체 명세로 취급하지 않는다.

## 추가 공개 모듈: 기능설정 트리와 진행상태 목록

같은 REA 6.4.0 직접 정적/의미 분석을 추가로 실행했다. 두 입력 모두 파싱 완료, 오류 0이며 대상 실행은 하지 않았다.

| 입력 | 바이트 | SHA256 | AST / 함수 / 호출 / 동적 미확인 |
|---|---:|---|---|
| `features.js` | 3,558 | `b54c9778b062fc64342e7b1e918aebb0e94efeb78a5738833f44c0988a1d8599` | 788 / 12 / 23 / 32 |
| `stateList.js` | 6,971 | `2d2ff56d50a183f0ac0126ced9de77927cc215516036334c38d27bc8e041554d` | 1,454 / 31 / 46 / 52 |

`features.js`의 XESC002M은 기능설정의 트리 목록 셸이다. 실제 항목과 설정값은 `ScCofsComnSettingItems`로 전달된다. `CATEGORY_ID`가 탭, `CATEGORY_RESX`가 트리 키, `COLUMN_ID`가 링크 항목, `SETUP_NM`과 `SETUP_VALUE`가 링크 이름·설정값 표시로 대응한다. 2·3단계는 접기/펼치기, 4단계는 링크·값 표시로 구성한다. quickSearch는 widgetTreeManager 검색에 위임한다. 이 파일만으로 실제 재고 항목 전체나 상세 팝업 경로를 복원할 수 없다.

| 기능 | 정적 근거 | 원본 1행 열 범위 |
|---|---|---|
| 트리 데이터·표시 구조 | `initProperties`, `getWidgetTree` | 511–1724, 1739–2566 |
| 탭별 권한 ID | Common은 특정 프로그램 외 E000120, Account E000101, Inventory E000104, Manage E000102, Groupware E000105, Korea E000103, DataCenter E000141 | 2715–3087 |
| 수정 권한 검사 | 현재 탭 Permission의 UPD/CAR 또는 Value W 조건을 확인한다. 실제 권한·서버 검증을 우회하지 않는다. | 3101–3555 |

`stateList.js`는 ESC001P_325 진행상태 설정 목록이다. 다음 연결은 공개 코드에서 확인됐지만 서버를 호출하지 않았다.

| 동작 | 코드에 있는 경로·데이터 | 근거 범위 |
|---|---|---|
| 목록 검색 | `/SVC/Common/TransCustomize/GetListScPrgsSetup` | 408–4275 |
| 사용/사용중단 | `/SVC/Common/TransCustomize/UpdatePrgsState`, `Request.Data` 배열의 각 `Data`에 `CALO_PRG_ID`, `CRE_PRG_ID`, `PRGS_STAT_SETUP_SNO`, `USE_TF`를 전달한다. USE_TF true/false가 활성·비활성 분기다. | 2486–2687, 3090–3291 |
| 신규 상세 | `/ECERP/SVC/ESC/ESC001P_325_01`, 400×300, `Request.EditMode` 신규 | 5606–5770 |
| 기존 상세 | 동일 팝업에 FROM/TO 프로그램 ID·이름, 설정 순번, `P_FLAG`, `DEFAULT_P_FLAG`, `PrevUrl`, 수정 EditMode를 전달한다. | 5932–6328 |
| 프로그램 검색 | TO 또는 FROM의 `CallMenuType`과 `EXCEPTION_FLAG: sc_inventory`를 전달한다. | 4955–5260, 5283–5488 |
| 사용 여부 검색 | 값은 전체 빈값 / Y / N이며 초기 선택은 Y다. | 4298–4464 |
| 상세 저장 후 목록 | 상세의 isSave 메시지에 따라 callback 후 목록 redraw 한다. 상세 저장 API는 이 목록 파일에 없다. | 6367–6516 |
| 삭제·Excel | 삭제 경로는 `DeletePrgsSateSetAction`, Excel 경로는 `GetListScPrgsSetupForExcelAction`이다. 임의 실행하지 않았다. | 408–4275 |

진행상태 상세 팝업의 실제 입력 선택지와 저장 검증·저장 API는 목록이 전달하는 필드만으로 추정하지 않는다. 추가 상세 파일 및 직접 화면 관찰이 필요하다. 기능설정 트리에서 보이는 품목 범위, 라인별/품목별, 조회/미현황 구분 등의 실제 값은 이 공개 트리 셸에 들어 있지 않으므로 root의 UI 관찰 근거와 분리해 관리한다.

## 추가 공개 모듈: 매핑센터

매핑센터는 관찰한 메뉴 간 전표 불러오기·생성의 매핑 설정이며, 외부 API 인증키 설정과 구분한다. 다음 세 공개 파일을 같은 정적 분석 방식으로 실제 처리했다. 파싱 오류는 모두 0이다.

| 입력 | 바이트 | SHA256 | AST / 함수 / 호출 / 동적 미확인 |
|---|---:|---|---|
| `mappingList.js` / TC101M | 6,163 | `77ebe1bdfac501b8be188a161f3244fa9085ce8046a31509f14062ed3c602da0` | 1,295 / 28 / 38 / 44 |
| `mappingEditor.js` / TC101P | 6,327 | `3f444d5cfc3bb459d37951dbd223174ab560b4c6981ee956a1594825eed93e81` | 1,504 / 26 / 146 / 146 |
| `mappingMenus.js` / TC108P | 4,186 | `3cdb739fe7a1b45062a900c99b22abf5e44cf3dc27e4ebc98c0c59d333cf6fcc` | 1,050 / 21 / 73 / 79 |

메뉴 쌍의 키는 `FROM_PRG_ID`, `TO_PRG_ID`, 목록의 설정 순번은 `MENU_MPPG_SNO`다. 목록 조회는 `GetListMappingCenterSetup`, 활성·비활성 변경은 `UpdateMappingState`를 사용한다. 변경 데이터는 `Request.Data[].Data` 아래 키 세 개와 `DEL_TF`이며 활성은 false, 비활성은 true로 작성된다. 사용 여부 검색은 빈값/N/Y이고 초기 선택 N이다. 삭제는 `DeleteMappingSet` 경로다. 실제 호출하지 않았다.

신규 TC101P는 fromMenu 선택 전 toMenu를 숨기고, fromMenu에 값이 생기면 보여 준다. 양쪽 입력이 필수이며 동일 메뉴 쌍과 이미 존재하는 쌍을 거부한다. 메뉴 선택·자동완성은 FROM/TO의 `CallMenuType`과 선택 중인 양쪽 프로그램 ID를 전달한다. TC108P는 `GetListMappingCenterMenu`로 메뉴 목록을 조회하도록 정의되어 있으며 분류/메뉴명 및 선택 행의 `INPUT_PRG_ID` 등을 부모로 전달한다.

**신규 팝업의 저장/F8은 화면 이동만 하는 버튼이 아니다.** 코드 순서는 검증 → `SaveMappgMain` 저장 → 부모 메시지 → 필드 매핑 편집기 열기다. 저장 데이터는 `Request.Data[].Data.SaveMain` 안의 `FROM_PRG_ID`, `FROM_PRG_NAME`, `TO_PRG_ID`, `TO_PRG_NAME`, `DEL_TF: "True"`다. 마지막 값은 원본의 문자열 그대로 기록한 것이며 의미를 추정해서 boolean으로 바꾸지 않는다. 원본 신규 저장을 실행하지 않았다.

기존 목록의 매핑설정 링크는 `/ECERP/SVC/Popup/TC101P_01`을 바로 열고 `FromPrgId`, `ToPrgId`, `FromProgramId`, `PrevUrl`을 전달한다. 이 1500×600 편집기의 필드 매핑 행 구조·필수값·저장 경로는 현재 세 파일에 없으므로 별도 파일과 UI 관찰이 필요하다. 메뉴 쌍의 생성 schema를 필드 매핑 schema로 혼동하지 않는다.


## 2026-10-23 매핑 필드편집기 조사 보완

기존 OpenPopupMappingCenterUserAction과 V56→V3 bridge의 새 범위로 TC101M 경로를 확인했다. 기존 목록의 TC101P_01과 modern IDeriveMappingSettingPage는 서로 다른 entry/identity/schema다. modern 공개 후보필터는 exact data_type, master/detail, 현재 source 제외를 사용하며 선택 취소는 행 변경 없이 돌아간다. modern 저장은 non_mapping 생략/same_item_meaning 목표만/item_mapping 양쪽 model/prop이고 서버 wrapper의 success 뒤 닫는다. 이를 TC101P_01 또는 자체 fieldLinks의 동등성 근거로 쓰지 않는다.

TC101P_01 실제 소스/분리창은 미확보다. 기존 페이지명과 공개 version token에서 도출한 미관찰 asset URL1회가403이어서 중단했으며 실제파일 존재·권한/인증 결함으로 단정하지 않는다. 신규6scope REA6.4 parse0·coverage unknown/truncatedfalse, 원본실행/전체모듈/서버 동등성 미확인. 필드편집기 비활성·운영0.82 유지. 근거 `evidence/manual-mapping-editor-research-20261023.json`.
