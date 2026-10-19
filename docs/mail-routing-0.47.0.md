# REA 메일함 자동 수신 연결 · 0.47.0 / 0.47.1

기존 메일함을 선택해 주소·이름·사용 여부·구성원을 저장하면, 연결된 회사 도메인의 Cloudflare 수신 규칙을 자동으로 맞추고 결과를 표시한다. 고정된 qaredi.com과 rea-mail-ingress Worker만 사용하며 도메인 등록·DNS 변경·다른 앱 규칙·전체수신 규칙은 건드리지 않는다.

## 사용

Self-Customizing → 기타관리시스템 → Webmail설정 → REA 메일함 열기 → 메일함 관리에서 메일함을 선택한다. 주소 변경은 같은 메일함 UUID를 사용하므로 이전 받은편지·보낸편지·첨부·전표 연결이 남는다. 과거 메일의 발신/수신 주소는 당시 기록대로 보존한다. 이전 주소의 수신 규칙은 새 주소로 바뀐다.

저장 후 수신 연결됨을 확인한다. 연결 실패 시 저장/연결 결과를 구분해서 표시하며 수신 연결 다시 시도로 실제 규칙을 조회해 복구한다. 수신 연결 처리 중인 동시 저장은 차단한다. 사용 해제/다른 발신 서비스 전환은 소유한 규칙을 비활성화하고 삭제하지 않는다. 같은 주소의 다른 수신 규칙은 덮어쓰지 않고 충돌을 표시한다.

## 서버와 검증

서버는 기존 승인된 Wrangler OAuth를 공식 auth token 명령으로 갱신한다. 고정 Wrangler4.151.1을 실행 의존성에 포함한다. 자식 출력만 비공개로 읽고 WRANGLER_WRITE_LOGS=false로 인증값의 디스크 로그를 차단한다. 전역 키는 거부하며 브라우저/컴파일 파일/DB에는 토큰을 주지 않는다. 별도 서버용 routing token도 비공개 설정에서만 지원한다. 관리 권한과 CSRF를 확인하고 외부 반영 직전에 권한을 다시 확인한다. Supabase/SQLite의 route_sync에 작업ID·CAS/기한·연결 결과를 저장해 부분 실패/불명확 결과를 명시적으로 복구한다.

전체 verify:local·관련 Node65개·브라우저20개·릴리스4개가 통과했다. REA6.4의 자체 변경3개 파일 입력/결과 해시·근거·비부분 분석을 확인했고 원본86개 누계는 바꾸지 않는다. 현재 운영 반영/주소 변경 검증은 evidence/mail-routing-20261019.json을 따른다.

## Gmail 스팸 분류

현재 연결 계정의 qaredi.com 메일2통은 INBOX이며 SPAM 검색0건이다. 최근 test 메일의 SPF/DKIM/DMARC와 발신 IP의 정방향/역방향 DNS가 정상이다. 새 주소의 표시 이름과 Reply-To를 발신 주소에 맞춘다. 인증 통과만으로 Gmail 받은편지함 분류를 보장하지 않으며 Google은 발신 IP/도메인 평판 등도 고려한다. 사용자가 본 스팸 메일의 제목/수신 주소/이동 여부를 별도 확인 중이고 원인을 단정하지 않는다. Gmail 필터/허용목록을 자동 추가하거나 기존 편지를 이동하지 않았다.

공식 근거: https://support.google.com/mail/answer/81126 · https://developers.cloudflare.com/api/resources/email_routing/subresources/rules/ · https://developers.cloudflare.com/changelog/post/2025-12-18-wrangler-auth-token/
