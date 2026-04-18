const { WikiCompiler, slugify, stripMarkdown, stableHash } = require('./wikiCompiler');

describe('wikiCompiler utils', () => {
  test('stableHash should be deterministic', () => {
    expect(stableHash('a')).toBe(stableHash('a'));
    expect(stableHash('a')).not.toBe(stableHash('b'));
  });

  test('slugify should produce fallback slug for empty title', () => {
    const s = slugify('', 'seed');
    expect(typeof s).toBe('string');
    expect(s.length).toBeGreaterThan(0);
  });

  test('stripMarkdown should remove common markdown syntax', () => {
    const plain = stripMarkdown('# Title\n\n- a\n- b\n`code`\n');
    expect(plain.includes('#')).toBe(false);
    expect(plain.includes('`')).toBe(false);
    expect(plain.length).toBeGreaterThan(0);
  });
});

describe('WikiCompiler pipeline', () => {
  test('compileSourceById should create or update pages', async () => {
    const calls = { upsert: 0, refs: 0 };
    const originalRaw = '联系：13812345678 test.user@example.com 110105199001011234';
    const dal = {
      _prisma: { document: {}, note: {} },
      tryLockSource: async () => true,
      getSourceById: async () => ({
        id: 's1',
        userId: 'u1',
        sourceType: 'raw',
        sourceId: null,
        sourceUrl: null,
        title: 'T',
        rawContent: originalRaw,
        contentHash: null,
        status: 'queued',
      }),
      updateSource: jest.fn(async () => {}),
      unlockSource: async () => {},
      createCompileRun: async () => ({ id: 'r1' }),
      updateCompileRun: jest.fn(async () => {}),
      listPages: async () => [],
      getPageBySlug: async () => null,
      upsertPageBySlug: async (userId, slug, patch) => {
        calls.upsert += 1;
        return { id: `p${calls.upsert}`, userId, slug, ...patch };
      },
      createSourceRef: async () => {
        calls.refs += 1;
        return { id: `ref${calls.refs}` };
      },
    };

    const llmClient = {
      callJSON: jest.fn(async (prompt) => {
        expect(prompt.includes(originalRaw)).toBe(false);
        expect(prompt.includes('13812345678')).toBe(false);
        expect(prompt.includes('test.user@example.com')).toBe(false);
        expect(prompt.includes('110105199001011234')).toBe(false);
        expect(prompt.includes('138****5678')).toBe(true);
        expect(prompt.includes('t***@example.com')).toBe(true);
        expect(prompt.includes('110***********1234')).toBe(true);
        return {
          pages: [
            { title: 'Page A', slug: 'page-a', summary: 'S', markdown: '# Page A\n\nX\n' },
            { title: 'Page B', slug: 'page-b', summary: 'S', markdown: '# Page B\n\nY\n' },
          ],
        };
      }),
      call: async (prompt) => prompt,
    };

    const embeddingService = {
      generateEmbedding: async () => [1, 0, 0],
      cosineSimilarity: (a, b) => {
        if (!Array.isArray(a) || !Array.isArray(b)) return 0;
        if (a.length !== b.length) return 0;
        let dot = 0;
        let na = 0;
        let nb = 0;
        for (let i = 0; i < a.length; i += 1) {
          dot += a[i] * b[i];
          na += a[i] * a[i];
          nb += b[i] * b[i];
        }
        if (!na || !nb) return 0;
        return dot / (Math.sqrt(na) * Math.sqrt(nb));
      },
    };

    const compiler = new WikiCompiler({ dal, llmClient, embeddingService, matchThreshold: 0.9 });
    const result = await compiler.compileSourceById('s1');

    expect(result.status).toBe('succeeded');
    expect(Array.isArray(result.pages)).toBe(true);
    expect(calls.upsert).toBeGreaterThanOrEqual(2);
    expect(calls.refs).toBeGreaterThanOrEqual(2);
    expect(dal.updateSource).toHaveBeenCalledWith('s1', expect.objectContaining({ rawContent: originalRaw }));
    expect(dal.updateCompileRun.mock.calls.some(([, patch]) => patch && typeof patch.llmInputChars === 'number' && patch.llmInputChars > 0)).toBe(true);
  });
});
