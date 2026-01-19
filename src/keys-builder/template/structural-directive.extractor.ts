import {
  AST,
  ASTWithSource,
  Interpolation,
  Call,
  RecursiveAstVisitor,
  TmplAstBoundAttribute,
  TmplAstNode,
  TmplAstTemplate,
  TmplAstTextAttribute,
  PropertyRead,
} from '@angular/compiler';

import { ExtractorConfig } from '../../types';
import { addKey } from '../add-key';
import { resolveAliasAndKey } from '../utils/resolvers.utils';

import { TemplateExtractorConfig } from './types';
import {
  isBoundAttribute,
  isBoundText,
  isElement,
  isInterpolation,
  isCall,
  isNgTemplateTag,
  isSupportedNode,
  isTemplate,
  parseTemplate,
  isBlockNode,
  resolveBlockChildNodes,
  resolveKeysFromLiteralMap,
} from './utils';
import { isConditionalExpression, isLiteralExpression, isLiteralMap } from '@jsverse/angular-utils';

interface MethodCallMetadata {
  keyNode?: AST;
  params: string[];
  read?: string;
  isEpTransloco?: boolean;
  defaultValue?: string;
}

interface ContainerMetaData {
  name: string;
  read?: string;
  isEpTransloco?: boolean;
  /* We need to keep the element's span since we might have several method declarations with the same name */
  spanOffset: { start: number; end: number };
}

export function structuralDirectiveExtractor(config: TemplateExtractorConfig) {
  const ast = parseTemplate(config);
  traverse(ast.nodes, [], config);
}

export function traverse(
  nodes: TmplAstNode[],
  containers: ContainerMetaData[],
  config: TemplateExtractorConfig,
) {
  for (const node of nodes) {
    if (isBlockNode(node)) {
      traverse(resolveBlockChildNodes(node), containers, config);
      continue;
    }

    let methodUsages: MethodCallMetadata[] = [];

    if (isBoundText(node)) {
      const { expressions } = (node.value as ASTWithSource)
        .ast as Interpolation;
      methodUsages = getMethodUsages(expressions, containers);
    } else if (isSupportedNode(node, [isTemplate, isElement])) {
      if (isTranslocoTemplate(node)) {
        for (const metadata of resolveMetadata(node, false)) {
          containers.push(metadata);
        }
      }
      if (isEpTranslocoTemplate(node)) {
        for (const metadata of resolveMetadata(node, true)) {
          containers.push(metadata);
        }
      }

      let attrsSource = node.inputs;
      if (isTemplate(node)) {
        attrsSource = node.inputs.concat(
          node.templateAttrs.filter(isBoundAttribute),
        );
      }

      const boundAttrs = attrsSource
        .map((input) => {
          const { ast } = input.value as ASTWithSource;

          return isInterpolation(ast) ? ast.expressions : ast;
        })
        .flat();

      methodUsages = getMethodUsages(boundAttrs, containers);
      traverse(node.children, containers, config);
    }

    addKeysFromAst(methodUsages, config);
  }
}

class MethodCallUnwrapper extends RecursiveAstVisitor {
  expressions: Call[] = [];

  override visitCall(method: Call, context: any) {
    this.expressions.push(method);
    super.visitCall(method, context);
  }
}

/**
 * Extract method calls from an AST.
 */
function unwrapMethodCalls(exp: AST): Call[] {
  const unwrapper = new MethodCallUnwrapper();
  unwrapper.visit(exp);
  return unwrapper.expressions;
}

function getMethodUsages(expressions: AST[], containers: ContainerMetaData[]) {
  return expressions
    .flatMap(unwrapMethodCalls)
    .filter((exp) => isTranslocoMethod(exp, containers))
    .map((exp) => {
      const container = containers.find(({ name, spanOffset: { start, end } }) => {
        const inRange =
          exp.sourceSpan.end < end && exp.sourceSpan.start > start;

        return (exp.receiver as PropertyRead).name === name && inRange;
      })!;

      const [keyNode, secondArg, thirdArg] = exp.args;

      if (container.isEpTransloco) {
        const isSecondArgDefaultValue = isLiteralExpression(secondArg);
        const defaultValue = isSecondArgDefaultValue ? String(secondArg.value) : undefined;
        const paramsNode = isSecondArgDefaultValue ? thirdArg : secondArg;

        return {
          keyNode,
          defaultValue,
          params: isLiteralMap(paramsNode)
            ? resolveKeysFromLiteralMap(paramsNode)
            : [],
          ...container,
        };
      }

      return {
        keyNode,
        params: isLiteralMap(secondArg)
          ? resolveKeysFromLiteralMap(secondArg)
          : [],
        ...container,
      };
    });
}

function isTranslocoAttr(attr: TmplAstTextAttribute | TmplAstBoundAttribute) {
  return attr.name === 'transloco';
}

function isEpTranslocoAttr(attr: TmplAstTextAttribute | TmplAstBoundAttribute) {
  return attr.name === 'epTransloco';
}

function isPrefixAttr<T extends { name: string }>(attr: T) {
  return attr.name === 'translocoPrefix' || attr.name === 'translocoRead';
}

function isEpPrefixAttr<T extends { name: string }>(attr: T) {
  return attr.name === 'epTranslocoPrefix' || attr.name === 'epTranslocoRead';
}

function isTranslocoTemplate(node: TmplAstNode): node is TmplAstTemplate {
  return (
    isTemplate(node) &&
    (node.templateAttrs.some(isTranslocoAttr) ||
      (isNgTemplateTag(node) && node.attributes.some(isTranslocoAttr)))
  );
}

function isEpTranslocoTemplate(node: TmplAstNode): node is TmplAstTemplate {
  return (
    isTemplate(node) &&
    (node.templateAttrs.some(isEpTranslocoAttr) ||
      (isNgTemplateTag(node) && node.attributes.some(isEpTranslocoAttr)))
  );
}

function isTranslocoMethod(
  exp: AST,
  containers: ContainerMetaData[],
): exp is Call {
  return (
    isCall(exp) &&
    containers.some(({ name }) => name === (exp.receiver as PropertyRead).name)
  );
}

function resolveMetadata(node: TmplAstTemplate, isEpTransloco: boolean): ContainerMetaData[] {
  /*
   * An ngTemplate element might have more than once implicit variables, we need to capture all of them.
   * */
  let metadata: Omit<ContainerMetaData, 'spanOffset'>[];
  const prefixAttrFn = isEpTransloco ? isEpPrefixAttr : isPrefixAttr;

  if (isNgTemplateTag(node)) {
    const implicitVars = node.variables.filter((attr) => !attr.value);
    let read = node.attributes.find(prefixAttrFn)?.value;
    if (!read) {
      const ast = (node.inputs.find(prefixAttrFn)?.value as ASTWithSource)?.ast;
      if (isLiteralExpression(ast)) {
        read = ast.value;
      }
    }

    metadata = implicitVars.map(({ name }) => ({ name, read, isEpTransloco }));
  } else {
    const { name } = node.variables.find(
      (variable) => variable.value === '$implicit',
    )!;
    const read = node.templateAttrs.find(prefixAttrFn)?.value as ASTWithSource;
    metadata = isLiteralExpression(read?.ast)
      ? [{ name, read: read.ast.value, isEpTransloco }]
      : [{ name, isEpTransloco }];
  }

  return metadata.map((metadata) => {
    const sourceSpan = node.sourceSpan;

    return {
      ...metadata,
      spanOffset: {
        start: sourceSpan.start.offset,
        end: sourceSpan.end.offset,
      },
    };
  });
}

function addKeysFromAst(
  expressions: MethodCallMetadata[],
  config: ExtractorConfig,
) {
  for (const { keyNode, read, params, isEpTransloco, defaultValue } of expressions) {
    if (isConditionalExpression(keyNode)) {
      addKeysFromAst(
        [keyNode.trueExp, keyNode.falseExp].map((kn) => {
          return {
            keyNode: kn,
            read,
            params,
            isEpTransloco,
            defaultValue,
          };
        }),
        config,
      );
    } else if (isLiteralExpression(keyNode) && keyNode.value) {
      let value = read ? `${read}.${keyNode.value}` : keyNode.value;
      const [key, scopeAlias] = resolveAliasAndKey(value, config.scopes);
      const hasExtractedDefault = isEpTransloco && defaultValue !== undefined;

      addKey({
        ...config,
        params,
        keyWithoutScope: key,
        scopeAlias,
        defaultValue: hasExtractedDefault ? defaultValue : config.defaultValue,
        isExtractedDefault: hasExtractedDefault,
      });
    }
  }
}
