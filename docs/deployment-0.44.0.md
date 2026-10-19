# 0.44.0 구매 조회 검색 보완

운영 주소: https://rea.qaredi.com · 배포 소스: 9e0566e (기능 1d445dc). 기존 로컬 WSL 서버·Supabase·Cloudflare Tunnel 구성을 유지했다. 수동 시작/종료는 기존 docs/deployment-0.43.0.md와 Windows wsl-setup/Start-Rea-ERP.ps1을 따른다. 자동 실행은 추가하지 않았다.

발주요청·발주계획·발주서·구매 조회에서 원본에 표시된 검색 조건과 F3/F8 차이를 보완했다. 운영 정적 파일의 이전 4시간 캐시를 확인해 빌드 시 모든 HTML JS/CSS 주소에 package 버전을 자동 붙인다. 전체 verify:local(브라우저 8개 포함)과 후속 캐시/인증/런타임 56개가 통과했다.

운영의 기존 로그인 유지, 네 조회 검색 조건, 계획 F3/F8과 미인증 경계를 확인했다. 운영 계획 목록은 빈 상태였고 실제 업무 전표를 만들지 않았다. Supabase app_state/gateway_state 본문·수정 번호는 재시작 전후 동일했다. 사전 백업은 사용자 전용 ~/.local/share/rea-erp/backups/purchasing-0.44.0-*에 권한 700/600으로 보관한다. 원본 SQLite와 0.43.0 이관 백업도 유지한다.

되돌릴 때는 직전 기능 소스를 별도 작업 폴더에서 빌드하고 기존 관리 서버를 재시작한다. 캐시 주소 버전 보완은 유지한다. 코드 복구 때문에 저장 자료나 현재 Supabase 설정을 과거 SQLite로 덮어쓰지 않는다. 이번 변경에는 스키마/자료 이관이 없다.

관찰·자체 규칙·REA 한계와 남은 차이는 docs/plan-purchasing-search-20261019.md 및 evidence/purchasing-search-round2-20261019.json을 따른다. 계획 조회 묶음/수량 기준과 원본 비공개 서버·발송·출력은 동등성 미확인이다.
