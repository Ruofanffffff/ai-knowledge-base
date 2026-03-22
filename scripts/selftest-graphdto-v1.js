const assert = require('assert');

const graphDtoService = require('../services/graphDtoService');

function run() {
  const unified = graphDtoService.fromUnifiedPrisma({
    entities: [{ id: 'e1', cleanedName: '实体A', description: '描述A', entityType: 'concept', source: 'fact' }],
    relations: [{ id: 'r1', sourceEntityId: 'e1', targetEntityId: 'e1', cleanedName: '包含', description: '描述', layer: 'how', source: 'fact' }],
    principles: [{ id: 'p1', name: '原则', description: '描述', source: 'pattern' }],
  });

  assert.equal(unified.scope, 'unified');
  assert.equal(unified.entities[0].entityType, 'concept');
  assert.equal(unified.relations[0].source_tag, 'fact');
  assert.equal(unified.relations[0].linkSource, 'fact');

  const doc = graphDtoService.fromDocPrisma({
    docId: 'doc-1',
    entities: [{ id: 'de1', cleanedName: '实体', description: '描述', entityType: 'process', source: 'fact' }],
    relations: [{ id: 'dr1', sourceEntityId: 'de1', targetEntityId: 'de1', cleanedName: '需要', description: '描述', layer: 'why', source: 'inferred' }],
    principles: [{ id: 'dp1', name: '原则', description: '描述', relatedEntityIds: '[]', source: 'fact' }],
  });

  assert.equal(doc.scope, 'doc');
  assert.equal(doc.docId, 'doc-1');
  assert.equal(doc.relations[0].layer, 'why');
  assert.equal(doc.relations[0].source_tag, 'inferred');

  const note = graphDtoService.fromNoteGraph({
    noteId: 'n1',
    entities: [{ id: 'n1_e1', name: '标签', description: '来自笔记' }],
    relations: [{ id: 'n1_r1', source: 'n1_e1', target: 'n1_e1', name: '共现', description: '描述' }],
  });

  assert.equal(note.scope, 'note');
  assert.equal(note.noteId, 'n1');
  assert.equal(note.relations[0].linkSource, 'inferred');
}

try {
  run();
  process.stdout.write('OK selftest-graphdto-v1\n');
  process.exit(0);
} catch (err) {
  process.stderr.write(`FAIL selftest-graphdto-v1: ${err.message}\n`);
  process.exit(1);
}

