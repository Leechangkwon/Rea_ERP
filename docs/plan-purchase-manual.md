# 구매실 매뉴얼 기반 재현

기준 소스 0.6.5 / 8d4f889ff52c8c0530cddc81c63ce2f0ec9625fc. 사용자 지정 2024-06-12 매뉴얼은 실제 76슬라이드이며 목차 page와 실제 슬라이드가 어긋난다. 원문·이미지는 .artifacts/purchase-manual-20240612에만 보관하고 배포/소스 커밋에 포함하지 않는다. 업무 규칙과 실제 슬라이드 번호만 근거로 남긴다.

## 로드맵

요구 검토(8–9) → 발주요청 불러오기·계획(10–12) → 품목 구매처/납기일별 발주서(13–14) → 발주 메일 초안(15–16) → 오염/파손·품목·수량 검수(19) → 발주서 잔량 구매입고(20–24) → RACK(25) → 인가량 대비 층별 부족량/창고이동(26–32) → 이동 전표에서 판매(33–37) → 진료실 요청에서 이동/판매(38–42) → 수정/집계(43–45) → 공급사 명세·원장·전산 대사/구매확정/세금계산서 확인(46–52) → 품의·증감/품목 분석(53–60) → 실사식/계속기록 수불·보고(61–64) → 일/주/월 체크(65–70) → 자산대장/표식/현황(71–76).

## 소유 범위

- operations worker: dist/inventory-core.js, dist/entry-core.js, tests/purchase-operations.cjs. 요청→이동, 이동→판매(입고창고를 판매창고로), 부분 반품/교환 입고, 원본/잔량/재고/채무/기간 잠금의 일관성. 다른 파일은 수정하지 않고 필요한 통합을 루트에 보고한다.
- purchasing worker: dist/purchase-room-core.js, tests/purchase-room-core.cjs. 독립 순수 업무 상태/검수/RACK/발주메일/대사/확정/세금계산서/월보고/수불/자산/일정 체크. UI는 루트가 작성한다.
- root: UI, 원본 화면 직접 관찰과 REA, 통합·API 매뉴얼·시뮬레이션·Page·검증·같은 비공개 사이트 배포.
- manual analyst: .artifacts/purchase-manual-20240612/requirements.json만 작성.

## 구매실 모듈 계약

PurchaseRoomCore는 Node require 및 browser global을 제공한다. InventoryCore를 최상위 require하지 않고 필요한 함수에 C를 인자로 받는다. exports: empty(), validateStore(store,db,C), command(db,payload,C)->{store,result}, periodSummary(db,filters,C), reconcile(db,filters,rows,C), assetReport(store,filters), cadence 등. 세부 export는 작업자가 보고한다.

저장 위치 db.settings.purchaseRoom (없으면 empty와 동등, version 1). command payload는 {action, ...fields}. 인벤토리 코어는 `purchaseRoom` 명령에서 반환 store를 같은 DB 복사본에 보관한다. 설정 검증은 모듈이 있을 때 validateStore를 호출하며, 없는 이전 fixture에서도 빈 설정 백업은 호환한다. 마감은 closings [{id,month:'YYYY-MM',warehouse,status:'closed'|'open',...}]로 나타낸다. 차이가 남은 대사는 확정 불가. 세금계산서는 외부 발행 대신 요청/수령/확인 기록. 외부 메일·회계·전자결재는 실제 송신과 구분해 초안/내보내기를 완성한다.

## 검증

합성 전표/거래처/창고로 단계별 핵심/DOM 검사를 수행한다. 실제 구매·메일 발송·세금계산서 발급은 하지 않는다. 입력→연결→부분입고→반품/교환→이동→판매의 재고·잔량·채무, 월말 금액 대사(불일치/수정/일치), 두 수불 방식, 자산 이력, 백업 왕복을 검증한다. 원본 공개 코드 분석은 관찰·추론·미확인을 구분한다. 마지막으로 버전 올림, npm test, check-release, build, 소스 helper 패키지/배포, 관리 Page 및 로드맵 Page 갱신을 수행한다.
