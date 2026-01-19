import { describe, beforeEach, it, expect, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';

const testDir = '__tests__/buildTranslationFiles/template-extraction/pipe/ep-transloco-test';
const outputDir = path.join(testDir, 'i18n');

vi.mock('src/utils/resolve-project-base-path.ts', () => ({
  resolveProjectBasePath: vi.fn().mockReturnValue({ projectBasePath: testDir }),
}));

const { buildTranslationFiles } = await import('../../../../src/keys-builder');

describe('epTransloco pipe extraction', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    fs.removeSync(outputDir);
    fs.ensureDirSync(path.join(testDir, 'src'));
    
    fs.writeFileSync(
      path.join(testDir, 'src/test.html'),
      `<div>
  {{ 'key1' | epTransloco: 'Default Value 1' }}
  <p [title]="'key2' | epTransloco: 'Default Value sosal?'"></p>
  {{ 'key3' | epTransloco: 'Hello World': {name: 'test'} }}
  {{ 'hello.govno2' | epTransloco: 'Hello user govno': {} }}
  {{ 'hello.govno3' | epTransloco: 'Hello user govno' }}
</div>`
    );
  });

  it('should extract keys with default values from epTransloco pipe', () => {
    buildTranslationFiles({
      input: [path.resolve(testDir, 'src')],
      output: path.resolve(outputDir),
      translationsPath: path.resolve(outputDir),
      langs: ['en'],
      fileFormat: 'json',
      scopes: { scopeToAlias: {}, aliasToScope: {} },
    } as any);

    const translation = fs.readJsonSync(path.join(outputDir, 'en.json'));
    
    expect(translation).toEqual({
      key1: 'Default Value 1',
      key2: 'Default Value sosal?',
      key3: 'Hello World',
      'hello.govno2': 'Hello user govno',
      'hello.govno3': 'Hello user govno',
    });
  });
});
