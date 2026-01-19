import { Config, ScopeMap } from '../types';
import { checkForProblematicUnflatKeys } from '../utils/keys.utils';
import { mergeDeep } from '../utils/object.utils';

import { extractTemplateKeys } from './template';
import { extractTSKeys } from './typescript';

function mergeScopeMaps(...maps: ScopeMap[]): ScopeMap {
  const extractedKeys = new Set<string>();
  const mapsWithoutSets = maps.map((map) => {
    if (map.__extractedDefaultKeys) {
      map.__extractedDefaultKeys.forEach((key) => extractedKeys.add(key));
    }
    const { __extractedDefaultKeys, ...rest } = map;
    return rest as ScopeMap;
  });

  const merged = mergeDeep({}, ...mapsWithoutSets) as ScopeMap;
  if (extractedKeys.size > 0) {
    merged.__extractedDefaultKeys = extractedKeys;
  }
  return merged;
}

export function buildKeys(config: Config) {
  const [template, ts] = [extractTemplateKeys(config), extractTSKeys(config)];

  const scopeToKeys = mergeScopeMaps(template.scopeToKeys, ts.scopeToKeys);
  const fileCount = template.fileCount + ts.fileCount;

  if (config.unflat) {
    Object.entries(scopeToKeys).forEach(([key, scopeKeys]) => {
      if (key !== '__extractedDefaultKeys' && scopeKeys) {
        checkForProblematicUnflatKeys(scopeKeys as Record<string, string>);
      }
    });
  }

  return { scopeToKeys, fileCount };
}
