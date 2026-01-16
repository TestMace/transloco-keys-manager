import {
  AST,
  BindingPipe,
  LiteralPrimitive,
  ParenthesizedExpression,
  tmplAstVisitAll,
} from '@angular/compiler';

import { ExtractorConfig, OrArray } from '../../types';
import { addKey } from '../add-key';
import { resolveAliasAndKey } from '../utils/resolvers.utils';

import { TemplateExtractorConfig } from './types';
import { parseTemplate, resolveKeysFromLiteralMap } from './utils';
import { notNil } from '../../utils/validators.utils';
import { coerceArray } from '../../utils/collection.utils';

import {
  AstPipeCollector,
  isBindingPipe,
  isConditionalExpression,
  isLiteralExpression,
  isLiteralMap,
  TmplPipeCollector,
} from '@jsverse/angular-utils';

export function pipeExtractor(config: TemplateExtractorConfig) {
  const parsedTemplate = parseTemplate(config);
  const tmplVisitor = new TmplPipeCollector('ep-transloco');
  tmplAstVisitAll(tmplVisitor, parsedTemplate.nodes);
  const astVisitor = new AstPipeCollector();
  astVisitor.visitAll([...tmplVisitor.astTrees], {});
  const keysWithParams = astVisitor.pipes
    .get('ep-transloco')
    ?.map((p) => resolveKeyAndParam(p.node))
    .flat()
    .filter(notNil);
  if (keysWithParams) {
    addKeysFromAst(keysWithParams, config);
  }
}

interface KeyWithParam {
  keyNode: LiteralPrimitive;
  defaultValueNode?: AST;
  paramsNode?: AST;
}

function resolveKeyNode(ast: OrArray<AST>): LiteralPrimitive[] {
  return coerceArray(ast)
    .flatMap((expression) => {
      if (isLiteralExpression(expression)) {
        return expression;
      } else if (isConditionalExpression(expression)) {
        return resolveKeyNode([expression.trueExp, expression.falseExp]);
      } else if (expression instanceof ParenthesizedExpression) {
        return resolveKeyNode(expression.expression);
      }
      return undefined;
    })
    .filter(notNil);
}

function resolveKeyAndParam(
  pipe: BindingPipe,
  defaultValueNode?: AST,
  paramsNode?: AST,
): KeyWithParam | KeyWithParam[] | null {
  const resolvedDefaultValue: AST | undefined = defaultValueNode ?? pipe.args[0];
  const resolvedParams: AST | undefined = paramsNode ?? pipe.args[1];
  
  if (isBindingPipe(pipe.exp)) {
    let nestedPipe = pipe;
    while (isBindingPipe(nestedPipe.exp)) {
      nestedPipe = nestedPipe.exp;
    }

    return resolveKeyAndParam(nestedPipe, resolvedDefaultValue, resolvedParams);
  } else {
    const keyNodes = resolveKeyNode(pipe.exp);
    if (keyNodes.length >= 1) {
      return keyNodes.map((keyNode) => ({
        keyNode,
        defaultValueNode: resolvedDefaultValue,
        paramsNode: resolvedParams,
      }));
    }
  }

  return null;
}

function addKeysFromAst(keys: KeyWithParam[], config: ExtractorConfig): void {
  keys.forEach(({ keyNode, defaultValueNode, paramsNode }) => {
    const [key, scopeAlias] = resolveAliasAndKey(keyNode.value, config.scopes);
    const params = paramsNode && isLiteralMap(paramsNode)
      ? resolveKeysFromLiteralMap(paramsNode)
      : [];
    
    const defaultValue = defaultValueNode && isLiteralExpression(defaultValueNode)
      ? String(defaultValueNode.value)
      : config.defaultValue;
    
    addKey({
      ...config,
      keyWithoutScope: key,
      scopeAlias,
      params,
      defaultValue,
    });
  });
}
