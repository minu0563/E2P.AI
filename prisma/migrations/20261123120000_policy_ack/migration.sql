-- 첫 생성 전 이용약관·허용 정책 확인 (약관 버전별, 바뀌면 다시 확인)
ALTER TABLE "User" ADD COLUMN "policyAckVersion" TEXT;
ALTER TABLE "User" ADD COLUMN "policyAckAt" TIMESTAMP(3);
