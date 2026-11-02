export const RICH_CONTENT_PREFIX = 'GAMEHUB_RICH_V1:';

function isSafeLink(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function compactInline(nodes) {
  const compacted = [];
  for (const node of nodes) {
    if (node.type === 'text' && !node.text) continue;
    const previous = compacted[compacted.length - 1];
    if (node.type === 'text' && previous?.type === 'text'
      && previous.bold === node.bold
      && previous.italic === node.italic
      && previous.underline === node.underline
      && previous.href === node.href) {
      previous.text += node.text;
    } else {
      compacted.push(node);
    }
  }
  return compacted;
}

function serializeInlineNode(node, marks = {}) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (!node.nodeValue) return [];
    return [{
      type: 'text',
      text: node.nodeValue,
      ...(marks.bold ? { bold: true } : {}),
      ...(marks.italic ? { italic: true } : {}),
      ...(marks.underline ? { underline: true } : {}),
      ...(marks.href ? { href: marks.href } : {}),
    }];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const tag = node.tagName.toLowerCase();
  if (tag === 'br') return [{ type: 'break' }];

  const nextMarks = { ...marks };
  if (tag === 'b' || tag === 'strong') nextMarks.bold = true;
  if (tag === 'i' || tag === 'em') nextMarks.italic = true;
  if (tag === 'u') nextMarks.underline = true;
  if (tag === 'a') {
    const href = node.getAttribute('href');
    if (isSafeLink(href)) nextMarks.href = href;
  }

  return Array.from(node.childNodes).flatMap(child => serializeInlineNode(child, nextMarks));
}

function serializeBlock(node) {
  const tag = node.tagName.toLowerCase();
  if (tag === 'ul' || tag === 'ol') {
    const items = Array.from(node.children)
      .filter(child => child.tagName.toLowerCase() === 'li')
      .map(item => compactInline(Array.from(item.childNodes).flatMap(child => serializeInlineNode(child))));
    return items.length ? { type: 'list', ordered: tag === 'ol', items } : null;
  }

  const level = /^h[1-4]$/.test(tag) ? Number(tag.slice(1)) : 0;
  const children = compactInline(Array.from(node.childNodes)
    .flatMap(child => serializeInlineNode(child)));
  if (!children.length || children.every(child => child.type === 'break')) return null;
  return level
    ? { type: 'heading', level: Math.min(level, 3), children }
    : { type: 'paragraph', children };
}

export function serializeRichDocument(editor) {
  if (!editor) return { content: '', textLength: 0 };
  const blocks = [];
  let looseNodes = [];

  const flushLooseNodes = () => {
    const children = compactInline(looseNodes.flatMap(node => serializeInlineNode(node)));
    if (children.length) blocks.push({ type: 'paragraph', children });
    looseNodes = [];
  };

  for (const node of Array.from(editor.childNodes)) {
    const isBlock = node.nodeType === Node.ELEMENT_NODE
      && ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol'].includes(node.tagName.toLowerCase());
    if (!isBlock) {
      looseNodes.push(node);
      continue;
    }
    flushLooseNodes();
    const block = serializeBlock(node);
    if (block) blocks.push(block);
  }
  flushLooseNodes();

  const textLength = countDocumentText(blocks);
  if (!textLength && !blocks.length) return { content: '', textLength: 0 };
  return {
    content: RICH_CONTENT_PREFIX + JSON.stringify({ format: 1, blocks }),
    textLength,
  };
}

function countInlineText(nodes = []) {
  return nodes.reduce((total, node) => total + (
    node.type === 'text' ? node.text.length
      : node.type === 'break' ? 1
        : 0
  ), 0);
}

function countDocumentText(blocks = []) {
  return blocks.reduce((total, block) => {
    if (block.type === 'list') {
      return total + block.items.reduce((sum, item) => sum + countInlineText(item) + 1, 0);
    }
    return total + countInlineText(block.children || []);
  }, 0);
}

function renderInline(nodes = [], prefix = 'inline') {
  if (!Array.isArray(nodes)) return null;
  return nodes.map((node, index) => {
    const key = prefix + '-' + index;
    if (node.type === 'break') return <br key={key} />;
    if (node.type !== 'text' || typeof node.text !== 'string') return null;

    let result = node.text;
    if (node.href && isSafeLink(node.href)) {
      result = <a href={node.href} target="_blank" rel="noopener noreferrer">{result}</a>;
    }
    if (node.underline) result = <u>{result}</u>;
    if (node.italic) result = <em>{result}</em>;
    if (node.bold) result = <strong>{result}</strong>;
    return <span key={key}>{result}</span>;
  });
}

function renderRichBlocks(blocks = []) {
  return blocks.map((block, index) => {
    const key = 'block-' + index;
    if (!block || typeof block !== 'object') return null;

    if (block.type === 'list' && Array.isArray(block.items)) {
      const Tag = block.ordered ? 'ol' : 'ul';
      return <Tag key={key}>{block.items.map((item, itemIndex) => (
        <li key={key + '-item-' + itemIndex}>{renderInline(item, key + '-item-' + itemIndex)}</li>
      ))}</Tag>;
    }
    if (block.type === 'heading') {
      const Tag = block.level === 1 ? 'h2' : 'h3';
      return <Tag key={key}>{renderInline(block.children, key)}</Tag>;
    }
    if (block.type === 'paragraph') {
      return <p key={key}>{renderInline(block.children, key)}</p>;
    }
    return null;
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function inlineToEditorHtml(nodes = []) {
  if (!Array.isArray(nodes)) return '';
  return nodes.map(node => {
    if (node.type === 'break') return '<br>';
    if (node.type !== 'text' || typeof node.text !== 'string') return '';
    let html = escapeHtml(node.text);
    if (node.href && isSafeLink(node.href)) html = '<a href="' + escapeHtml(node.href) + '">' + html + '</a>';
    if (node.underline) html = '<u>' + html + '</u>';
    if (node.italic) html = '<em>' + html + '</em>';
    if (node.bold) html = '<strong>' + html + '</strong>';
    return html;
  }).join('');
}

export function richContentToEditorHtml(content) {
  if (typeof content !== 'string') return '';
  if (!content.startsWith(RICH_CONTENT_PREFIX)) {
    return content ? '<p>' + escapeHtml(content).replace(/\\n/g, '<br>') + '</p>' : '';
  }
  try {
    const document = JSON.parse(content.slice(RICH_CONTENT_PREFIX.length));
    if (document?.format !== 1 || !Array.isArray(document.blocks)) return '';
    return document.blocks.map(block => {
      if (block.type === 'list' && Array.isArray(block.items)) {
        const tag = block.ordered ? 'ol' : 'ul';
        return '<' + tag + '>' + block.items.map(item => '<li>' + inlineToEditorHtml(item) + '</li>').join('') + '</' + tag + '>';
      }
      if (block.type === 'heading') return '<h2>' + inlineToEditorHtml(block.children) + '</h2>';
      if (block.type === 'paragraph') return '<p>' + inlineToEditorHtml(block.children) + '</p>';
      return '';
    }).join('');
  } catch {
    return '';
  }
}

export function renderPostContent(content) {
  if (typeof content !== 'string') return null;
  if (!content.startsWith(RICH_CONTENT_PREFIX)) {
    return <p className="feed-post-content">{content}</p>;
  }

  try {
    const document = JSON.parse(content.slice(RICH_CONTENT_PREFIX.length));
    if (document?.format !== 1 || !Array.isArray(document.blocks)) {
      return <p className="feed-post-content">{content}</p>;
    }
    return <div className="feed-post-rich-content">{renderRichBlocks(document.blocks)}</div>;
  } catch {
    return <p className="feed-post-content">{content}</p>;
  }
}
