import { messages } from '../messages';
import { BaseParams } from '../types';
import { isNil } from '../utils/validators.utils';

interface AddKeysParams extends BaseParams {
  scopeAlias: string | null;
  keyWithoutScope: string;
  params?: string[];
  isExtractedDefault?: boolean;
}

export function addKey({
  defaultValue,
  scopeToKeys,
  scopeAlias,
  keyWithoutScope,
  scopes,
  params = [],
  isExtractedDefault = false,
}: AddKeysParams) {
  if (!keyWithoutScope) {
    return;
  }

  const scopePath = scopeAlias && scopes.aliasToScope[scopeAlias];
  const keyWithScope = scopeAlias
    ? `${scopeAlias}.${keyWithoutScope}`
    : keyWithoutScope;
  const paramsWithInterpolation = params.map((p) => `{{${p}}}`).join(' ');

  const keyValue = isNil(defaultValue)
    ? `${messages.missingValue} '${keyWithScope}'`
    : defaultValue
        .replace('{{key}}', keyWithScope)
        .replace('{{keyWithoutScope}}', keyWithoutScope)
        .replace('{{params}}', paramsWithInterpolation)
        .replace('{{scope}}', scopeAlias || '');

  if (isExtractedDefault) {
    if (!scopeToKeys.__extractedDefaultKeys) {
      scopeToKeys.__extractedDefaultKeys = new Set();
    }
    const fullKey = scopePath ? `${scopePath}:${keyWithoutScope}` : keyWithoutScope;
    scopeToKeys.__extractedDefaultKeys.add(fullKey);
  }

  if (scopePath) {
    if (!scopeToKeys[scopePath]) {
      scopeToKeys[scopePath] = {};
    }
    (scopeToKeys[scopePath] as Record<string, string>)[keyWithoutScope] = keyValue;
  } else {
    scopeToKeys.__global[keyWithoutScope] = keyValue;
  }
}
