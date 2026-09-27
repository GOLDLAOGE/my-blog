import { safeUrl } from './posts.js';

export function readRows(values, schema) {
  if (values == null) return [];
  if (!Array.isArray(values)) throw new Error('配置列表格式错误');
  return values.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('配置列表行格式错误');
    const result = { _rowId: String(index) };
    for (const key of Object.keys(schema.fields)) result[key] = row[key] ?? (schema.fields[key] === 'class' ? 'blue' : '');
    if (schema.children) result[schema.children.key] = readRows(row[schema.children.key], schema.children);
    return result;
  });
}
export function writeRows(original, input, schema) {
  if (!Array.isArray(input) || input.length > 100) throw new Error('配置列表数量超出范围');
  const seen = new Set();
  return input.map(row => {
    const allowed = ['_rowId', ...Object.keys(schema.fields), ...(schema.children ? [schema.children.key] : [])];
    if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(key => !allowed.includes(key))) throw new Error('包含未开放的列表字段');
    let old = {};
    if (row._rowId !== undefined) {
      if (typeof row._rowId !== 'string' || !/^(0|[1-9]\d*)$/.test(row._rowId) || !original?.[Number(row._rowId)] || seen.has(row._rowId)) throw new Error('列表行标识无效，请重新读取');
      seen.add(row._rowId); old = original[Number(row._rowId)];
    }
    const result = { ...old };
    for (const [key, type] of Object.entries(schema.fields)) {
      const value = row[key];
      if (typeof value !== 'string' || value.length > 2000) throw new Error('列表字段必须是文本');
      if (['url','image'].includes(type) && value) safeUrl(value);
      if (type === 'icon' && value && !/^[\w -]+$/.test(value)) throw new Error('图标类名格式错误');
      if (type === 'class' && !['blue','red','green'].includes(value)) throw new Error('分类颜色无效');
      result[key] = value;
      if (type === 'class') result.shadow = `var(--anzhiyu-shadow-${value})`;
    }
    if (schema.children) result[schema.children.key] = writeRows(old[schema.children.key] || [], row[schema.children.key], schema.children);
    return result;
  });
}
