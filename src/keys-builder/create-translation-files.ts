import { messages } from '../messages';
import { Config, ScopeMap, Translation } from '../types';
import { getLogger } from '../utils/logger';
import { buildScopeFilePaths } from '../utils/path.utils';

import { buildTranslationFile, FileAction } from './build-translation-file';
import { runPrettier } from './utils/run-prettier';

function createNonDefaultLangTranslation(
  translation: Translation,
  extractedDefaultKeys: Set<string>,
  scopePath?: string,
): Translation {
  const result: Translation = {};
  Object.keys(translation).forEach((key) => {
    const fullKey = scopePath ? `${scopePath}:${key}` : key;
    result[key] = extractedDefaultKeys.has(fullKey) ? '' : translation[key];
  });
  return result;
}

export async function createTranslationFiles({
  scopeToKeys,
  langs,
  output,
  replace,
  removeExtraKeys,
  scopes,
  fileFormat,
}: Config & { scopeToKeys: ScopeMap }) {
  const logger = getLogger();
  const defaultLang = langs[0];
  const extractedDefaultKeys = scopeToKeys.__extractedDefaultKeys || new Set<string>();

  const scopeFiles = buildScopeFilePaths({
    aliasToScope: scopes.aliasToScope,
    langs,
    output,
    fileFormat,
  });
  const globalFiles = langs.map((lang) => ({
    path: `${output}/${lang}.${fileFormat}`,
    lang,
  }));
  const actions: FileAction[] = [];

  globalFiles.forEach(({ path, lang }) => {
    const isDefaultLang = lang === defaultLang;
    const translation = isDefaultLang
      ? scopeToKeys.__global
      : createNonDefaultLangTranslation(scopeToKeys.__global, extractedDefaultKeys);
    actions.push(
      buildTranslationFile({
        path,
        translation,
        replace,
        removeExtraKeys,
        fileFormat,
      }),
    );
  });

  scopeFiles.forEach(({ path, scope, lang }) => {
    const isDefaultLang = lang === defaultLang;
    const scopeTranslation = (scopeToKeys[scope] || {}) as Record<string, string>;
    const translation = isDefaultLang
      ? scopeTranslation
      : createNonDefaultLangTranslation(scopeTranslation, extractedDefaultKeys, scope);
    actions.push(
      buildTranslationFile({
        path,
        translation,
        replace,
        removeExtraKeys,
        fileFormat,
      }),
    );
  });

  if (fileFormat === 'json') {
    await runPrettier(actions.map(({ path }) => path));
  }

  const newFiles = actions.filter((action) => action.type === 'new');

  if (newFiles.length) {
    logger.success(`${messages.creatingFiles} 🗂`);
    logger.log(newFiles.map((action) => action.path).join('\n'));
  }

  logger.log(`\n              🌵 ${messages.done} 🌵`);
}
