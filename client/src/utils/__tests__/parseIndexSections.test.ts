import { describe, it, expect } from 'vitest';
import { parseIndexSections } from '../parseIndexSections';

describe('parseIndexSections', () => {
  describe('edge cases', () => {
    it('returns empty array for empty string', () => {
      expect(parseIndexSections('')).toEqual([]);
    });

    it('returns empty array for whitespace-only string', () => {
      expect(parseIndexSections('   \n  \t  ')).toEqual([]);
    });

    it('returns single summary section when no bold markers exist', () => {
      const text = '这是一段没有加粗标记的普通文本。';
      const result = parseIndexSections(text);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('summary');
      expect(result[0].content).toBe(text);
    });
  });

  describe('section splitting by bold titles', () => {
    it('splits text into sections by bold title markers', () => {
      const text = [
        '这是主旨概述内容。',
        '',
        '**核心概念及其角色：**',
        '概念内容在这里。',
        '',
        '**关键关系：**',
        '关系内容在这里。',
      ].join('\n');

      const result = parseIndexSections(text);
      expect(result.length).toBeGreaterThanOrEqual(3);

      const summary = result.find((s) => s.type === 'summary');
      expect(summary).toBeDefined();
      expect(summary!.content).toContain('主旨概述');

      const concepts = result.find((s) => s.type === 'concepts');
      expect(concepts).toBeDefined();
      expect(concepts!.title).toContain('核心概念');

      const relations = result.find((s) => s.type === 'relations');
      expect(relations).toBeDefined();
      expect(relations!.title).toContain('关键关系');
    });

    it('identifies first section before any bold marker as summary', () => {
      const text = '前言文本。\n\n**某个标题：**\n后续内容。';
      const result = parseIndexSections(text);
      expect(result[0].type).toBe('summary');
      expect(result[0].content).toBe('前言文本。');
    });

    it('classifies sections with 核心概念 keyword as concepts', () => {
      const text = '**核心概念及其角色：**\n一些概念内容。';
      const result = parseIndexSections(text);
      const concepts = result.find((s) => s.type === 'concepts');
      expect(concepts).toBeDefined();
    });

    it('classifies sections with 关键关系 keyword as relations', () => {
      const text = '**关键关系：**\n一些关系内容。';
      const result = parseIndexSections(text);
      const relations = result.find((s) => s.type === 'relations');
      expect(relations).toBeDefined();
    });

    it('classifies other bold sections as other type', () => {
      const text = '**其他信息：**\n一些其他内容。';
      const result = parseIndexSections(text);
      const other = result.find((s) => s.type === 'other');
      expect(other).toBeDefined();
    });
  });

  describe('concept item parsing', () => {
    it('parses concept items in - **名称（角色）**：描述 format', () => {
      const text = [
        '**核心概念及其角色：**',
        '- **React（前端框架）**：用于构建用户界面的JavaScript库',
        '- **TypeScript（编程语言）**：JavaScript的超集，提供类型系统',
      ].join('\n');

      const result = parseIndexSections(text);
      const concepts = result.find((s) => s.type === 'concepts');
      expect(concepts).toBeDefined();
      expect(concepts!.items).toBeDefined();
      expect(concepts!.items).toHaveLength(2);

      expect(concepts!.items![0]).toEqual({
        name: 'React',
        role: '前端框架',
        description: '用于构建用户界面的JavaScript库',
      });

      expect(concepts!.items![1]).toEqual({
        name: 'TypeScript',
        role: '编程语言',
        description: 'JavaScript的超集，提供类型系统',
      });
    });

    it('handles half-width parentheses in concept items', () => {
      const text = [
        '**核心概念及其角色：**',
        '- **Node.js(运行时)**：服务端JavaScript运行环境',
      ].join('\n');

      const result = parseIndexSections(text);
      const concepts = result.find((s) => s.type === 'concepts');
      expect(concepts!.items).toHaveLength(1);
      expect(concepts!.items![0].name).toBe('Node.js');
      expect(concepts!.items![0].role).toBe('运行时');
    });

    it('handles half-width colon in concept items', () => {
      const text = [
        '**核心概念及其角色：**',
        '- **Vite（构建工具）**: 下一代前端构建工具',
      ].join('\n');

      const result = parseIndexSections(text);
      const concepts = result.find((s) => s.type === 'concepts');
      expect(concepts!.items).toHaveLength(1);
      expect(concepts!.items![0].description).toBe('下一代前端构建工具');
    });
  });

  describe('realistic document index text', () => {
    it('parses a full realistic indexed text correctly', () => {
      const text = [
        '本文档是关于税务局数据管理系统的技术规范，详细描述了系统架构和核心模块。',
        '',
        '**核心概念及其角色：**',
        '- **数据采集模块（数据入口）**：负责从各渠道收集纳税人申报数据',
        '- **风险评估引擎（分析核心）**：基于规则和模型对纳税数据进行风险评分',
        '- **报表生成器（输出模块）**：将分析结果转化为可视化报表',
        '',
        '**关键关系：**',
        '数据采集模块将原始数据传递给风险评估引擎进行分析。',
        '风险评估引擎的结果由报表生成器进行可视化呈现。',
      ].join('\n');

      const result = parseIndexSections(text);

      // Should have summary, concepts, relations
      expect(result.find((s) => s.type === 'summary')).toBeDefined();
      expect(result.find((s) => s.type === 'concepts')).toBeDefined();
      expect(result.find((s) => s.type === 'relations')).toBeDefined();

      const concepts = result.find((s) => s.type === 'concepts')!;
      expect(concepts.items).toHaveLength(3);
      expect(concepts.items![0].name).toBe('数据采集模块');
      expect(concepts.items![0].role).toBe('数据入口');
      expect(concepts.items![1].name).toBe('风险评估引擎');
      expect(concepts.items![2].name).toBe('报表生成器');

      const relations = result.find((s) => s.type === 'relations')!;
      expect(relations.content).toContain('数据采集模块');
    });
  });
});
