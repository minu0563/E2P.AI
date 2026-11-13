import { lang } from "next/root-params";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "./config";
import en from "./dictionaries/en";
import ko, { type Dictionary } from "./dictionaries/ko";

const DICTS: Record<Locale, Dictionary> = { ko, en };

/** 현재 요청의 언어 (app/[lang] 루트 파라미터) */
export async function getLocale(): Promise<Locale> {
  const l = await lang();
  if (!isLocale(l)) notFound();
  return l;
}

export async function getDictionary() {
  return DICTS[await getLocale()];
}

export { fmt, fmtDate, fmtNumber } from "./format";
export type { Dictionary, Locale };
