import { tsquery } from '@phenomnomnominal/tsquery';
import { SourceFile } from 'typescript';
import ts from 'typescript';

import { buildKeysFromASTNodes, buildKeysFromEpASTNodes } from './build-keys-from-ast-nodes';
import { TSExtractorResult } from './types';

function buildInjectFunctionQuery(nodeType: string, serviceName: string) {
  return `${nodeType}:has(CallExpression:has(Identifier[name=inject]):has(Identifier[name=${serviceName}]))`;
}

export function serviceExtractor(ast: SourceFile): TSExtractorResult {
  let result: TSExtractorResult = [];

  const translocoConstructorInjection =
    'Constructor Parameter:has(TypeReference Identifier[name=TranslocoService])';
  const translocoInjectFunction = ['PropertyDeclaration', 'VariableDeclaration'].map(
    (nodeType) => buildInjectFunctionQuery(nodeType, 'TranslocoService'),
  );
  const translocoServiceNameQuery = [translocoConstructorInjection, translocoInjectFunction].join(',');
  const translocoServiceNameNodes = tsquery(ast, translocoServiceNameQuery);

  translocoServiceNameNodes.forEach((serviceName) => {
    if (
      ts.isParameter(serviceName) ||
      ts.isPropertyDeclaration(serviceName) ||
      ts.isVariableDeclaration(serviceName)
    ) {
      const propName = serviceName.name.getText();
      const methodNodes = tsquery(
        ast,
        `PropertyAccessExpression:has([text="${propName}"])`,
      );

      result = result.concat(buildKeysFromASTNodes(methodNodes));
    }
  });

  const epConstructorInjection =
    'Constructor Parameter:has(TypeReference Identifier[name=EpTranslocoService])';
  const epInjectFunction = ['PropertyDeclaration', 'VariableDeclaration'].map(
    (nodeType) => buildInjectFunctionQuery(nodeType, 'EpTranslocoService'),
  );
  const epServiceNameQuery = [epConstructorInjection, epInjectFunction].join(',');
  const epServiceNameNodes = tsquery(ast, epServiceNameQuery);

  epServiceNameNodes.forEach((serviceName) => {
    if (
      ts.isParameter(serviceName) ||
      ts.isPropertyDeclaration(serviceName) ||
      ts.isVariableDeclaration(serviceName)
    ) {
      const propName = serviceName.name.getText();
      const methodNodes = tsquery(
        ast,
        `PropertyAccessExpression:has([text="${propName}"])`,
      );

      result = result.concat(buildKeysFromEpASTNodes(methodNodes));
    }
  });

  return result;
}
