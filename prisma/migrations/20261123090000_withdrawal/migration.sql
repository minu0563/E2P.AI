-- 탈퇴 표시 (행은 지우지 않는다. 보관 기간 뒤 정리 작업이 파기)
ALTER TABLE "User" ADD COLUMN "withdrawnAt" TIMESTAMP(3);
CREATE INDEX "User_withdrawnAt_idx" ON "User"("withdrawnAt");

-- 사용자 행을 지워도 생성 기록·문의가 같이 지워지지 않게 (기록이 남은 사용자는 삭제 자체를 거부)
ALTER TABLE "GenerationLog" DROP CONSTRAINT "GenerationLog_userId_fkey";
ALTER TABLE "GenerationLog" ADD CONSTRAINT "GenerationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Inquiry" DROP CONSTRAINT "Inquiry_userId_fkey";
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
