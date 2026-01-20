import { tsquery, ScriptKind } from '@phenomnomnominal/tsquery';

import {
  Config,
  ExtractionResult,
  ExtractorConfig,
  ScopeMap,
  Scopes,
} from '../../types';
import { readFile } from '../../utils/file.utils';
import { regexFactoryMap } from '../../utils/regexs.utils';
import { addCommentSectionKeys } from '../add-comment-section-keys';
import { addKey } from '../add-key';
import { extractKeys } from '../utils/extract-keys';
import { resolveScopeAlias } from '../utils/resolvers.utils';

import { epSignalExtractor } from './ep-signal.extractor';
import { inlineTemplateExtractor } from './inline-template';
import { markerExtractor } from './marker.extractor';
import { pureFunctionExtractor } from './pure-function.extractor';
import { serviceExtractor } from './service.extractor';
import { signalExtractor } from './signal.extractor';

export function extractTSKeys(config: Config): ExtractionResult {
  return extractKeys(config, 'ts', TSExtractor);
}

const translocoImport = /@(jsverse|ngneat|testmace)\/transloco/;
const translocoKeysManagerImport = /@(jsverse|ngneat|testmace)\/transloco-keys-manager/;
const epTranslocoServiceImport = /EpTranslocoService/;
const epTranslocoSignalImport = /epTranslate(Signal|ArraySignal|ObjectSignal)/;

function TSExtractor(config: ExtractorConfig): ScopeMap {
  const { file, scopes, defaultValue, scopeToKeys } = config;
  const content = readFile(file);
  const extractors = [];

  if (translocoImport.test(content)) {
    extractors.push(serviceExtractor, pureFunctionExtractor, signalExtractor);
  }

  if (epTranslocoServiceImport.test(content)) {
    extractors.push(serviceExtractor);
  }

  if (epTranslocoSignalImport.test(content)) {
    extractors.push(epSignalExtractor);
  }

  if (translocoKeysManagerImport.test(content)) {
    extractors.push(markerExtractor);
  }

  const ast = tsquery.ast(content, undefined, ScriptKind.TS);
  const baseParams = {
    scopeToKeys,
    scopes,
    defaultValue,
  };

  extractors
    .map((ex) => ex(ast))
    .flat()
    .forEach(({ key, lang, params, defaultValue: extractedDefault, isExtractedDefault }) => {
      const [keyWithoutScope, scopeAlias] = resolveAliasAndKeyFromService(
        key,
        lang,
        scopes,
      );
      const hasExtractedDefault = isExtractedDefault && extractedDefault !== undefined;
      addKey({
        scopeAlias,
        keyWithoutScope,
        params,
        ...baseParams,
        defaultValue: hasExtractedDefault ? extractedDefault : defaultValue,
        isExtractedDefault: hasExtractedDefault,
      });
    });

  /** Check for dynamic markings */
  addCommentSectionKeys({
    content,
    regexFactory: regexFactoryMap.ts.comments,
    ...baseParams,
  });

  inlineTemplateExtractor(ast, config);

  return scopeToKeys;
}

/**
 *
 * It can be one of the following:
 *
 * translate('2', {}, 'some/nested');
 * translate('3', {}, 'some/nested/en');
 * translate('globalKey');
 *
 */
function resolveAliasAndKeyFromService(
  key: string,
  scopePath: string,
  scopes: Scopes,
): [string, string | null] {
  // It means that it's the global
  if (!scopePath) {
    return [key, null];
  }

  const scopeAlias = resolveScopeAlias({ scopePath, scopes });

  return [key, scopeAlias];
}
