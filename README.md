# Invest Hub MVP

토스증권 Open API 우선 연동 구조와 CSV/XLSX 업로드를 갖춘 멀티 증권계좌 통합 포트폴리오 SaaS MVP입니다.

## 빠른 실행

```bash
npm install
copy .env.example apps\api\.env
copy .env.example apps\web\.env.local
docker compose up -d
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev
```

웹: http://localhost:3000  
API: http://localhost:4000

데모 로그인:

- 이메일: `demo@investhub.kr`
- 비밀번호: `demo123`
