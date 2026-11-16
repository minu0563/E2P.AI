import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// 증분 캐시(R2 등)는 아직 쓰지 않는다. 공개 페이지는 빌드 때 정적으로 만들어 에셋으로 낸다
export default defineCloudflareConfig({});
