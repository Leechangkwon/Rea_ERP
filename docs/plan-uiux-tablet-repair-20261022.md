# 구매관리 태블릿 UI/UX 회귀 수정

사용자 첨부13271/13269 기준. 현재운영0.69.0/eb5515a에서도 실제index/app shell·864px 폭에서 동일원인을 재현했다. 기존자료/계정/양식/메일보존,원본ERP 조작없음. 수량/발주 흐름 개발보다 사용자신고수정을 우선한다.

## 원인과 수정범위 · 0.69.1

1. .entry-action-bar가 column flex로변했지만 inv-toolbar의 flex-wrap:wrap가남아 tablet grid 교차축계산에영향. 실제shell primary높이564px/버튼180~186px, 독립CSS사진유사280px 재현. column wrapper를nowrap로고정해 내용높이의44~50px버튼으로복구한다. percentheight만제거하는우회로해결되지않았음.
2. 현황header가 요청조회inv-request-head를공유해 legacy grid3→2cols 규칙에걸림. report전용class/검색행배치와제한된legacy selector로분리한다. 실제앱중복h2는한제목으로정리하고 빠른검색placeholder와현재F3열림상태를보존한다.
3. radio가 generic input width100%/flex1/28~42px를물려받음. 명시radio18px·label44px터치영역·가로모드선택으로복구한다. 납기기간은한쌍으로배치하고 검색(F8)/날짜단축키는일관된작업행으로정리한다.

기존검사는fake shell/min-height만확인해과대높이/현황누락을놓쳤다. 실제index/app shell과390/768/864/980/1024/1280폭·긴viewport에서5입력/4현황, 상한높이·동일행·overflow·라디오18px·모드변경/검색/F3·My품목/안전재고·값/문서/양식보존을검사한다. 합성브라우저전후이미지를저장하고사용자첨부규격과시각대조한다.

코드소유: dist/inventory.css,dist/purchasing-report-ui.js,tests/browser/purchasing-uiux.spec.cjs,기존purchasing-responsive.spec.cjs의검증상한. CSS/DOM구조만수정하며업무코어/데이터스키마/저장양식변환없음. 독립검토후운영0.69기반격리후보전체검사/commit/push/기존WSL·Supabase·Cloudflare반영·보존대조. mainVAT5루트빌드설치금지.

## 구현·독립 검토

column flex nowrap·요청 fallback 한정·report 검색행/모드/필터/작업행을 적용했다. 보고서 입력/선택은44px(데스크톱36px), radio18px/label44px로 분리했다. 신규 실제 app shell 검사는7개 폭/높이 조합×9화면과 My품목/안전재고 메뉴·미저장 납기 보존을 포함한다. 기존 조회 max height는 모바일2행 텍스트64px/나머지56px, 입력보조는56px 상한이다. readonly 참조를 수정하려던 fixture는 편집 가능한 납기일로 바로잡았다. 독립 검토에서 차단 회귀없음, print/hidden·기존핸들러 유지 확인.

## 반영 완료

사용자 첨부13271/13269의 거대 입력 버튼·어긋난 현황 검색·큰 라디오를0.69.0 실제 app shell에서 재현했다. 원인은 column flex에 남은 wrap, report로 누출된 요청조회 fallback grid, radio에 적용된 일반 input 너비/높이였다. nowrap·요청 selector 한정·report 전용 검색행/모드/44px 컨트롤과18px radio로 수정했다. 날짜쌍/검색작업행·중복 보고서 제목도 정리했다. CSS/DOM 변경으로 업무계산/스키마/자료/저장양식 변환은 없다.

이전 minimum-only/preview-shell 검사는 이 오류를 놓쳤다. 신규 실제 index/app shell 검사는5입력·4현황×7폭/높이=63화면 조합, 높이상한·동일 검색행·radio18px·overflow·F3/F8/집계·My품목/안전재고·미저장 납기/탭·자료/양식보존을 포함한다. 신규 browser8/관련Node119, 운영0.69기반 분리후보 전체 verify:local·브라우저78 통과. REA6.4 자체 report3파일 parse0/partial false·원본 동등성 추정없음. 독립검토 차단회귀없음.

release/0.69.1-tablet-uiux / 01932d7, 소스8f53c4d를 push 후 기존WSL·Supabase·Cloudflare에 반영했다. 기존로그인 유지, 운영700px에서 입력44~49.6px·검색44px 같은행·radio18px·F3/집계전환을 확인했다. 휴대폰/태블릿 폭 합성 검증과 운영내장브라우저 확인이며 실제 Android 재시험은 미완료다. 운영업무/설정 저장·인쇄·발송·복원없음.

브라우저8전표/전체JSON·양식 byte 동일, fresh 서버app30/gateway0 본문·수정번호/비공개설정·메일3함8통1첨부 전후동일. 근거 evidence/purchasing-uiux-tablet-20261022.json, manifest .artifacts/uiux-tablet-repair-20261022/candidate-manifest.json. bundleSHA efd809772b6b6ffd1ff0ae40827b766b8bfb648dd3b136db00e7edb6aa7e6374, 롤백0.69.0보존, 런타임33897 KEEP ALIVE. mainVAT5 빌드금지.

본문15/요구사항25/전체합격0은변경없음. 모아마지막저장·재조회0.51.0/49갱신로컬대기, 인증변화없는반복검사없음. 이번UI회귀수정은새매뉴얼항목합격으로세지않는다.

UI/UX 신고 수정0.69.1은 배포·보존 검증을 마쳤으므로 같은 버튼 검사를 새 개발량으로 반복하지 않는다. 다음은 발주계획조회 건별/전표별 전환을 원본의 실제 조회 결과와 SEARCH_TYPE/SUM_FLAG 및 NumberChk 숨김 분기로 대조해 차이표를 만든다. 자체 현재 라인목록과 전표별 표시·합계·선택 단위 차이를 확인한 뒤 검증된 범위만 구현한다. 웹자료올리기는 회사별 Flow/setup/dataModel·묶음/필수/부분실패·재시도 계약을 추가 확보할 때 재개하며 날짜+순번으로 추정하지 않는다. 미확인 요청의 전체계획 합산 제외는 원본 근거가 없는 대기문구였으므로 확정 요구사항으로 쓰지 않는다. 이미 보완한0수량 검색 검사를 새 개발량으로 반복하지 않는다. VAT5·상이단가/전체적용·부서/직위/직책·직접음수/환불·회계/일괄인쇄·원본작업탭 동등성은 미완료다.
