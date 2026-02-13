import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ImageBlockView from './ImageBlockView';

export interface ImageBlockAttributes {
  src: string;
  alt: string;
  analysisId: string | null;
  analysisStatus: 'pending' | 'completed' | 'failed' | 'none';
}

/**
 * Custom Tiptap Node extension for image blocks with AI recognition support.
 *
 * Renders an image with a status indicator showing the AI analysis state.
 * Supports drag-and-drop reordering within the editor.
 */
const ImageBlockExtension = Node.create({
  name: 'imageBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: '',
        parseHTML: (element) => {
          const img = element.querySelector('img');
          return img?.getAttribute('src') || element.getAttribute('src') || '';
        },
      },
      alt: {
        default: '',
        parseHTML: (element) => {
          const img = element.querySelector('img');
          return img?.getAttribute('alt') || element.getAttribute('alt') || '';
        },
      },
      analysisId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-analysis-id') || null,
      },
      analysisStatus: {
        default: 'pending',
        parseHTML: (element) => element.getAttribute('data-analysis-status') || 'pending',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="image-block"]',
      },
      {
        tag: 'img[src]',
        getAttrs: (element) => {
          const el = element as HTMLImageElement;
          return {
            src: el.getAttribute('src') || '',
            alt: el.getAttribute('alt') || '',
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'image-block',
        'data-analysis-id': HTMLAttributes.analysisId || '',
        'data-analysis-status': HTMLAttributes.analysisStatus || 'pending',
      }),
      [
        'img',
        {
          src: HTMLAttributes.src,
          alt: HTMLAttributes.alt,
          referrerpolicy: 'no-referrer',
          style: 'max-width:100%;height:auto;display:block;',
        },
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockView);
  },
});

export default ImageBlockExtension;
