import { describe, it, expect } from 'vitest';
import ImageBlockExtension from '../ImageBlockExtension';

describe('ImageBlockExtension', () => {
  it('should have the correct node name', () => {
    expect(ImageBlockExtension.name).toBe('imageBlock');
  });

  it('should define required attributes with correct defaults', () => {
    const attrs = ImageBlockExtension.config.addAttributes?.call(
      ImageBlockExtension
    );
    expect(attrs).toBeDefined();
    expect(attrs!.src.default).toBe('');
    expect(attrs!.alt.default).toBe('');
    expect(attrs!.analysisId.default).toBeNull();
    expect(attrs!.analysisStatus.default).toBe('pending');
  });

  it('should be configured as a block group atom node', () => {
    expect(ImageBlockExtension.config.group).toBe('block');
    expect(ImageBlockExtension.config.atom).toBe(true);
    expect(ImageBlockExtension.config.draggable).toBe(true);
  });

  it('should parse from div[data-type="image-block"] and img[src]', () => {
    const parseRules = ImageBlockExtension.config.parseHTML?.call(
      ImageBlockExtension
    );
    expect(parseRules).toBeDefined();
    expect(parseRules).toHaveLength(2);
    expect(parseRules![0].tag).toBe('div[data-type="image-block"]');
    expect(parseRules![1].tag).toBe('img[src]');
  });
});
