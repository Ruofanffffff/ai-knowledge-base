/**
 * Property-Based Tests for No Hardcoded Data
 * 
 * Feature: frontend-data-api-migration
 * Property 6: No Hardcoded Data Arrays
 * Validates: Requirements 3.4, 6.2
 * 
 * These tests verify that frontend component files do not contain
 * hardcoded data arrays or objects that should come from the backend API.
 */

import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Property 6: No Hardcoded Data Arrays', () => {
  /**
   * Property: For any frontend component file, there are no hardcoded data arrays
   * or objects that should come from the backend API.
   * 
   * This test scans all page components and verifies that they don't contain
   * suspicious hardcoded data patterns.
   */
  test('page components should not contain hardcoded business data arrays', () => {
    const pagesDir = path.join(__dirname, '../pages');
    const allFiles = fs.readdirSync(pagesDir);
    const pageFiles = allFiles
      .filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))
      .map(f => path.join(pagesDir, f));

    const violations: Array<{ file: string; line: number; content: string }> = [];

    for (const filePath of pageFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // Skip test files
      if (filePath.includes('.test.') || filePath.includes('__tests__')) {
        continue;
      }

      // Patterns that indicate hardcoded business data
      const suspiciousPatterns = [
        // Arrays with object literals containing business data fields
        /const\s+\w+\s*=\s*\[\s*\{[^}]*(?:id|title|name|content|data):/,
        // Large arrays (more than 2 items) with object literals
        /const\s+\w+\s*=\s*\[\s*\{[^}]+\},\s*\{[^}]+\},\s*\{/,
      ];

      // Allowed patterns (UI configuration, constants, etc.)
      const allowedPatterns = [
        /const\s+tabs\s*=/, // UI tabs configuration
        /const\s+sizes\s*=/, // File size units
        /const\s+colors\s*=/, // Color constants
        /const\s+options\s*=/, // UI options
        /const\s+columns\s*=/, // Table columns configuration
      ];

      lines.forEach((line, index) => {
        // Check if line matches suspicious patterns
        const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(line));
        
        // Check if line matches allowed patterns
        const isAllowed = allowedPatterns.some(pattern => pattern.test(line));

        if (isSuspicious && !isAllowed) {
          violations.push({
            file: path.basename(filePath),
            line: index + 1,
            content: line.trim().substring(0, 80) + '...'
          });
        }
      });
    }

    // Report violations
    if (violations.length > 0) {
      const violationReport = violations.map(v => 
        `  ${v.file}:${v.line} - ${v.content}`
      ).join('\n');
      
      expect.fail(
        `Found ${violations.length} potential hardcoded data array(s):\n${violationReport}\n\n` +
        'These arrays should be fetched from the backend API instead of being hardcoded.'
      );
    }

    // Test passes if no violations found
    expect(violations).toHaveLength(0);
  });

  /**
   * Property: Components that display dynamic data should use API service
   * 
   * This test verifies that components import and use the API service
   * when they need to display dynamic data.
   */
  test('components displaying data should import API service', () => {
    const pagesDir = path.join(__dirname, '../pages');
    const allFiles = fs.readdirSync(pagesDir);
    const pageFiles = allFiles
      .filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))
      .map(f => path.join(pagesDir, f));

    const componentsNeedingApi = [
      'Graph.tsx',
      'DocumentsList.tsx',
      'Chat.tsx',
      'Dashboard.tsx'
    ];

    const violations: string[] = [];

    for (const filePath of pageFiles) {
      const fileName = path.basename(filePath);
      
      // Skip test files and components that don't need API
      if (filePath.includes('.test.') || !componentsNeedingApi.includes(fileName)) {
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf-8');

      // Check if component imports API service or useApiData hook
      const hasApiImport = 
        content.includes("from '../services/api'") ||
        content.includes("from '../hooks/useApiData'") ||
        content.includes('apiService') ||
        content.includes('useApiData');

      if (!hasApiImport) {
        violations.push(fileName);
      }
    }

    if (violations.length > 0) {
      expect.fail(
        `The following components should import API service but don't:\n` +
        violations.map(f => `  - ${f}`).join('\n')
      );
    }

    expect(violations).toHaveLength(0);
  });

  /**
   * Property: No inline mock data in production components
   * 
   * This test verifies that components don't contain inline mock data
   * that looks like it should come from an API.
   */
  test('components should not contain inline mock data objects', () => {
    const pagesDir = path.join(__dirname, '../pages');
    const allFiles = fs.readdirSync(pagesDir);
    const pageFiles = allFiles
      .filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))
      .map(f => path.join(pagesDir, f));

    const violations: Array<{ file: string; pattern: string }> = [];

    for (const filePath of pageFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Skip test files
      if (filePath.includes('.test.') || filePath.includes('__tests__')) {
        continue;
      }

      // Patterns that indicate mock data
      const mockDataPatterns = [
        { pattern: /const\s+mock\w+\s*=\s*\[/, description: 'mock array' },
        { pattern: /const\s+fake\w+\s*=\s*\[/, description: 'fake array' },
        { pattern: /const\s+sample\w+\s*=\s*\[/, description: 'sample array' },
        { pattern: /const\s+test\w+\s*=\s*\[/, description: 'test array' },
      ];

      mockDataPatterns.forEach(({ pattern, description }) => {
        if (pattern.test(content)) {
          violations.push({
            file: path.basename(filePath),
            pattern: description
          });
        }
      });
    }

    if (violations.length > 0) {
      const violationReport = violations.map(v => 
        `  ${v.file} - contains ${v.pattern}`
      ).join('\n');
      
      expect.fail(
        `Found mock data in production components:\n${violationReport}\n\n` +
        'Mock data should only exist in test files.'
      );
    }

    expect(violations).toHaveLength(0);
  });
});
