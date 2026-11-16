# E2P.AI

Everything to Prompt — 이미지와 짧은 요청으로 영상 모델용 프롬프트를 만든다.

## 로컬 실행

```bash
docker compose up -d          # Postgres
cp .env.example .env.local    # 값 채우기
npx prisma migrate deploy
npm run dev
```

비공개 저장소(시스템 프롬프트·안전 엔진)를 `system/` 에 클론해야 빌드된다.

## 구조

```
웹(Next.js, Cloudflare Workers 대상) → 추론(Workers AI / 로컬 Ollama)
```

- 생성은 요청 하나 안에서 끝까지 처리하고, 진행 단계와 결과를 스트림(NDJSON)으로 보낸다.
- 이미지는 브라우저에서 줄여 보내고, 서버는 검증만 한다. 원본은 저장하지 않는다.
- 속도 제한·동시 요청 제한은 Postgres의 원자적 쿼리로 처리한다.
