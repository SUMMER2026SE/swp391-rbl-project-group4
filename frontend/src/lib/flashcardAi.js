// Chuyển object định nghĩa có cấu trúc do AI trả về thành plain text đánh số
// để đổ vào ô "định nghĩa" của flashcard (hiển thị tốt nhờ whitespace-pre-wrap).

function exampleLines(examples) {
  if (!Array.isArray(examples)) return [];
  return examples
    .filter(e => e && (e.ja || e.vi))
    .map(e => {
      const ja = (e.ja || '').trim();
      const vi = (e.vi || '').trim();
      if (ja && vi) return `例: ${ja} — ${vi}`;
      return `例: ${ja || vi}`;
    });
}

function formatVocabulary(item) {
  const lines = [];
  const senses = Array.isArray(item.senses) ? item.senses.filter(Boolean) : [];
  const multi = senses.length > 1;

  const indent = multi ? '   ' : ''; // thụt lề dòng con chỉ khi có đánh số nhiều nghĩa

  senses.forEach((s, i) => {
    const pos     = (s.pos || '').trim();
    const meaning = (s.meaning || '').trim();
    const prefix  = multi ? `${i + 1}. ` : '';
    const head    = pos ? `${prefix}(${pos}) ${meaning}` : `${prefix}${meaning}`;
    if (head.trim()) lines.push(head);

    const usage = (s.usage || '').trim();
    if (usage) lines.push(`${indent}Cách dùng: ${usage}`);

    exampleLines(s.examples).forEach(ex => lines.push(`${indent}${ex}`));
  });

  return lines.join('\n').trim();
}

function formatGrammar(item) {
  const lines = [];
  const structure = (item.structure || '').trim();
  const meaning   = (item.meaning || '').trim();
  const usage     = (item.usage || '').trim();
  if (structure) lines.push(`Cấu trúc: ${structure}`);
  if (meaning)   lines.push(`Nghĩa: ${meaning}`);
  if (usage)     lines.push(`Cách dùng: ${usage}`);
  exampleLines(item.examples).forEach(ex => lines.push(ex));
  return lines.join('\n').trim();
}

// item: object AI trả về cho một từ. Trả chuỗi định nghĩa (rỗng nếu không dựng được gì).
export function formatAiDefinition(item) {
  if (!item || typeof item !== 'object') return '';
  try {
    return item.type === 'grammar' ? formatGrammar(item) : formatVocabulary(item);
  } catch {
    return '';
  }
}
