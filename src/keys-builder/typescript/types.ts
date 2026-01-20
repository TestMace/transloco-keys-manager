export type TSExtractorResult = {
  key: string;
  lang: string;
  params: string[];
  defaultValue?: string;
  isExtractedDefault?: boolean;
}[];
