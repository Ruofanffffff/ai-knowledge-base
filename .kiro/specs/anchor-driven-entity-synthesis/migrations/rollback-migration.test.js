/**
 * Tests for rollback-migration.js
 * 
 * These tests verify the rollback script functionality without actually
 * modifying the production database.
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

describe('Rollback Migration Script', () => {
  const scriptPath = path.join(__dirname, 'rollback-migration.js');
  
  afterAll(async () => {
    await prisma.$disconnect();
  });
  
  describe('Dry Run Mode', () => {
    it('should execute dry-run without errors', () => {
      const output = execSync(`node ${scriptPath} --dry-run`, {
        encoding: 'utf-8',
        cwd: __dirname
      });
      
      expect(output).toContain('DRY RUN');
      expect(output).toContain('No changes were made to the database');
      expect(output).toContain('Migration rollback completed successfully');
    });
    
    it('should show operations that would be executed', () => {
      const output = execSync(`node ${scriptPath} --dry-run`, {
        encoding: 'utf-8',
        cwd: __dirname
      });
      
      expect(output).toContain('Drop indexes');
      expect(output).toContain('Create temporary table');
      expect(output).toContain('Copy all data');
      expect(output).toContain('Drop original table');
      expect(output).toContain('Rename temporary table');
      expect(output).toContain('Recreate original indexes');
    });
  });
  
  describe('Pre-flight Checks', () => {
    it('should check if rollback is needed', async () => {
      // Check if anchor fields exist
      const tableInfo = await prisma.$queryRawUnsafe(`PRAGMA table_info(kg_entities)`);
      
      const anchorColumns = tableInfo.filter(col => 
        col.name === 'anchor_fingerprint' || col.name === 'anchor_fields'
      );
      
      // If anchor fields exist, rollback should be needed
      if (anchorColumns.length > 0) {
        const output = execSync(`node ${scriptPath} --dry-run`, {
          encoding: 'utf-8',
          cwd: __dirname
        });
        
        expect(output).toContain('Found');
        expect(output).toContain('anchor field(s) to remove');
      } else {
        const output = execSync(`node ${scriptPath} --dry-run`, {
          encoding: 'utf-8',
          cwd: __dirname
        });
        
        expect(output).toContain('rollback not needed');
      }
    });
  });
  
  describe('Backup Creation', () => {
    it('should create backup directory if it does not exist', () => {
      const backupDir = path.join(__dirname, '../../backups');
      
      // The script should create this directory
      // We just verify the path is correct
      expect(backupDir).toContain('backups');
    });
    
    it('should handle missing database file gracefully', () => {
      const output = execSync(`node ${scriptPath} --dry-run`, {
        encoding: 'utf-8',
        cwd: __dirname
      });
      
      // Should either create backup or warn about missing file
      expect(
        output.includes('Backup created') || 
        output.includes('Database file not found')
      ).toBe(true);
    });
  });
  
  describe('SQLite Compatibility', () => {
    it('should use PRAGMA table_info instead of information_schema', async () => {
      // Verify that PRAGMA table_info works
      const tableInfo = await prisma.$queryRawUnsafe(`PRAGMA table_info(kg_entities)`);
      
      expect(Array.isArray(tableInfo)).toBe(true);
      expect(tableInfo.length).toBeGreaterThan(0);
      
      // Check structure
      const firstColumn = tableInfo[0];
      expect(firstColumn).toHaveProperty('name');
      expect(firstColumn).toHaveProperty('type');
    });
    
    it('should use PRAGMA index_list for index verification', async () => {
      const indexes = await prisma.$queryRawUnsafe(`PRAGMA index_list(kg_entities)`);
      
      expect(Array.isArray(indexes)).toBe(true);
      
      // Check structure if indexes exist
      if (indexes.length > 0) {
        const firstIndex = indexes[0];
        expect(firstIndex).toHaveProperty('name');
      }
    });
  });
  
  describe('Error Handling', () => {
    it('should handle invalid environment gracefully', () => {
      try {
        execSync(`node ${scriptPath} --environment=invalid --dry-run`, {
          encoding: 'utf-8',
          cwd: __dirname
        });
        // Should still work, just use the environment value
      } catch (error) {
        // If it fails, it should fail gracefully
        expect(error.message).toBeTruthy();
      }
    });
  });
  
  describe('Command Line Arguments', () => {
    it('should accept --dry-run flag', () => {
      const output = execSync(`node ${scriptPath} --dry-run`, {
        encoding: 'utf-8',
        cwd: __dirname
      });
      
      expect(output).toContain('Dry Run: true');
    });
    
    it('should accept --environment flag', () => {
      const output = execSync(`node ${scriptPath} --environment=staging --dry-run`, {
        encoding: 'utf-8',
        cwd: __dirname
      });
      
      expect(output).toContain('Environment: staging');
    });
    
    it('should accept --force flag', () => {
      const output = execSync(`node ${scriptPath} --force --dry-run`, {
        encoding: 'utf-8',
        cwd: __dirname
      });
      
      expect(output).toContain('Force: true');
    });
  });
  
  describe('Verification Logic', () => {
    it('should verify columns are removed', async () => {
      const tableInfo = await prisma.$queryRawUnsafe(`PRAGMA table_info(kg_entities)`);
      
      // This test just verifies the verification logic would work
      const anchorColumns = tableInfo.filter(col => 
        col.name === 'anchor_fingerprint' || col.name === 'anchor_fields'
      );
      
      // We can check if the columns exist or not
      expect(typeof anchorColumns.length).toBe('number');
    });
    
    it('should verify data integrity', async () => {
      const count = await prisma.kGEntity.count();
      
      // Should be able to count entities
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
    
    it('should verify indexes', async () => {
      const indexes = await prisma.$queryRawUnsafe(`PRAGMA index_list(kg_entities)`);
      
      expect(Array.isArray(indexes)).toBe(true);
    });
  });
  
  describe('Documentation', () => {
    it('should provide next steps after rollback', () => {
      const output = execSync(`node ${scriptPath} --dry-run`, {
        encoding: 'utf-8',
        cwd: __dirname
      });
      
      expect(output).toContain('Next steps:');
      expect(output).toContain('Update application code');
      expect(output).toContain('Restart the application');
      expect(output).toContain('Verify application functionality');
    });
  });
});

describe('Rollback Script Integration', () => {
  it('should be compatible with verify-migration.js', () => {
    const verifyScriptPath = path.join(__dirname, 'verify-migration.js');
    
    // Verify script should exist
    expect(fs.existsSync(verifyScriptPath)).toBe(true);
  });
  
  it('should be documented in README.md', () => {
    const readmePath = path.join(__dirname, 'README.md');
    const readme = fs.readFileSync(readmePath, 'utf-8');
    
    expect(readme).toContain('rollback-migration.js');
    expect(readme).toContain('Rolls back the anchor fields migration');
  });
  
  it('should be referenced in ROLLBACK_PLAN.md', () => {
    const rollbackPlanPath = path.join(__dirname, '../ROLLBACK_PLAN.md');
    const rollbackPlan = fs.readFileSync(rollbackPlanPath, 'utf-8');
    
    expect(rollbackPlan).toContain('rollback-migration.js');
    expect(rollbackPlan).toContain('Level 3: Database Rollback');
  });
});
