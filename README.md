# E2P.AI

Everything to Prompt — 이미지와 짧은 요청으로 영상 모델용 프롬프트를 만든다.

## 로컬 실행

```bash
docker compose up -d          # Postgres + Redis
cp .env.example .env.local    # 값 채우기 (QUEUE_SECRET 생성 방법은 파일 안에)
npx prisma migrate deploy
npm run dev:all               # 웹 + 생성 워커
```

비공개 저장소(시스템 프롬프트·안전 엔진)를 `system/` 에 클론해야 빌드된다.

## 구조

```
웹(Next.js) → 큐(Redis, BullMQ) → 워커(worker/) → 추론(Ollama 또는 OpenAI 호환 API)
```

- 생성 요청은 큐에 들어가고, 화면은 `/api/generate/[id]` 로 진행 상태를 받는다.
- 이미지는 암호화해 메모리 전용 Redis에 잠시 두고, 워커가 꺼내는 즉시 지운다. 원본은 저장하지 않는다.
