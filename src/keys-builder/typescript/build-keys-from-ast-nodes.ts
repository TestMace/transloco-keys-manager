import { Node, StringLiteral, NoSubstitutionTemplateLiteral } from 'typescript';
import ts from 'typescript';

import { TSExtractorResult } from './types';
import { flatten } from 'flat';

export function buildKeysFromASTNodes(
  nodes: Node[],
  allowedMethods = ['translate', 'selectTranslate'],
): TSExtractorResult {
  const result: TSExtractorResult = [];

  nodes.forEach((node) => {
    if (!ts.isCallExpression(node.parent)) return;

    const method = node.parent.expression;
    let methodName = '';
    if (ts.isIdentifier(method)) {
      methodName = method.text;
    } else if (ts.isPropertyAccessExpression(method)) {
      methodName = method.name.text;
    }
    if (!allowedMethods.includes(methodName)) {
      return;
    }

    const [keyNode, paramsNode, langNode] = node.parent.arguments;
    let lang = isStringNode(langNode) ? langNode.text : '';
    let keys: string[] = [];
    const params: string[] =
      paramsNode && ts.isObjectLiteralExpression(paramsNode)
        ? resolveParams(paramsNode)
        : [];

    if (isStringNode(keyNode)) {
      keys = [keyNode.text];
    } else if (ts.isArrayLiteralExpression(keyNode)) {
      keys = keyNode.elements.filter(isStringNode).map((node) => node.text);
    }

    keys.forEach((key) => {
      result.push({ key, lang, params });
    });
  });

  return result;
}

const EP_METHODS = [
  'epTranslate',
  'epSelectTranslate',
  'epTranslateObject',
  'epSelectTranslateObject',
  'epTranslateSignal',
  'epTranslateObjectSignal',
];

const EP_ARRAY_METHODS = ['epTranslateArray', 'epTranslateArraySignal'];

export function buildKeysFromEpASTNodes(nodes: Node[], signalNameOverride?: string): TSExtractorResult {
  const result: TSExtractorResult = [];

  nodes.forEach((node) => {
    if (!ts.isCallExpression(node.parent)) return;

    const method = node.parent.expression;
    let methodName = '';
    if (ts.isIdentifier(method)) {
      methodName = method.text;
    } else if (ts.isPropertyAccessExpression(method)) {
      methodName = method.name.text;
    }

    const effectiveMethodName = signalNameOverride || methodName;

    if (EP_METHODS.includes(effectiveMethodName)) {
      const [keyNode, defaultValueNode, paramsNode, langNode] = node.parent.arguments;
      let lang = isStringNode(langNode) ? langNode.text : '';
      let keys: string[] = [];
      const params: string[] =
        paramsNode && ts.isObjectLiteralExpression(paramsNode)
          ? resolveParams(paramsNode)
          : [];
      const defaultValue = isStringNode(defaultValueNode) ? defaultValueNode.text : undefined;

      if (isStringNode(keyNode)) {
        keys = [keyNode.text];
      } else if (ts.isArrayLiteralExpression(keyNode)) {
        keys = keyNode.elements.filter(isStringNode).map((n) => n.text);
      }

      keys.forEach((key) => {
        result.push({
          key,
          lang,
          params,
          defaultValue,
          isExtractedDefault: defaultValue !== undefined,
        });
      });
    } else if (EP_ARRAY_METHODS.includes(effectiveMethodName)) {
      const [keysNode, defaultValuesNode, paramsNode, langNode] = node.parent.arguments;
      let lang = isStringNode(langNode) ? langNode.text : '';
      const params: string[] =
        paramsNode && ts.isObjectLiteralExpression(paramsNode)
          ? resolveParams(paramsNode)
          : [];

      let keys: string[] = [];
      let defaultValues: (string | undefined)[] = [];

      if (ts.isArrayLiteralExpression(keysNode)) {
        keys = keysNode.elements.filter(isStringNode).map((n) => n.text);
      }

      if (defaultValuesNode && ts.isArrayLiteralExpression(defaultValuesNode)) {
        defaultValues = defaultValuesNode.elements.map((el) =>
          isStringNode(el) ? el.text : undefined,
        );
      }

      keys.forEach((key, index) => {
        const defaultValue = defaultValues[index];
        result.push({
          key,
          lang,
          params,
          defaultValue,
          isExtractedDefault: defaultValue !== undefined,
        });
      });
    }
  });

  return result;
}

function isStringNode(
  node: Node,
): node is StringLiteral | NoSubstitutionTemplateLiteral {
  return (
    node &&
    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
  );
}

function resolveParams(params: ts.ObjectLiteralExpression): string[] {
  return Object.keys(flatten(traverseParams(params)));
}

function traverseParams(
  params: ts.ObjectLiteralExpression,
): Record<string, any> {
  const properties: Record<string, any> = {};

  // Recursive function to handle nested properties
  function processProperty(property: ts.PropertyAssignment) {
    const key = property.name.getText().replace(/['"]/g, '');
    const initializer = property.initializer;

    if (!initializer) return;

    if (ts.isObjectLiteralExpression(initializer)) {
      // Handle nested object
      properties[key] = traverseParams(initializer);
    } else {
      // Simple value (string, number, etc.)
      properties[key] = initializer.getText();
    }
  }

  // Iterate through the properties of the ObjectLiteralExpression
  for (const property of params.properties) {
    if (ts.isPropertyAssignment(property)) {
      processProperty(property);
    }
  }

  // Convert the properties object to a JSON string
  return properties;
}
