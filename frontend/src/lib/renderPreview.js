// For grammar lessons — escapes HTML then converts markdown
export function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^#{3}\s+(.+)$/gm, '<h3 class="text-base font-bold text-tsubaki-red mt-4 mb-1">$1</h3>')
    .replace(/^#{2}\s+(.+)$/gm, '<h2 class="text-lg font-bold text-on-surface mt-5 mb-2">$1</h2>')
    .replace(/^#{1}\s+(.+)$/gm, '<h1 class="text-xl font-bold text-on-surface mt-6 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-surface-container px-1.5 py-0.5 rounded text-sm font-mono text-tsubaki-red">$1</code>')
    .replace(/^---$/gm, '<hr class="border-outline/20 my-4"/>')
    .replace(/^>\s+(.+)$/gm, '<blockquote class="border-l-4 border-sumire-purple/40 pl-4 my-2 text-on-muted italic">$1</blockquote>')
    .replace(/^[-*]\s+(.+)$/gm, '<li class="ml-4 list-disc text-on-surface">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, (m) => `<ul class="my-2 space-y-1">${m}</ul>`)
    .replace(/\n\n/g, '</p><p class="mb-3">')
    .replace(/\n/g, '<br/>');
}

// For reading lessons — allows <ruby> tags, converts markdown
export function renderReadingText(text) {
  if (!text) return '';
  return text
    .replace(/^#{3}\s+(.+)$/gm, '<h3 class="text-base font-bold text-tsubaki-red mt-4 mb-1">$1</h3>')
    .replace(/^#{2}\s+(.+)$/gm, '<h2 class="text-lg font-bold text-on-surface mt-5 mb-2">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^---$/gm, '<hr class="border-outline/20 my-4"/>')
    .replace(/^>\s+(.+)$/gm, '<blockquote class="border-l-4 border-tsubaki-red/40 pl-4 my-2 text-on-muted italic">$1</blockquote>')
    .replace(/\n\n/g, '</p><p class="mb-4">')
    .replace(/\n/g, '<br/>');
}
