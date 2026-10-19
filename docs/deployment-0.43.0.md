# 0.43.0 로컬 서버 · Supabase · Cloudflare 운영 전환

사용자는 2026-10-19 기존 계정과 자료를 보존하면서 운영 서버 전환, rea.qaredi.com 연결과 실제 로그인을 확인하도록 명시했다. 기존 자체 로그인과 권한을 유지하고 서버 상태를 같은 Supabase 프로젝트로 이관한다. Sites에는 배포하지 않는다. 현재 계정 비밀번호를 변경하거나 새 운영 계정을 만들지 않는다.

## 이관과 보존

기존 서버를 중지한 뒤 `npm run migrate:supabase -- --apply --project=bzyvdergqijwswnjvozs`를 실행한다. 이 명령은 원본 SQLite의 쓰기 잠금을 유지하며 사용자 전용 백업 폴더에 SQLite 원본과 기존 런타임 설정, 원격 상태를 백업한다. 두 대상 상태가 비어 있거나 완전히 같은 경우만 허용하고 원격 자료가 다르면 모든 쓰기 전 중단한다. 원본 계정 비밀번호 해시·설정·수정 번호·업무 본문을 그대로 복사한 뒤 읽어서 일치 여부를 확인한다. 기존 SQLite와 브라우저 자료는 삭제하지 않는다.

새 설정은 `REA_STORAGE=supabase`, 공개 origin은 `https://rea.qaredi.com`이다. 소스·빌드·문서에는 키나 비밀번호를 넣지 않는다. 원격 상태 백업과 DB는 개인 정보가 있어 공개 근거에 포함하지 않는다. 빈 로컬 gateway 상태가 없으면 이관 중 새 업무 자료를 만들지 않으며 앱의 정상 초기화만 사용한다.

## 수동 운영

실제 소스는 `/home/lck/projects/Rea_ERP`다. Windows `wsl-setup/Start-Rea-ERP.ps1`로 수동 시작하고 기존 Linux `~/.local/bin/rea-erp-dev stop`으로 종료한다. `npm run cloudflare:check`가 Supabase 관리자와 실행 중인 백엔드를 확인한 뒤 Windows `Start-Rea-Cloudflare.cmd`로 `rea-erp-local` 터널을 수동 실행한다. 자동 시작·다른 앱 터널 변경은 없다. PC/WSL/터널을 종료하면 외부 접속도 중단되며 Supabase의 저장 자료는 남는다.

## 실패 시 복구

DNS 전환 전 기존 CNAME과 TTL을 근거에 보관한다. 기존 값은 `rea.qaredi.com CNAME custom-domains.chatgpt.site`, 관찰 TTL 300이다. 기존 Sites의 인증 없는 응답은 403이었으며 정상 업무 버전으로 검증된 것은 아니다. 필요하면 Cloudflare DNS 화면에서 해당 CNAME 값과 TTL로 복구하고 REA 전용 터널만 종료한다.

외부 공개 뒤 새로 저장한 자료가 있다면 과거 SQLite로 바로 전환하지 않는다. 먼저 서버·터널을 멈추고 최신 Supabase 상태를 별도 개인 백업에 보관해 수정 번호와 차이를 확인한다. 이관 직후 새 수정이 없는 경우에만 백업의 `runtime.before.env`를 원래 런타임 설정 위치(600)로 복원하여 기존 SQLite 서버를 수동 시작한다. 어느 복구에서도 원격 자료를 자동 삭제하지 않는다.

## 검증

배포 전 전체 로컬 검사와 릴리스 검사·빌드, 브라우저 합성 검사를 실행하고 커밋을 원격 저장소에 올린다. 외부 주소에서는 HTTPS와 현재 버전·최초 관리자 등록 차단·로그인 전 업무 접근 차단, 기존 계정 로그인과 새로고침 후 인증 유지를 별도로 확인한다. 비밀번호가 필요한 최종 로그인은 기존 비밀번호 입력이 있어야 입증된다. 계정 해시 이관 검사만으로 실제 로그인 성공을 선언하지 않는다. 결과는 `evidence/deployment-local-supabase-cloudflare-20261019.json`과 현재 인계에 기록한다.
