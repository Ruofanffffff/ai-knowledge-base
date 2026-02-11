/**
 * Property-Based Tests for No Demo Data Functions
 * 
 * Feature: frontend-data-api-migration
 * Property 7: No Demo Data Functions
 * Validates: Requirements 3.5, 6.1
 * 
 * These tests verify that frontend component files do not contain
 * demo data generation functions like getDemoNodes() or getDemoLinks().
 */

import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Property 7: No Demo Data Functions', () => {
  /**
   * Property: For any frontend component file, there are no demo data
   * generation functions like getDemoNodes() or getDemoLinks().
   * 
   * This test scans all page and component files to ensure no demo
   * data functions exist in production code.
   */
  test('components should not contain demo data generation functions', () => {
    const srcDir = path.join(__dirname, '..');
    const violations: Array<{ file: string; line: number; functionName: string }> = [];

    // Recursively scan directories
    const scanDirectory = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip test directories and node_modules
        if (entry.name === '__tests__' || 
            entry.name === 'test' || 
            entry.name === 'node_modules' ||
            entry.name.includes('.test.') ||
            entry.name.includes('.spec.')) {
          continue;
        }

        if (entry.isDirectory()) {
          scanDirectory(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');

          // Patterns for demo data functions
          const demoFunctionPatterns = [
            /function\s+(getDemo\w+)/,
            /const\s+(getDemo\w+)\s*=\s*\(/,
            /function\s+(generateDemo\w+)/,
            /const\s+(generateDemo\w+)\s*=\s*\(/,
            /function\s+(createDemo\w+)/,
            /const\s+(createDemo\w+)\s*=\s*\(/,
            /function\s+(mockDemo\w+)/,
            /const\s+(mockDemo\w+)\s*=\s*\(/,
          ];

          lines.forEach((line, index) => {
            for (const pattern of demoFunctionPatterns) {
              const match = line.match(pattern);
              if (match) {
                violations.push({
                  file: path.relative(srcDir, fullPath),
                  line: index + 1,
                  functionName: match[1]
                });
              }
            }
          });
        }
      }
    };

    scanDirectory(srcDir);

    if (violations.length > 0) {
      const violationReport = violations.map(v => 
        `  ${v.file}:${v.line} - ${v.functionName}()`
      ).join('\n');
      
      expect.fail(
        `Found ${violations.length} demo data function(s):\n${violationReport}\n\n` +
        'Demo data functions should be removed and replaced with API calls.'
      );
    }

    expect(violations).toHaveLength(0);
  });

  /**
   * Property: Components should not have functions that return hardcoded arrays
   * 
   * This test checks for functions that return hardcoded data arrays,
   * which are often demo data generators.
   */
  test('components should not have functions returning hardcoded data arrays', () => {
    const pagesDir = path.join(__dirname, '../pages');
    const allFiles = fs.readdirSync(pagesDir);
    const pageFiles = allFiles
      .filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))
      .map(f => path.join(pagesDir, f));

    const violations: Array<{ file: string; line: number; snippet: string }> = [];

    for (const filePath of pageFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // Skip test files
      if (filePath.includes('.test.') || filePath.includes('__tests__')) {
        continue;
      }

      // Pattern: function that returns an array with object literals
      // Example: function getData() { return [{ id: 1, ... }, { id: 2, ... }]; }
      let inFunction = false;
      let functionStartLine = 0;
      let braceCount = 0;

      lines.forEach((line, index) => {
        // Detect function start
        if (/function\s+\w+\s*\(/.test(line) || /const\s+\w+\s*=\s*\(.*\)\s*=>/.test(line)) {
          inFunction = true;
          functionStartLine = index;
          braceCount = 0;
        }

        if (inFunction) {
          // Count braces to track function scope
          braceCount += (line.match(/\{/g) || []).length;
          braceCount -= (line.match(/\}/g) || []).length;

          // Check if function returns hardcoded array
          if (/return\s*\[\s*\{/.test(line)) {
            violations.push({
              file: path.basename(filePath),
              line: functionStartLine + 1,
              snippet: lines[functionStartLine].trim().substring(0, 60) + '...'
            });
          }

          // Function ended
          if (braceCount === 0 && /\}/.test(line)) {
            inFunction = false;
          }
        }
      });
    }

    if (violations.length > 0) {
      const violationReport = violations.map(v => 
        `  ${v.file}:${v.line} - ${v.snippet}`
      ).join('\n');
      
      expect.fail(
        `Found ${violations.length} function(s) returning hardcoded arrays:\n${violationReport}\n\n` +
        'Functions should fetch data from API instead of returning hardcoded arrays.'
      );
    }

    expect(violations).toHaveLength(0);
  });

  /**
   * Property: No functions with "demo" or "mock" in their names in production code
   * 
   * This test ensures that any function with "demo" or "mock" in its name
   * only exists in test files.
   */
  test('production code should not have functions with demo/mock in name', () => {
    const srcDir = path.join(__dirname, '..');
    const violations: Array<{ file: string; functionName: string }> = [];

    const scanDirectory = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip test directories
        if (entry.name === '__tests__' || 
            entry.name === 'test' || 
            entry.name === 'node_modules' ||
            entry.name.includes('.test.') ||
            entry.name.includes('.spec.')) {
          continue;
        }

        if (entry.isDirectory()) {
          scanDirectory(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          const content = fs.readFileSync(fullPath, 'utf-8');

          // Find function declarations with demo/mock in name
          // But exclude common event handler patterns like "MouseDown"
          const functionPattern = /(?:function|const)\s+(\w*(?:demo|mock)\w*)\s*[=\(]/gi;
          let match;

          while ((match = functionPattern.exec(content)) !== null) {
            const funcName = match[1];
            // Skip if it's part of a common word like "MouseDown", "Demonstrate", etc.
            if (!/Mouse|Keyboard|Touch|Pointer|Drag|Drop|Click|Press|demonstrate/i.test(funcName)) {
              violations.push({
                file: path.relative(srcDir, fullPath),
                functionName: funcName
              });
            }
          }
        }
      }
    };

    scanDirectory(srcDir);

    if (violations.length > 0) {
      const violationReport = violations.map(v => 
        `  ${v.file} - ${v.functionName}()`
      ).join('\n');
      
      expect.fail(
        `Found ${violations.length} function(s) with demo/mock in name:\n${violationReport}\n\n` +
        'Functions with demo/mock in their names should only exist in test files.'
      );
    }

    expect(violations).toHaveLength(0);
  });
});
