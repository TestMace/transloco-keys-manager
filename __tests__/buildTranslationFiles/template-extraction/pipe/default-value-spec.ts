import nodePath from 'node:path';
import {
  assertTranslation,
  removeI18nFolder,
  sourceRoot,
  TranslationTestCase,
} from '../../build-translation-utils';
import { buildConfig, mockResolveProjectBasePath } from '../../../spec-utils';
import { Config } from '../../../../src/types';
import { describe, beforeEach, it } from 'vitest';

const testSourceRoot = nodePath.join(sourceRoot, 'template-extraction/pipe');
mockResolveProjectBasePath(testSourceRoot);

const { buildTranslationFiles } = await import('../../../../src/keys-builder');

export function testPipeDefaultValueExtraction(fileFormat: Config['fileFormat']) {
  describe('Pipe with default value', () => {
    const type: TranslationTestCase = 'template-extraction/pipe';

    beforeEach(() => removeI18nFolder(type));

    it('should extract default value from pipe', () => {
      const config = buildConfig({ 
        sourceRoot: testSourceRoot, 
        config: { 
          fileFormat,
          input: [nodePath.join(testSourceRoot, 'with-params')],
          files: ['with-default-value.html'],
        } 
      });

      const expected = {
        'key1': 'Default Value 1',
        'key2': 'Default Value 2',
        'key3': 'Welcome to the app',
      };

      buildTranslationFiles(config);
      assertTranslation({ type, expected, fileFormat });
    });
  });
}
