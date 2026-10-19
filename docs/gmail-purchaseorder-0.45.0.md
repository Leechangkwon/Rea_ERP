# 발주서 Gmail 이메일 · 0.45.0

발주서 조회에서 같은 거래처의 확인된 발주서를 선택하고 Email을 누른다. 받는 이메일·제목·본문을 작성하고 PDF 확인 버튼으로 첨부 내용을 확인한다. 발송 내용 확인에서 수신자/첨부 확인을 체크한 뒤 Gmail로 발송을 누르면 실제 발송을 시도한다. 앱의 기본 PDF 양식이며 원본 ECOUNT 이메일/인쇄 양식과 동등하다는 뜻은 아니다.

Gmail 접수는 SMTP 서버가 접수했다는 뜻이다. 최종 수신·열람은 확인하지 않는다. 실패와 결과 확인 필요를 구분하며, 같은 요청 ID는 재전송하지 않는다. 연결이 끊기거나 결과 이력을 확정하지 못하면 Gmail 보낸편지함을 먼저 확인한다. 실제 발송한 뒤 전표를 변경하면 목록은 변경 후 미발송으로 표시한다. 메일 발송은 전표 진행상태나 기존 구매실 미발송 초안을 자동 변경하지 않는다.

## 서버 연결

운영은 기존 로컬 WSL·Supabase·Cloudflare 구성이다. Node 서버에 nodemailer 10.1.7/PDFKit 0.20.2와 assets/mail-font의 고정 Noto CJK 글꼴/라이선스가 필요하다. 비밀번호는 /home/lck/.config/rea-erp/runtime.env(600, 부모 700)의 REA_GMAIL_USER/REA_GMAIL_APP_PASSWORD로만 저장한다. 브라우저·DB·소스에는 인증정보를 넣지 않는다. Worker에는 SMTP 비밀번호 대신 Node의 전송 함수만 전달한다. Gmail 계정은 고정 SMTP smtp.gmail.com:465와 TLS로 연결한다.

사용자가 직접 WSL에서 npm run configure:gmail을 실행하거나 Windows 진입 폴더의 Configure-Rea-Gmail.cmd를 연다. Gmail 주소와 Google 앱 비밀번호를 숨김 입력한다. 일반 Google 비밀번호를 입력하지 않는다. 구성기는 SMTP 인증만 검증하고 메시지를 발송하지 않으며, 기존 저장소 설정을 보존해 원자적으로 저장한다. SMTP 인증 실패 또는 동시 설정 변경 시 덮어쓰지 않는다. 설정 후 Email 창을 다시 열면 반영되고 ERP 재시작은 필요 없다. npm run gmail:check도 인증만 확인한다.

Google 계정에서 앱 비밀번호 생성은 사용자가 직접 진행한다. 2단계 인증이 필요하고 일부 조직 정책/보호 설정에서는 제공되지 않을 수 있다. 공식 안내: https://support.google.com/accounts/answer/185833 . 앱 비밀번호의 값은 채팅이나 인계 문서에 남기지 않는다.

## 앱 내부 API

| 경로 | 권한/동작 |
|---|---|
| GET /api/mail/status | 직원 로그인·inventory.read. 구성 여부/발신 주소만 반환 |
| GET /api/mail/history | 같은 사용자 발송 메타데이터만 반환 |
| POST /api/mail/pdf | inventory.write·동일 Origin·CSRF. 구조화 발주서 1건의 PDF 반환. SMTP 불필요 |
| POST /api/mail/send | 위 조건과 confirmed=true·UUID requestId. 같은 거래처 1~20전표/최대1,000행/첨부8MB. 중복 ID·내용 충돌·재접수 방지 |

일반 API 키만으로 발송할 수 없다. 수신자는 단일 이메일이며 임의 HTML·파일경로·외부 URL을 첨부하지 않는다. app_state의 선택적 mailDeliveries에 사용자/요청 해시·발신/수신·제목·전표 ID/해시·상태·시각만 남긴다. 본문/PDF는 ERP에 별도 보관하지 않는다. CAS 예약 후에만 SMTP를 호출하고 발송 직전 권한을 재확인한다. 최대500개 기록을 보관하고 한 사용자당 분당10건을 제한한다. 기존 계정/브라우저 업무자료/API 업무영역은 대체하지 않는다.

합성 검사와 실제 Gmail 인증/실제 발송은 구분한다. 최신 상태: evidence/gmail-purchaseorder-20261019.json. 실제 발신 자격증명 연결 전에는 실제 발송 완료로 기록하지 않는다.
