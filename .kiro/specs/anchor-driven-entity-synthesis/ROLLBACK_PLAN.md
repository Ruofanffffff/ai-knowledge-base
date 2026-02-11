# Anchor-Driven Entity Synthesis: Rollback Plan

## Document Information

**Version**: 1.0  
**Created**: 2026-02-08  
**Status**: Production Ready  
**Severity**: Critical - Follow Exactly

## Executive Summary

This document provides comprehensive rollback procedures for the Anchor-Driven Entity Synthesis system. It covers all rollback scenarios from minor configuration changes to full system rollback with data restoration.

**Key Principle**: Rollback should be fast, safe, and preserve data integrity.

---

## Table of Contents

1. [Rollback Decision Matrix](#rollback-decision-matrix)
2. [Rollback Levels](#rollback-levels)
3. [Rollback Procedures](#rollback-procedures)
4. [Data Recovery](#data-recovery)
5. [Post-Rollback Validation](#post-rollback-validation)
6. [Communication Plan](#communication-plan)

---

## Rollback Decision Matrix

### When to Rollback

| Severity | Condition | Action | Timeline |
|----------|-----------|--------|----------|
| **P0 - Critical** | Data corruption detected | Full rollback immediately | <15 min |
| **P0 - Critical** | Error rate >5% | Full rollback immediately | <15 min |
| **P0 - Critical** | System unavailable | Full rollback immediately | <15 min |
| **P1 - High** | Performance degradation >20% | Rollback within 1 hour | <30 min |
| **P1 - High** | Entity merge accuracy <90% | Rollback within 1 hour | <30 min |
| **P2 - Medium** | Error rate 1-5% | Disable features, monitor | <1 hour |
| **P2 - Medium** | Performance degradation 10-20% | Disable features, monitor | <1 hour |
| **P3 - Low** | Minor issues, <1% impact | Monitor, fix forward | N/A |

### Decision Makers

- **P0 (Critical)**: Any on-call engineer can initiate
- **P1 (High)**: Deployment lead or senior engineer
- **P2 (Medium)**: Deployment lead with team consultation
- **P3 (Low)**: Development team decision

---

## Rollback Levels

### Level 1: Configuration Rollback (Fastest - 2 minutes)

**When to Use**:
- Feature flag issues
- Configuration errors
- No code or database changes needed

**Impact**: Minimal, no data loss

### Level 2: Code Rollback (Fast - 5 minutes)

**When to Use**:
- Code bugs without database changes
- Logic errors
- Performance issues in code

**Impact**: Low, no data loss

### Level 3: Database Rollback (Medium - 15 minutes)

**When to Use**:
- Database migration issues
- Schema problems
- Index issues

**Impact**: Medium, anchor data lost (can be regenerated)

### Level 4: Full System Rollback (Slow - 30 minutes)

**When to Use**:
- Data corruption
- Multiple system failures
- Unrecoverable errors

**Impact**: High, requires backup restoration

---

## Rollback Procedures

### Level 1: Configuration Rollback

#### Scenario: Disable Anchor Mode

**Time**: ~2 minutes  
**Risk**: Minimal  
**Data Loss**: None

**Steps**:

1. **Disable anchor mode via environment variable**
   ```bash
   # Update .env or set environment variable
   export ANCHOR_MODE_ENABLED=false
   ```

2. **Restart application**
   ```bash
   npm run restart:production
   ```

3. **Verify service health**
   ```bash
   npm run health-check:production
   ```

4. **Monitor for 5 minutes**
   - Check error logs
   - Verify requests processing
   - Confirm error rate dropped

**Validation**:
- [ ] Service restarted successfully
- [ ] Error rate <0.1%
- [ ] Requests processing normally
- [ ] No new errors in logs

#### Scenario: Switch to Legacy Mode

**Time**: ~2 minutes  
**Risk**: Minimal  
**Data Loss**: None

**Steps**:

1. **Switch compatibility mode**
   ```bash
   export ANCHOR_COMPATIBILITY_MODE=LEGACY
   ```

2. **Restart application**
   ```bash
   npm run restart:production
   ```

3. **Verify legacy mode active**
   ```bash
   # Check logs for "Using LEGACY compatibility mode"
   tail -f logs/application.log | grep "compatibility mode"
   ```

**Validation**:
- [ ] Legacy mode active
- [ ] Entities created without anchors
- [ ] No anchor-related errors
- [ ] System stable

#### Scenario: Disable Conflict Detection

**Time**: ~2 minutes  
**Risk**: Minimal  
**Data Loss**: None

**Steps**:

1. **Disable conflict detection**
   ```bash
   export ANCHOR_CONFLICT_DETECTION=false
   ```

2. **Restart application**
   ```bash
   npm run restart:production
   ```

**Validation**:
- [ ] Conflict detection disabled
- [ ] Merging continues without checks
- [ ] Performance improved
- [ ] No errors

---

### Level 2: Code Rollback

#### Scenario: Revert to Previous Code Version

**Time**: ~5 minutes  
**Risk**: Low  
**Data Loss**: None

**Prerequisites**:
- Know the commit hash to revert to
- Have deployment access
- Database migration not yet applied (or compatible)

**Steps**:

1. **Identify target commit**
   ```bash
   # Find the last known good commit
   git log --oneline -10
   
   # Example output:
   # abc1234 (HEAD) Deploy anchor system
   # def5678 Last stable version  <-- Target this
   ```

2. **Create revert commit**
   ```bash
   # Option A: Revert specific commit
   git revert abc1234
   
   # Option B: Reset to previous commit (use with caution)
   git reset --hard def5678
   git push --force origin main
   ```

3. **Deploy reverted code**
   ```bash
   npm run deploy:production
   ```

4. **Restart services**
   ```bash
   npm run restart:production
   ```

5. **Verify deployment**
   ```bash
   npm run health-check:production
   npm run test:smoke
   ```

**Validation**:
- [ ] Code reverted successfully
- [ ] Services restarted
- [ ] Smoke tests passing
- [ ] Error rate normal
- [ ] No anchor-related code running

**Post-Rollback**:
- [ ] Update deployment status
- [ ] Notify stakeholders
- [ ] Document issues encountered
- [ ] Plan fix or alternative approach

---

### Level 3: Database Rollback

#### Scenario: Rollback Database Migration

**Time**: ~15 minutes  
**Risk**: Medium  
**Data Loss**: Anchor fingerprints and anchor fields (can be regenerated)

**⚠️ WARNING**: This will remove all anchor fingerprints and anchor fields. Ensure you have a backup.

**Prerequisites**:
- Database backup exists
- Migration was applied
- Have database access

**Steps**:

1. **Stop application** (prevent writes during rollback)
   ```bash
   npm run stop:production
   ```

2. **Create emergency backup**
   ```bash
   mkdir -p backups/emergency
   cp prisma/knowledge-base.db backups/emergency/pre-rollback-$(date +%Y%m%d-%H%M%S).db
   ```

3. **Run rollback script**
   ```bash
   cd .kiro/specs/anchor-driven-entity-synthesis/migrations
   node rollback-migration.js --environment=production
   ```

   **Script will**:
   - Create automatic backup
   - Prompt for confirmation (10-second delay)
   - Drop anchor_fingerprint and anchor_fields columns
   - Drop associated indexes
   - Verify rollback success

4. **Verify database state**
   ```bash
   node verify-migration.js
   # Should report: "Anchor fields NOT found (expected after rollback)"
   ```

5. **Update Prisma schema** (if needed)
   ```bash
   # Comment out or remove anchor fields from schema.prisma
   # Then regenerate Prisma client
   npx prisma generate
   ```

6. **Restart application**
   ```bash
   npm run start:production
   ```

7. **Verify service health**
   ```bash
   npm run health-check:production
   npm run test:smoke
   ```

**Validation**:
- [ ] Anchor columns removed
- [ ] Indexes dropped
- [ ] Other data intact (verify entity count)
- [ ] Application running without anchor code
- [ ] No database errors
- [ ] Smoke tests passing

**Data Verification**:
```sql
-- Check entity count unchanged
SELECT COUNT(*) FROM kg_entities;

-- Verify anchor columns gone
PRAGMA table_info(kg_entities);
-- Should NOT show anchor_fingerprint or anchor_fields

-- Check data integrity
SELECT COUNT(*) FROM kg_entities WHERE name IS NULL;
-- Should be 0
```

**Post-Rollback**:
- [ ] Document rollback reason
- [ ] Analyze root cause
- [ ] Update deployment plan
- [ ] Communicate to stakeholders

---

### Level 4: Full System Rollback

#### Scenario: Complete System Restoration

**Time**: ~30 minutes  
**Risk**: High  
**Data Loss**: All changes since backup (entities created after backup will be lost)

**⚠️ CRITICAL WARNING**: This is a last resort. All data created after the backup will be permanently lost.

**When to Use**:
- Data corruption detected
- Multiple system failures
- Unrecoverable database state
- Critical business impact

**Prerequisites**:
- Valid backup exists
- Backup timestamp known
- All stakeholders notified
- Approval from deployment lead

**Steps**:

1. **STOP - Confirm Decision**
   ```
   ⚠️  FULL SYSTEM ROLLBACK INITIATED
   
   This will:
   - Restore database from backup
   - Lose all data created after backup
   - Require full system restart
   
   Backup timestamp: [TIMESTAMP]
   Data loss window: [DURATION]
   
   Type "CONFIRM FULL ROLLBACK" to proceed:
   ```

2. **Stop all services**
   ```bash
   npm run stop:production
   
   # Verify no processes running
   ps aux | grep node
   ```

3. **Backup current state** (for forensics)
   ```bash
   mkdir -p backups/forensics
   cp prisma/knowledge-base.db backups/forensics/corrupted-$(date +%Y%m%d-%H%M%S).db
   cp -r logs backups/forensics/logs-$(date +%Y%m%d-%H%M%S)
   ```

4. **Identify backup to restore**
   ```bash
   ls -lh backups/
   # Choose the appropriate backup file
   # Example: kg-backup-2026-02-08T10-00-00-000Z.db
   ```

5. **Restore database**
   ```bash
   # Restore from backup
   cp backups/kg-backup-TIMESTAMP.db prisma/knowledge-base.db
   
   # Verify file integrity
   sqlite3 prisma/knowledge-base.db "PRAGMA integrity_check;"
   # Should output: ok
   ```

6. **Verify database state**
   ```bash
   sqlite3 prisma/knowledge-base.db << EOF
   -- Check entity count
   SELECT COUNT(*) FROM kg_entities;
   
   -- Check table structure
   PRAGMA table_info(kg_entities);
   
   -- Check for anchor columns (should not exist if pre-migration backup)
   SELECT sql FROM sqlite_master WHERE name='kg_entities';
   EOF
   ```

7. **Revert code to match database**
   ```bash
   # If database is pre-migration, revert code too
   git log --oneline -20
   git reset --hard <pre-migration-commit>
   git push --force origin main
   
   npm run deploy:production
   ```

8. **Regenerate Prisma client** (if schema changed)
   ```bash
   npx prisma generate
   ```

9. **Restart services**
   ```bash
   npm run start:production
   ```

10. **Comprehensive validation**
    ```bash
    # Health check
    npm run health-check:production
    
    # Smoke tests
    npm run test:smoke
    
    # Integration tests
    npm run test:integration
    
    # Data integrity check
    npm run verify:data-integrity
    ```

**Validation Checklist**:
- [ ] Database restored successfully
- [ ] Integrity check passed
- [ ] Entity count matches expected
- [ ] Code matches database state
- [ ] Services started successfully
- [ ] Health checks passing
- [ ] Smoke tests passing
- [ ] Integration tests passing
- [ ] No errors in logs
- [ ] API responding correctly
- [ ] User workflows functional

**Data Loss Assessment**:
```sql
-- If you have the corrupted database, compare entity counts
-- Corrupted DB
SELECT COUNT(*) FROM kg_entities;  -- e.g., 1523

-- Restored DB
SELECT COUNT(*) FROM kg_entities;  -- e.g., 1500

-- Data loss: 23 entities
```

**Post-Rollback Actions**:

1. **Immediate** (within 1 hour):
   - [ ] Notify all stakeholders of rollback completion
   - [ ] Document data loss window
   - [ ] Provide status update
   - [ ] Begin root cause analysis

2. **Short-term** (within 24 hours):
   - [ ] Complete root cause analysis
   - [ ] Document lessons learned
   - [ ] Update rollback procedures
   - [ ] Plan remediation strategy

3. **Long-term** (within 1 week):
   - [ ] Implement fixes
   - [ ] Enhance testing
   - [ ] Improve monitoring
   - [ ] Update deployment process

---

## Data Recovery

### Scenario: Recover Lost Anchor Data

If you rolled back the database but want to recover anchor fingerprints:

**Option 1: Regenerate from Existing Entities**

```bash
# Run anchor regeneration script
node scripts/regenerate-anchors.js --environment=production

# This will:
# - Read all existing entities
# - Generate anchor fingerprints
# - Update database
# - Verify integrity
```

**Option 2: Restore from Backup and Migrate Forward**

```bash
# 1. Restore from backup
cp backups/kg-backup-TIMESTAMP.db prisma/knowledge-base.db

# 2. Apply migration
node .kiro/specs/anchor-driven-entity-synthesis/migrations/deploy-migration.js

# 3. Verify
node .kiro/specs/anchor-driven-entity-synthesis/migrations/verify-migration.js
```

### Scenario: Recover Specific Entities

If only specific entities were corrupted:

```sql
-- Export entities from backup
sqlite3 backups/kg-backup-TIMESTAMP.db << EOF
.mode csv
.output recovered-entities.csv
SELECT * FROM kg_entities WHERE id IN ('entity1', 'entity2', 'entity3');
.quit
EOF

-- Import into current database
sqlite3 prisma/knowledge-base.db << EOF
.mode csv
.import recovered-entities.csv kg_entities_temp
INSERT OR REPLACE INTO kg_entities SELECT * FROM kg_entities_temp;
DROP TABLE kg_entities_temp;
.quit
EOF
```

---

## Post-Rollback Validation

### Immediate Validation (within 5 minutes)

```bash
# 1. Service health
npm run health-check:production

# 2. Smoke tests
npm run test:smoke

# 3. Error logs
tail -100 logs/error.log

# 4. Database connection
sqlite3 prisma/knowledge-base.db "SELECT COUNT(*) FROM kg_entities;"
```

### Short-term Validation (within 1 hour)

```bash
# 1. Integration tests
npm run test:integration

# 2. Data integrity
npm run verify:data-integrity

# 3. Performance metrics
npm run metrics:check

# 4. User workflows
npm run test:e2e
```

### Long-term Monitoring (24-48 hours)

- [ ] Monitor error rate (target: <0.1%)
- [ ] Monitor response times (target: <500ms)
- [ ] Monitor memory usage (target: stable)
- [ ] Monitor CPU usage (target: <50%)
- [ ] Check user feedback
- [ ] Review support tickets
- [ ] Analyze logs for patterns

---

## Communication Plan

### Internal Communication

#### Rollback Initiated
```
🚨 ROLLBACK INITIATED

System: Anchor-Driven Entity Synthesis
Level: [1/2/3/4]
Reason: [Brief description]
Impact: [User impact]
ETA: [Estimated completion time]
Lead: [Name]

Status updates every 15 minutes.
```

#### Rollback Complete
```
✅ ROLLBACK COMPLETE

System: Anchor-Driven Entity Synthesis
Level: [1/2/3/4]
Duration: [Actual time taken]
Status: [Stable/Monitoring/Issues]
Data Loss: [None/Minimal/Significant - details]

Next steps:
- [Action 1]
- [Action 2]
- [Action 3]

Post-mortem scheduled for [Date/Time].
```

### External Communication (if needed)

#### User Notification
```
Service Update

We experienced technical issues with our knowledge graph system and have rolled back to a previous stable version.

Impact:
- [Describe user-facing impact]
- [Data loss if any]
- [Functionality affected]

Current Status: System is stable and operating normally.

We apologize for any inconvenience. If you experience any issues, please contact support.
```

---

## Rollback Checklist

### Pre-Rollback
- [ ] Rollback decision approved by authorized person
- [ ] Stakeholders notified
- [ ] Backup verified to exist
- [ ] Rollback procedure reviewed
- [ ] Team members assigned roles
- [ ] Communication channels ready

### During Rollback
- [ ] Services stopped (if required)
- [ ] Emergency backup created
- [ ] Rollback steps executed in order
- [ ] Each step verified before proceeding
- [ ] Issues documented
- [ ] Status updates sent every 15 minutes

### Post-Rollback
- [ ] Services restarted
- [ ] Health checks passing
- [ ] Smoke tests passing
- [ ] Data integrity verified
- [ ] Monitoring active
- [ ] Stakeholders notified of completion
- [ ] Post-mortem scheduled
- [ ] Documentation updated

---

## Rollback Scripts Reference

### Quick Reference

```bash
# Configuration rollback (Level 1)
export ANCHOR_MODE_ENABLED=false
npm run restart:production

# Code rollback (Level 2)
git revert <commit-hash>
npm run deploy:production

# Database rollback (Level 3)
cd .kiro/specs/anchor-driven-entity-synthesis/migrations
node rollback-migration.js --environment=production

# Full system rollback (Level 4)
npm run stop:production
cp backups/kg-backup-TIMESTAMP.db prisma/knowledge-base.db
git reset --hard <commit-hash>
npm run deploy:production
npm run start:production
```

### Verification Scripts

```bash
# Verify migration status
node .kiro/specs/anchor-driven-entity-synthesis/migrations/verify-migration.js

# Verify data integrity
npm run verify:data-integrity

# Health check
npm run health-check:production

# Smoke tests
npm run test:smoke
```

---

## Contacts and Escalation

### Rollback Team

- **Rollback Lead**: [Name] - [Phone] - [Email]
- **Database Admin**: [Name] - [Phone] - [Email]
- **Operations Lead**: [Name] - [Phone] - [Email]
- **Development Lead**: [Name] - [Phone] - [Email]

### Escalation Path

1. **Level 1**: On-call engineer initiates rollback
2. **Level 2**: Rollback lead approves and coordinates
3. **Level 3**: CTO notified for critical rollbacks
4. **Level 4**: Executive team notified for data loss

### Communication Channels

- **Slack**: #incident-response
- **Email**: incident@company.com
- **Phone**: [On-call number]
- **Status Page**: status.company.com

---

## Appendix

### A. Backup Locations

```
backups/
  kg-backup-2026-02-08T10-00-00-000Z.db          # Automatic backup
  kg-backup-rollback-2026-02-08T12-00-00-000Z.db # Rollback backup
  emergency/
    pre-rollback-20260208-120000.db              # Emergency backup
  forensics/
    corrupted-20260208-120000.db                 # Corrupted database
    logs-20260208-120000/                        # Log files
```

### B. Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Backup not found | Check backup directory, use emergency backup |
| Database locked | Stop all services, wait 30 seconds, retry |
| Rollback script fails | Use manual SQL commands (see below) |
| Services won't start | Check logs, verify configuration, restart server |
| Data integrity check fails | Restore from earlier backup |

### C. Manual Rollback SQL

If rollback script fails, use these SQL commands:

```sql
-- Remove anchor columns
ALTER TABLE kg_entities DROP COLUMN anchor_fingerprint;
ALTER TABLE kg_entities DROP COLUMN anchor_fields;

-- Drop indexes
DROP INDEX IF EXISTS kg_entities_anchor_fingerprint_idx;
DROP INDEX IF EXISTS kg_entities_type_anchor_fingerprint_idx;

-- Verify
PRAGMA table_info(kg_entities);
```

### D. Recovery Time Objectives

| Rollback Level | RTO | RPO | Data Loss |
|----------------|-----|-----|-----------|
| Level 1 (Config) | 2 min | 0 | None |
| Level 2 (Code) | 5 min | 0 | None |
| Level 3 (Database) | 15 min | 0 | Anchor data only |
| Level 4 (Full) | 30 min | Backup age | All since backup |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-08 | System | Initial rollback plan |

---

**Status**: ✅ Production Ready  
**Last Updated**: 2026-02-08  
**Next Review**: After first deployment  
**Classification**: Critical - Follow Exactly
