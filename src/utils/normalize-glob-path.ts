import { GlobOptionsWithFileTypesFalse } from 'glob';
import { sync as globSync } from 'glob';

const defaultIgnore = ['node_modules/**', 'tmp/**', 'coverage/**', 'dist/**'];

export function normalizedGlob(
  path: string,
  options: GlobOptionsWithFileTypesFalse = {},
) {
  // on Windows system the path will have `\` which are used a escape characters in glob
  // therefore we have to escape those for the glob to work correctly on those systems
  const normalizedPath = path.replace(/\\/g, '/');
  const additionalIgnore: string[] = options.ignore
    ? (Array.isArray(options.ignore) ? options.ignore.filter((i): i is string => typeof i === 'string') : (typeof options.ignore === 'string' ? [options.ignore] : []))
    : [];
  const mergedOptions: GlobOptionsWithFileTypesFalse = {
    ...options,
    ignore: [...defaultIgnore, ...additionalIgnore],
  };

  return globSync(normalizedPath, mergedOptions);
}
