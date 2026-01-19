import {
  AST,
  ASTWithSource,
  LiteralPrimitive,
  ParenthesizedExpression,
  TmplAstBoundAttribute,
  TmplAstNode,
  TmplAstTextAttribute,
} from '@angular/compiler';

import { ExtractorConfig, OrArray } from '../../types';
import { addKey } from '../add-key';
import { resolveAliasAndKey } from '../utils/resolvers.utils';

import { TemplateExtractorConfig } from './types';
import {
  isBlockNode,
  isBoundAttribute,
  isElement,
  isInterpolation,
  isSupportedNode,
  isTemplate,
  isTextAttribute,
  parseTemplate,
  resolveBlockChildNodes,
  resolveKeysFromLiteralMap,
} from './utils';
import { coerceArray } from '../../utils/collection.utils';
import { isConditionalExpression, isLiteralExpression, isLiteralMap } from '@jsverse/angular-utils';

export function directiveExtractor(config: TemplateExtractorConfig) {
  const ast = parseTemplate(config);
  traverse(ast.nodes, config);
}

function traverse(nodes: TmplAstNode[], config: ExtractorConfig) {
  for (const node of nodes) {
    if (isBlockNode(node)) {
      traverse(resolveBlockChildNodes(node), config);
      continue;
    }

    if (!isSupportedNode(node, [isTemplate, isElement])) {
      continue;
    }

    const translocoParams = node.inputs
      .filter(isTranslocoParams)
      .map((ast) => {
        const value = ast.value;
        if (value instanceof ASTWithSource && isLiteralMap(value.ast)) {
          return resolveKeysFromLiteralMap(value.ast);
        }
        return [];
      })
      .flat();
    const translocoKeys = [...node.inputs, ...node.attributes]
      .filter(isTranslocoDirective)
      .map((ast) => {
        let value = ast.value;
        if (value instanceof ASTWithSource) {
          value = value.ast;
        }
        return isInterpolation(value) ? (value.expressions as AST[]) : value;
      })
      .flat()
      .map(resolveKey)
      .flat();
    addTranslocoKeys(translocoKeys, translocoParams, config);

    const epTranslocoParams = node.inputs
      .filter(isEpTranslocoParams)
      .map((ast) => {
        const value = ast.value;
        if (value instanceof ASTWithSource && isLiteralMap(value.ast)) {
          return resolveKeysFromLiteralMap(value.ast);
        }
        return [];
      })
      .flat();
    const defaultValueAttr = [...node.inputs, ...node.attributes].find(isEpTranslocoDefault);
    const extractedDefault = resolveDefaultValue(defaultValueAttr);
    const epTranslocoKeys = [...node.inputs, ...node.attributes]
      .filter(isEpTranslocoDirective)
      .map((ast) => {
        let value = ast.value;
        if (value instanceof ASTWithSource) {
          value = value.ast;
        }
        return isInterpolation(value) ? (value.expressions as AST[]) : value;
      })
      .flat()
      .map(resolveKey)
      .flat();
    addEpTranslocoKeys(epTranslocoKeys, epTranslocoParams, extractedDefault, config);

    traverse(node.children, config);
  }
}

function isTranslocoDirective(
  ast: unknown,
): ast is TmplAstBoundAttribute | TmplAstTextAttribute {
  return (
    (isBoundAttribute(ast) || isTextAttribute(ast)) && ast.name === 'transloco'
  );
}

function isTranslocoParams(ast: unknown): ast is TmplAstBoundAttribute {
  return isBoundAttribute(ast) && ast.name === 'translocoParams';
}

function isEpTranslocoDirective(
  ast: unknown,
): ast is TmplAstBoundAttribute | TmplAstTextAttribute {
  return (
    (isBoundAttribute(ast) || isTextAttribute(ast)) && ast.name === 'epTransloco'
  );
}

function isEpTranslocoDefault(
  ast: unknown,
): ast is TmplAstBoundAttribute | TmplAstTextAttribute {
  return (
    (isBoundAttribute(ast) || isTextAttribute(ast)) && ast.name === 'epTranslocoDefault'
  );
}

function isEpTranslocoParams(ast: unknown): ast is TmplAstBoundAttribute {
  return isBoundAttribute(ast) && ast.name === 'epTranslocoParams';
}

function resolveDefaultValue(
  attr: TmplAstBoundAttribute | TmplAstTextAttribute | undefined,
): string | undefined {
  if (!attr) {
    return undefined;
  }

  if (isTextAttribute(attr)) {
    return attr.value;
  }

  if (isBoundAttribute(attr)) {
    const value = attr.value;
    if (value instanceof ASTWithSource && isLiteralExpression(value.ast)) {
      return String((value.ast as LiteralPrimitive).value);
    }
  }

  return undefined;
}

function resolveKey(ast: OrArray<AST | string>): string[] {
  return coerceArray(ast)
    .map((expression) => {
      if (typeof expression === 'string') {
        return expression;
      } else if (isConditionalExpression(expression)) {
        return resolveKey([expression.trueExp, expression.falseExp]);
      } else if (isLiteralExpression(expression)) {
        return expression.value;
      } else if (expression instanceof ParenthesizedExpression) {
        return resolveKey(expression.expression);
      }
    })
    .filter(Boolean)
    .flat();
}

function addTranslocoKeys(
  keys: string[],
  params: string[],
  config: ExtractorConfig,
): void {
  keys.forEach((rawKey) => {
    const [key, scopeAlias] = resolveAliasAndKey(rawKey, config.scopes);
    addKey({
      ...config,
      keyWithoutScope: key,
      scopeAlias,
      params,
    });
  });
}

function addEpTranslocoKeys(
  keys: string[],
  params: string[],
  extractedDefault: string | undefined,
  config: ExtractorConfig,
): void {
  keys.forEach((rawKey) => {
    const [key, scopeAlias] = resolveAliasAndKey(rawKey, config.scopes);
    const hasExtractedDefault = extractedDefault !== undefined;
    const defaultValue = hasExtractedDefault ? extractedDefault : config.defaultValue;

    addKey({
      ...config,
      keyWithoutScope: key,
      scopeAlias,
      params,
      defaultValue,
      isExtractedDefault: hasExtractedDefault,
    });
  });
}
