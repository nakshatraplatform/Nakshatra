import { globSync as glob } from 'glob';
import { statSync } from 'node:fs';
import { parse } from 'node:path';
import { expand } from 'brace-expansion';

// Deliberately implements only the call used by the pinned Next ESLint plugin.
// Do not present this as a general-purpose fast-glob replacement.
export const globSync = (pattern, options) => {
  if (typeof pattern !== 'string' || !options || options.onlyDirectories !== true
    || Object.keys(options).some(key => key !== 'onlyDirectories')) {
    throw new TypeError('Unsupported Next root glob contract');
  }
  if (pattern.length > 4096 || (pattern.match(/[({]/g) || []).length > 64) {
    throw new RangeError('Next root glob exceeds the supported pattern limit');
  }
  const expanded = expand(pattern, { max: 1025, maxLength: 4096 * 1025, maxDepth: 64 });
  if (expanded.length > 1024) throw new RangeError('Next root glob exceeds the expansion limit');
  return glob(pattern, { follow: true, dot: false }).filter(entry => {
    try { return statSync(entry).isDirectory(); }
    catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false;
      throw error;
    }
  }).map(entry => {
    const normalized = entry.replace(/\\/g, '/');
    return entry.length === parse(entry).root.length ? normalized : normalized.replace(/\/$/, '');
  });
};
