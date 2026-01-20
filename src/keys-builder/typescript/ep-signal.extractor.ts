import { SourceFile, Node } from 'typescript';
import { tsquery } from '@phenomnomnominal/tsquery';

import { buildKeysFromEpASTNodes } from './build-keys-from-ast-nodes';
import { TSExtractorResult } from './types';

const EP_SIGNAL_NAMES = ['epTranslateSignal', 'epTranslateArraySignal', 'epTranslateObjectSignal'];

export function epSignalExtractor(ast: SourceFile): TSExtractorResult {
  const importNodes = tsquery(
    ast,
    `ImportDeclaration:has(ImportSpecifier:has(Identifier[name=/^epTranslate(Signal|ArraySignal|ObjectSignal)$/]))`,
  );

  if (importNodes.length === 0) {
    return [];
  }

  const signalNames: string[] = [];
  importNodes.forEach((importNode) => {
    EP_SIGNAL_NAMES.forEach((signalName) => {
      const resolvedName = getImportedName(importNode, signalName);
      if (resolvedName) {
        signalNames.push(resolvedName);
      }
    });
  });

  if (signalNames.length === 0) {
    return [];
  }

  let result: TSExtractorResult = [];
  signalNames.forEach((signalName) => {
    const fns = tsquery(ast, `CallExpression Identifier[text=${signalName}]`);
    result = result.concat(buildKeysFromEpASTNodes(fns, signalName));
  });

  return result;
}

function getImportedName(importNode: Node, originalName: string): string | null {
  const specifiers = tsquery(
    importNode,
    `ImportSpecifier:has(Identifier[name=${originalName}])`,
  );

  if (specifiers.length === 0) {
    return null;
  }

  const [, alias] = tsquery(specifiers[0], 'Identifier');
  return alias ? alias.getText() : originalName;
}
