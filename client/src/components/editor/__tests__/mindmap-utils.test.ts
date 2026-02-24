import { describe, it, expect } from 'vitest';
import {
  buildMindmapTiptapNodes,
  buildBulletList,
  type MindmapJSON,
} from '../mindmap-utils';

describe('buildMindmapTiptapNodes', () => {
  it('should render central_topic as h3 heading', () => {
    const data: MindmapJSON = {
      central_topic: '测试主题',
      nodes: [
        { id: '1', text: '分支1' },
        { id: '2', text: '分支2' },
        { id: '3', text: '分支3' },
      ],
    };
    const result = buildMindmapTiptapNodes(data);
    expect(result[0]).toEqual({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: '测试主题' }],
    });
  });

  it('should render nodes as bulletList', () => {
    const data: MindmapJSON = {
      central_topic: '主题',
      nodes: [
        { id: '1', text: '节点A' },
        { id: '2', text: '节点B' },
      ],
    };
    const result = buildMindmapTiptapNodes(data);
    const bulletList = result[1] as any;
    expect(bulletList.type).toBe('bulletList');
    expect(bulletList.content).toHaveLength(2);
    expect(bulletList.content[0].type).toBe('listItem');
    expect(bulletList.content[0].content[0].content[0].text).toBe('节点A');
  });

  it('should recursively render nested children', () => {
    const data: MindmapJSON = {
      central_topic: '根',
      nodes: [
        {
          id: '1',
          text: '父节点',
          children: [
            { id: '1-1', text: '子节点1' },
            { id: '1-2', text: '子节点2' },
          ],
        },
      ],
    };
    const result = buildMindmapTiptapNodes(data);
    const bulletList = result[1] as any;
    const listItem = bulletList.content[0];
    // listItem should have paragraph + nested bulletList
    expect(listItem.content).toHaveLength(2);
    expect(listItem.content[1].type).toBe('bulletList');
    expect(listItem.content[1].content).toHaveLength(2);
    expect(listItem.content[1].content[0].content[0].content[0].text).toBe(
      '子节点1'
    );
  });

  it('should not add nested bulletList for nodes without children', () => {
    const data: MindmapJSON = {
      central_topic: '主题',
      nodes: [{ id: '1', text: '叶子节点' }],
    };
    const result = buildMindmapTiptapNodes(data);
    const listItem = (result[1] as any).content[0];
    expect(listItem.content).toHaveLength(1);
    expect(listItem.content[0].type).toBe('paragraph');
  });

  it('should return exactly 2 top-level elements', () => {
    const data: MindmapJSON = {
      central_topic: '主题',
      nodes: [{ id: '1', text: '节点' }],
    };
    const result = buildMindmapTiptapNodes(data);
    expect(result).toHaveLength(2);
  });
});

describe('buildBulletList', () => {
  it('should create a bulletList with listItems', () => {
    const result = buildBulletList([
      { id: '1', text: 'A' },
      { id: '2', text: 'B' },
    ]);
    expect(result).toEqual({
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'A' }] },
          ],
        },
        {
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'B' }] },
          ],
        },
      ],
    });
  });

  it('should handle deeply nested children', () => {
    const result = buildBulletList([
      {
        id: '1',
        text: 'L1',
        children: [
          {
            id: '1-1',
            text: 'L2',
            children: [{ id: '1-1-1', text: 'L3' }],
          },
        ],
      },
    ]) as any;

    const l1Item = result.content[0];
    const l2List = l1Item.content[1];
    const l2Item = l2List.content[0];
    const l3List = l2Item.content[1];
    const l3Item = l3List.content[0];

    expect(l3Item.content[0].content[0].text).toBe('L3');
    expect(l3Item.content).toHaveLength(1); // no further nesting
  });
});
