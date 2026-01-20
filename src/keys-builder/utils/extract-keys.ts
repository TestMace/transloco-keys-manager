import {
  Config,
  ExtractionResult,
  ExtractorConfig,
  FileType,
  ScopeMap,
} from '../../types';
import { initExtraction } from '../../utils/init-extraction';
import { devlog } from '../../utils/logger';
import { normalizedGlob } from '../../utils/normalize-glob-path';

export function extractKeys(
  { input, scopes, defaultValue, files, exclude = [] }: Config,
  fileType: FileType,
  extractor: (config: ExtractorConfig) => ScopeMap,
): ExtractionResult {
  let { scopeToKeys } = initExtraction();

  const fileList =
    files ||
    input.map((path) => normalizedGlob(`${path}/**/*.${fileType}`, { ignore: exclude })).flat();

  fileList.forEach((file) => {
    devlog('extraction', 'Extracting keys', { file, fileType });
    scopeToKeys = extractor({ file, defaultValue, scopes, scopeToKeys });
  });

  return { scopeToKeys, fileCount: fileList.length };
}
