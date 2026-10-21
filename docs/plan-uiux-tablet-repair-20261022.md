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
