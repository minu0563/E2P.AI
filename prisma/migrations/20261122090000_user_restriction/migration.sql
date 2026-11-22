-- 연속 차단에 따른 생성 일시 제한 (이 시각까지 생성 불가)
ALTER TABLE "User" ADD COLUMN "restrictedUntil" TIMESTAMP(3);
