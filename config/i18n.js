'use strict';

const vi = require('../locales/vi.json');
const ja = require('../locales/ja.json');

const locales = { vi, ja };

function interpolate(str, vars) {
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));
}

function t(lang, key, vars = {}) {
  const dict = locales[lang] || locales.vi;
  const value = key.split('.').reduce((o, k) => (o != null && o[k] !== undefined ? o[k] : null), dict);
  if (value === null) {
    const fallback = key.split('.').reduce((o, k) => (o != null && o[k] !== undefined ? o[k] : null), locales.vi);
    if (fallback === null) return key;
    return typeof fallback === 'string' ? interpolate(fallback, vars) : fallback;
  }
  return typeof value === 'string' ? interpolate(value, vars) : value;
}

module.exports = { t };
