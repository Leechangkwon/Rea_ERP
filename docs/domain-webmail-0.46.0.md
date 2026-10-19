# REA 자체 웹메일 · 0.46.0 / 0.46.1

사용자가 회사 도메인의 송수신과 ERP 메일함 추가 개발을 요청했다. 이 기능은 독립 구현이며 원본 ECOUNT의 메일 서버·웹메일과의 전체 동등성을 선언하지 않는다. 기존 Gmail 발주서 경로와 계정·설정·전표·브라우저 자료를 보존한다.

## 사용

상단 메일 버튼 또는 Self-Customizing → Webmail설정 → REA 메일함 열기로 진입한다. 받은편지함·보낸편지함·임시보관함·스팸함·휴지통을 선택하고 검색·페이지 이동·읽음 표시·회신·이동/복원을 사용할 수 있다. 본문은 텍스트로 표시해 외부 이미지나 HTML 스크립트를 실행하지 않는다.

메일 쓰기에서 받는 사람·참조·숨은참조·제목·본문을 입력한다. 수신자는 합계 20명, 첨부는 합계 3MB 이하이다. 임시 저장을 누르면 서버에 보관된다. 저장한 초안은 휴지통으로 이동하고 복원해 다시 작성할 수 있다. 발송 내용 확인 후 수신자/첨부 확인을 체크하고 메일 발송을 눌러야 외부 전송을 시도한다. 같은 요청은 한 번만 시도하며 서버 접수·실패·결과 확인 필요를 구분한다. 접수는 최종 수신/열람의 증거가 아니다. 결과가 불명확하면 재전송 전에 보낸편지함과 메일 제공자의 기록을 확인한다.

발주서조회 → 전표 선택 → Email → 자체 메일함에서 작성으로 같은 거래처의 전표를 첨부할 수 있다. 작성한 메일에는 해당 시점 전표 스냅샷과 연결 ID를 보관한다. PDF 확인은 최초 저장 전에도 가능하며 이때 메일 초안이 저장된다. 기존 발주서 자체를 수정하거나 진행상태를 변경하지 않는다.

관리자는 메일함 관리에서 주소·발신 서비스·구성원을 등록한다. 직원의 권한그룹에 mail.read/mail.write를 부여한 뒤 메일함 구성원으로 지정한다. mail.manage는 설정 관리용이며 메일 본문 접근을 자동 허용하지 않는다. 관리자도 본문을 읽으려면 구성원이어야 한다. 기존 Webmail ID 연결 설정과 역할을 자동 변경하지 않는다.

Gmail 제공자는 해당 Gmail 주소로 발신하는 경로이다. 개인 Gmail의 기존 받은/보낸편지를 동기화하지 않는다. 회사 도메인 수신은 Cloudflare Email Worker → Supabase 전용 Edge ingress → 비공개 저장소를 사용하므로 로컬 PC 종료 중에도 저장할 수 있다. 현재 Cloudflare 플랜의 활성화 상태는 evidence/domain-webmail-20261019.json에서 별도로 확인한다.

## 저장과 권한

rea_mailboxes·rea_mail_messages·rea_mail_ingress_keys는 기존 ERP 상태와 별개이며 기존 계정/회사/역할을 이관하거나 덮어쓰지 않는다. RLS를 켜고 PUBLIC/anon/authenticated의 테이블 권한을 철회한다. 기존 ERP 세션과 서버의 메일 권한/구성원 검증을 통과한 요청만 서비스 키로 접근한다. 첨부는 private rea-mail-files bucket에 보관하고 ERP가 구성원 권한 확인 후 다운로드를 중계한다. 브라우저에는 저장 키나 서버 키를 반환하지 않는다.

Edge ingress는 전용 32바이트 임의 토큰의 SHA-256을 서버 전용 테이블과 대조한 뒤 원문을 읽는다. Cloudflare에는 수신 전용 토큰만 등록하며 Supabase 서버 키를 전달하지 않는다. MIME 8MB·본문 64,000자·첨부 10개/6MB 제한, 비활성/미등록 메일함 거부, 원문 해시 기반 중복 방지, 저장 결과가 불명확할 때 기존 첨부를 삭제하지 않는 처리를 적용한다. 수신은 발주서 상태 변경이나 자동 구매 처리를 수행하지 않는다.

## 설정과 실행

운영은 기존 WSL·Supabase·Cloudflare 구성이고 자동 시작을 추가하지 않는다. prepare-webmail.cjs --domain <소유 도메인>은 새 메일함·비공개 bucket·별도 수신 토큰만 준비한다. 토큰은 /home/lck/.config/rea-erp/mail-ingress.key(600)에 저장하며 runtime.env의 기존 값을 바꾸지 않는다. 메일 본문·첨부·쿠키·토큰을 로그나 소스에 저장하지 않는다.

새 메일 스키마는 Supabase CLI 2.121.0 migration new로 생성한 supabase/migrations의 SQL이다. Edge 함수 소스는 supabase/functions/rea-mail-ingress/index.ts, MIME 모듈은 고정 postal-mime 4.0.11이다. verify_jwt=false는 전용 토큰으로 선행 인증하는 외부 수신 경로에만 적용한다.

npm run configure:domain-mail에서 인증된 도메인과 Cloudflare Email Sending 전용 API 토큰을 숨김 입력한다. smtp.mx.cloudflare.net:465/TLS 1.2 이상으로 인증만 확인한 뒤 runtime.env(600, 부모 700)에 저장하고 Gmail·Supabase·포트·공개 주소 설정을 보존한다. 기존 Gmail 발송은 유지하며 Email 창을 다시 열면 새 설정을 사용한다. npm run mailbox:check는 저장소·익명 수신 차단·설정된 도메인 SMTP 인증을 검사하며 메일을 보내지 않는다.

Cloudflare에서 확인한 현재 플랜은 Workers Free이다. 공식 안내/실제 화면상 외부 거래처 도메인 발송은 Workers Paid(월 US$5 기본+초과 사용량)가 필요하다. 새 유료 구독·약관 동의·발신 토큰 생성/저장과 실제 외부 발송은 별도로 완료 여부를 기록한다. 기존 qaredi.com/rea.qaredi.com Tunnel과 DNS 레코드를 임의 교체하지 않는다.

## 백업과 복구

기존 ERP 백업·초기화는 기존 업무 범위를 유지한다. 메일은 npm run mailbox:backup으로 별도의 사용자 전용 폴더(700), 자료/첨부 파일(600), SHA-256 manifest에 저장한다. --verify <폴더>로 변조·누락·경로·자료 구조를 검사한다. --restore <폴더>는 미리보기이며 기본적으로 쓰지 않는다. --apply-add-missing을 함께 지정해도 기존 자료와 충돌하면 쓰지 않고, 없는 메일함/메일만 추가한다. 기존 메일을 덮어쓰거나 삭제하는 복원은 제공하지 않는다. 부분 실패 후에는 미리보기를 다시 실행해 추가된 범위를 확인한다. 인증정보는 메일 자료 백업에 포함하지 않고 사용자 전용 설정을 따로 보존한다. 휴지통/스팸 이동은 복원 가능하며 영구삭제는 제공하지 않는다.

## 검사 구분

Node/SQLite와 localhost 브라우저의 SMTP/수신 자료는 합성 자료이다. 실제 Supabase 스키마·비공개 Storage·Edge 인증 검사, 운영 UI, 실제 외부 송수신은 각각 evidence/domain-webmail-20261019.json에 구분한다. 기존 Gmail SMTP 인증은 이전 근거를 보존하며 자체 도메인 발신 완료로 바꾸지 않는다.
