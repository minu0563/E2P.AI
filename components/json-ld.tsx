/** 구조화 데이터(JSON-LD). 고정 값으로 만든 JSON만 넣는다(사용자 입력 금지). "<"는 이스케이프해 script 태그를 닫지 못하게 한다 */
export function JsonLd({ data }: { data: unknown }) {
  if (!data) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
