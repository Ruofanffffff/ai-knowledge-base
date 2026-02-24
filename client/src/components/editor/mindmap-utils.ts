export interface MindmapNode {
  id: string;
  text: string;
  children?: MindmapNode[];
}

export interface MindmapJSON {
  central_topic: string;
  nodes: MindmapNode[];
}

/**
 * 将脑图 JSON 转换为 Tiptap 节点结构
 * central_topic -> h3 heading
 * nodes -> 递归嵌套的 bulletList
 */
export function buildMindmapTiptapNodes(mindmapData: MindmapJSON): object[] {
  return [
    {
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: mindmapData.central_topic }],
    },
    buildBulletList(mindmapData.nodes),
  ];
}

export function buildBulletList(nodes: MindmapNode[]): object {
  return {
    type: 'bulletList',
    content: nodes.map((node) => ({
      type: 'listItem',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: node.text }] },
        ...(node.children?.length ? [buildBulletList(node.children)] : []),
      ],
    })),
  };
}
