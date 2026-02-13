import { IndexSection, ConceptItem, SectionType } from '../types/document-index';

/**
 * Determine the section type based on the title text.
 */
function classifySectionType(title: string): SectionType {
  if (/核心概念/.test(title)) return 'concepts';
  if (/关键关系/.test(title)) return 'relations';
  if (/主旨/.test(title)) return 'summary';
  return 'other';
}

/**
 * Try to parse a line as a concept item.
 * Supports formats:
 *   - **名称（角色）**：描述
 *   - 名称（角色）：描述
 */
function parseConceptLine(line: string): ConceptItem | null {
  // Format 1: - **名称（角色）**：描述
  const boldMatch = line.match(
    /^-\s*\*\*(.+?)[（(](.+?)[）)]\*\*[：:]\s*(.+)$/
  );
  if (boldMatch) {
    return {
      name: boldMatch[1].trim(),
      role: boldMatch[2].trim(),
      description: boldMatch[3].trim(),
    };
  }
  // Format 2: - 名称（角色）：描述  (no bold markers)
  const plainMatch = line.match(
    /^-\s*(.+?)[（(](.+?)[）)][：:]\s*(.+)$/
  );
  if (plainMatch) {
    return {
      name: plainMatch[1].trim(),
      role: plainMatch[2].trim(),
      description: plainMatch[3].trim(),
    };
  }
  return null;
}

/**
 * Try to parse a line as a relation item.
 * Supports formats:
 *   - **标签**：描述
 *   - 标签：描述
 */
function parseRelationLine(line: string): { label: string; description: string } | null {
  // Format 1: - **标签**：描述
  const boldMatch = line.match(/^-\s*\*\*(.+?)\*\*[：:]\s*(.+)$/);
  if (boldMatch) {
    return { label: boldMatch[1].trim(), description: boldMatch[2].trim() };
  }
  // Format 2: - 标签：描述 (plain, with a short label before colon)
  const plainMatch = line.match(/^-\s*(.{1,20}?)[：:]\s*(.+)$/);
  if (plainMatch) {
    return { label: plainMatch[1].trim(), description: plainMatch[2].trim() };
  }
  return null;
}

/** Known section title keywords for plain-text header detection */
const KNOWN_HEADERS = ['主旨', '核心概念', '关键关系'];

/**
 * Check if a line is a section header.
 * Supports two formats:
 *   1. **标题：** (bold markdown)
 *   2. 核心概念及其角色：  (plain text with known keyword)
 * Skips list items (lines starting with -)
 */
function parseSectionHeader(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('-')) return null;

  // Format 1: **标题** or **标题：**
  const boldMatch = trimmed.match(/^\*\*(.+?)\*\*\s*$/);
  if (boldMatch) {
    return boldMatch[1];
  }

  // Format 2: plain text line that starts with a known keyword and ends with colon
  // e.g. "主旨：..." or "核心概念及其角色：" or "关键关系："
  for (const keyword of KNOWN_HEADERS) {
    if (trimmed.startsWith(keyword)) {
      // Check if this is a header-only line (keyword + optional suffix + colon)
      // e.g. "核心概念及其角色：" — the content follows on next lines
      const colonIdx = trimmed.indexOf('：');
      const colonIdxHalf = trimmed.indexOf(':');
      const idx = colonIdx !== -1 ? colonIdx : colonIdxHalf;

      if (idx !== -1) {
        const afterColon = trimmed.substring(idx + 1).trim();
        if (afterColon === '') {
          // Header-only line: "核心概念及其角色："
          return trimmed.substring(0, idx);
        }
        // Inline header: "主旨：本次会议聚焦..."
        // Return the title part, content will be extracted separately
        return trimmed.substring(0, idx);
      }
    }
  }

  return null;
}

/**
 * For inline headers like "主旨：内容...", extract the content after the colon.
 */
function extractInlineContent(line: string, _title: string): string | null {
  const trimmed = line.trim();
  const colonIdx = trimmed.indexOf('：');
  const colonIdxHalf = trimmed.indexOf(':');
  const idx = colonIdx !== -1 ? colonIdx : colonIdxHalf;
  if (idx !== -1) {
    const after = trimmed.substring(idx + 1).trim();
    return after || null;
  }
  return null;
}

/**
 * Parse indexedText into structured IndexSection[].
 *
 * Splitting rules:
 * - Split by bold **标题** patterns OR plain-text known-keyword headers
 * - Text before the first header is treated as a `summary` section
 * - Sections containing "核心概念" keyword are typed as `concepts`
 * - Sections containing "关键关系" keyword are typed as `relations`
 * - Sections containing "主旨" keyword are typed as `summary`
 * - For `concepts` sections, list items are parsed into ConceptItem[]
 *
 * Edge cases:
 * - Empty string returns []
 * - No headers found: entire text becomes a single `summary` section
 */
export function parseIndexSections(indexedText: string): IndexSection[] {
  if (!indexedText || indexedText.trim() === '') {
    return [];
  }

  const lines = indexedText.split('\n');

  // First pass: identify section header line indices
  const headerLines: { index: number; title: string; inlineContent: string | null }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const header = parseSectionHeader(lines[i]);
    if (header) {
      const inlineContent = extractInlineContent(lines[i], header);
      headerLines.push({ index: i, title: header, inlineContent });
    }
  }

  // No section headers found: treat entire text as summary
  if (headerLines.length === 0) {
    return [
      {
        type: 'summary',
        title: '主旨概述',
        content: indexedText.trim(),
      },
    ];
  }

  const sections: IndexSection[] = [];

  // Text before the first header → summary section (only if first header is not "主旨")
  if (headerLines[0].index > 0) {
    const summaryLines = lines.slice(0, headerLines[0].index);
    const summaryContent = summaryLines.join('\n').trim();
    if (summaryContent) {
      sections.push({
        type: 'summary',
        title: '主旨概述',
        content: summaryContent,
      });
    }
  }

  // Process each header section
  for (let i = 0; i < headerLines.length; i++) {
    const titleRaw = headerLines[i].title;
    // Remove trailing colon (full-width or half-width)
    const title = titleRaw.replace(/[：:]\s*$/, '').trim();

    const contentStartLine = headerLines[i].index + 1;
    const contentEndLine = i + 1 < headerLines.length
      ? headerLines[i + 1].index
      : lines.length;

    const contentLines = lines.slice(contentStartLine, contentEndLine);
    let content = contentLines.join('\n').trim();

    // Prepend inline content if the header had content on the same line
    if (headerLines[i].inlineContent) {
      content = content
        ? headerLines[i].inlineContent + '\n' + content
        : headerLines[i].inlineContent!;
    }

    const type = classifySectionType(title);

    const section: IndexSection = {
      type,
      title: type === 'summary' ? '主旨概述' : title,
      content,
    };

    // For concepts sections, parse list items
    if (type === 'concepts') {
      const items: ConceptItem[] = [];
      const allLines = headerLines[i].inlineContent
        ? [headerLines[i].inlineContent!, ...contentLines.map(l => l.trim())]
        : contentLines.map(l => l.trim());
      for (const line of allLines) {
        if (line.startsWith('-')) {
          const item = parseConceptLine(line);
          if (item) items.push(item);
        }
      }
      if (items.length > 0) {
        section.items = items;
      }
    }

    // For relations sections, parse labeled items
    if (type === 'relations') {
      const relationItems: { label: string; description: string }[] = [];
      const allLines = headerLines[i].inlineContent
        ? [headerLines[i].inlineContent!, ...contentLines.map(l => l.trim())]
        : contentLines.map(l => l.trim());
      for (const line of allLines) {
        if (line.startsWith('-')) {
          const rel = parseRelationLine(line);
          if (rel) relationItems.push(rel);
        }
      }
      if (relationItems.length > 0) {
        section.relationItems = relationItems;
      }
    }

    sections.push(section);
  }

  return sections;
}
