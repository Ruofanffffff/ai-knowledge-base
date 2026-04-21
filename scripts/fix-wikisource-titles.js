const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function stripHtmlToPlainText(value) {
  if (!value) return '';
  return String(value)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, '\'')
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveTitleFromContent(content, maxLength = 50) {
  const plain = stripHtmlToPlainText(content || '');
  if (!plain) return '无标题';
  return plain.slice(0, maxLength);
}

async function run() {
  console.log('Fetching WikiSources with Note Edit/Note titles...');
  const sources = await prisma.wikiSource.findMany({
    where: {
      OR: [
        { title: { startsWith: 'Note Edit ' } },
        { title: { startsWith: 'Note ' } },
      ],
      sourceType: { in: ['note', 'note_edit'] }
    }
  });

  console.log(`Found ${sources.length} sources to fix.`);

  for (const source of sources) {
    if (!source.sourceId) continue;
    
    // Fetch the corresponding Note
    const note = await prisma.note.findUnique({
      where: { id: source.sourceId }
    });

    if (note && note.content) {
      const realTitle = deriveTitleFromContent(note.content);
      if (realTitle) {
        await prisma.wikiSource.update({
          where: { id: source.id },
          data: { title: realTitle }
        });
        console.log(`Updated source ${source.id} -> ${realTitle}`);
      }
    }
  }

  console.log('Done fixing WikiSource titles.');
  await prisma.$disconnect();
}

run().catch(console.error);