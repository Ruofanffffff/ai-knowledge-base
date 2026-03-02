/**
 * MindmapView — compact, read-only inline mindmap preview.
 * Used in the AI panel result card (before insertion into the note).
 * Renders the full radial SVG via MindmapCanvas.
 */
import React from 'react';
import { MindmapCanvas, type MindmapData } from './MindmapCanvas';

interface MindmapViewProps {
  data: MindmapData;
}

export function MindmapView({ data }: MindmapViewProps) {
  return (
    <div style={{ width: '100%', aspectRatio: '1/1' }}>
      <MindmapCanvas data={data} editable={false} compact={false} />
    </div>
  );
}
