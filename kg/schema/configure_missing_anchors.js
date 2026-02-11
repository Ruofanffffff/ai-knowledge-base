/**
 * Configure Anchor Fields for Missing Schemas
 * 
 * This script configures anchor fields for all schemas that don't have them yet.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Anchor field configurations for each schema
const anchorConfigs = {
  // Software Development Schemas
  'Code-Module': {
    anchorFields: JSON.stringify([
      { name: 'ModuleName', normalization_strategy: 'lowercase', priority: 1 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'API-Endpoint': {
    anchorFields: JSON.stringify([
      { name: 'Path', normalization_strategy: 'lowercase', priority: 1 },
      { name: 'Method', normalization_strategy: 'uppercase', priority: 2 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Database-Schema': {
    anchorFields: JSON.stringify([
      { name: 'TableName', normalization_strategy: 'lowercase', priority: 1 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Design-Pattern': {
    anchorFields: JSON.stringify([
      { name: 'PatternName', normalization_strategy: 'lowercase', priority: 1 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Microservice': {
    anchorFields: JSON.stringify([
      { name: 'ServiceName', normalization_strategy: 'lowercase', priority: 1 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Code-Library': {
    anchorFields: JSON.stringify([
      { name: 'LibraryName', normalization_strategy: 'lowercase', priority: 1 },
      { name: 'Version', normalization_strategy: 'lowercase', priority: 2 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Code-Function': {
    anchorFields: JSON.stringify([
      { name: 'FunctionName', normalization_strategy: 'lowercase', priority: 1 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Code-Class': {
    anchorFields: JSON.stringify([
      { name: 'ClassName', normalization_strategy: 'lowercase', priority: 1 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Code-Interface': {
    anchorFields: JSON.stringify([
      { name: 'InterfaceName', normalization_strategy: 'lowercase', priority: 1 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Architecture-Layer': {
    anchorFields: JSON.stringify([
      { name: 'LayerName', normalization_strategy: 'lowercase', priority: 1 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'User-Story': {
    anchorFields: JSON.stringify([
      { name: 'Title', normalization_strategy: 'lowercase', priority: 1 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Sprint': {
    anchorFields: JSON.stringify([
      { name: 'SprintNumber', normalization_strategy: 'number', priority: 1 },
      { name: 'StartDate', normalization_strategy: 'time_day', priority: 2 }
    ]),
    anchorConfig: JSON.stringify({ time_granularity: 'day', conflict_strategy: 'auto' })
  },
  'Code-Review': {
    anchorFields: JSON.stringify([
      { name: 'ReviewID', normalization_strategy: 'lowercase', priority: 1 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Git-Commit': {
    anchorFields: JSON.stringify([
      { name: 'CommitHash', normalization_strategy: 'lowercase', priority: 1 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Pull-Request': {
    anchorFields: JSON.stringify([
      { name: 'PRNumber', normalization_strategy: 'number', priority: 1 },
      { name: 'Title', normalization_strategy: 'lowercase', priority: 2 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Issue-Ticket': {
    anchorFields: JSON.stringify([
      { name: 'IssueNumber', normalization_strategy: 'number', priority: 1 },
      { name: 'Title', normalization_strategy: 'lowercase', priority: 2 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Release-Version': {
    anchorFields: JSON.stringify([
      { name: 'Version', normalization_strategy: 'lowercase', priority: 1 },
      { name: 'ReleaseDate', normalization_strategy: 'time_day', priority: 2 }
    ]),
    anchorConfig: JSON.stringify({ time_granularity: 'day', conflict_strategy: 'auto' })
  },
  'Technical-Debt': {
    anchorFields: JSON.stringify([
      { name: 'DebtID', normalization_strategy: 'lowercase', priority: 1 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Refactoring-Task': {
    anchorFields: JSON.stringify([
      { name: 'TaskID', normalization_strategy: 'lowercase', priority: 1 },
      { name: 'Target', normalization_strategy: 'lowercase', priority: 2 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Code-Metric': {
    anchorFields: JSON.stringify([
      { name: 'Module', normalization_strategy: 'lowercase', priority: 1 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Unit-Test': {
    anchorFields: JSON.stringify([
      { name: 'TestName', normalization_strategy: 'lowercase', priority: 1 },
      { name: 'Target', normalization_strategy: 'lowercase', priority: 2 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Integration-Test': {
    anchorFields: JSON.stringify([
      { name: 'TestName', normalization_strategy: 'lowercase', priority: 1 },
      { name: 'Modules', normalization_strategy: 'lowercase', priority: 2 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'E2E-Test': {
    anchorFields: JSON.stringify([
      { name: 'TestName', normalization_strategy: 'lowercase', priority: 1 },
      { name: 'UserFlow', normalization_strategy: 'lowercase', priority: 2 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Performance-Test': {
    anchorFields: JSON.stringify([
      { name: 'TestName', normalization_strategy: 'lowercase', priority: 1 },
      { name: 'Metric', normalization_strategy: 'lowercase', priority: 2 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Load-Test': {
    anchorFields: JSON.stringify([
      { name: 'TestName', normalization_strategy: 'lowercase', priority: 1 },
      { name: 'Concurrency', normalization_strategy: 'number', priority: 2 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Stress-Test': {
    anchorFields: JSON.stringify([
      { name: 'TestName', normalization_strategy: 'lowercase', priority: 1 },
      { name: 'MaxLoad', normalization_strategy: 'number', priority: 2 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Security-Test': {
    anchorFields: JSON.stringify([
      { name: 'TestName', normalization_strategy: 'lowercase', priority: 1 },
      { name: 'VulnerabilityType', normalization_strategy: 'lowercase', priority: 2 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Bug-Report': {
    anchorFields: JSON.stringify([
      { name: 'BugID', normalization_strategy: 'lowercase', priority: 1 },
      { name: 'Title', normalization_strategy: 'lowercase', priority: 2 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Test-Coverage': {
    anchorFields: JSON.stringify([
      { name: 'Module', normalization_strategy: 'lowercase', priority: 1 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Quality-Gate': {
    anchorFields: JSON.stringify([
      { name: 'GateName', normalization_strategy: 'lowercase', priority: 1 },
      { name: 'Criteria', normalization_strategy: 'lowercase', priority: 2 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'CI-Pipeline': {
    anchorFields: JSON.stringify([
      { name: 'PipelineName', normalization_strategy: 'lowercase', priority: 1 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'CD-Pipeline': {
    anchorFields: JSON.stringify([
      { name: 'PipelineName', normalization_strategy: 'lowercase', priority: 1 },
      { name: 'Environment', normalization_strategy: 'lowercase', priority: 2 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Docker-Container': {
    anchorFields: JSON.stringify([
      { name: 'ImageName', normalization_strategy: 'lowercase', priority: 1 },
      { name: 'Tag', normalization_strategy: 'lowercase', priority: 2 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Kubernetes-Pod': {
    anchorFields: JSON.stringify([
      { name: 'PodName', normalization_strategy: 'lowercase', priority: 1 },
      { name: 'Namespace', normalization_strategy: 'lowercase', priority: 2 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Deployment-Config': {
    anchorFields: JSON.stringify([
      { name: 'ConfigName', normalization_strategy: 'lowercase', priority: 1 },
      { name: 'Environment', normalization_strategy: 'lowercase', priority: 2 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Environment-Variable': {
    anchorFields: JSON.stringify([
      { name: 'Key', normalization_strategy: 'uppercase', priority: 1 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Server-Instance': {
    anchorFields: JSON.stringify([
      { name: 'InstanceID', normalization_strategy: 'lowercase', priority: 1 },
      { name: 'InstanceType', normalization_strategy: 'lowercase', priority: 2 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Load-Balancer': {
    anchorFields: JSON.stringify([
      { name: 'LoadBalancerName', normalization_strategy: 'lowercase', priority: 1 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Monitoring-Alert': {
    anchorFields: JSON.stringify([
      { name: 'AlertName', normalization_strategy: 'lowercase', priority: 1 },
      { name: 'Condition', normalization_strategy: 'lowercase', priority: 2 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  },
  'Log-Entry': {
    anchorFields: JSON.stringify([
      { name: 'Timestamp', normalization_strategy: 'time_day', priority: 1 }
    ]),
    anchorConfig: JSON.stringify({ time_granularity: 'day', conflict_strategy: 'auto' })
  },
  'API-Documentation': {
    anchorFields: JSON.stringify([
      { name: 'Endpoint', normalization_strategy: 'lowercase', priority: 1 },
      { name: 'Method', normalization_strategy: 'uppercase', priority: 2 }
    ]),
    anchorConfig: JSON.stringify({ conflict_strategy: 'auto' })
  }
};

async function configureAnchors() {
  console.log('🔧 Configuring anchor fields for schemas...\n');
  
  let configured = 0, skipped = 0, errors = 0;
  
  for (const [schemaName, config] of Object.entries(anchorConfigs)) {
    try {
      const schema = await prisma.schema.findUnique({
        where: { name: schemaName }
      });
      
      if (!schema) {
        console.log(`⏭️  ${schemaName} - not found`);
        skipped++;
        continue;
      }
      
      if (schema.anchor_fields) {
        console.log(`⏭️  ${schemaName} - already configured`);
        skipped++;
        continue;
      }
      
      await prisma.schema.update({
        where: { name: schemaName },
        data: config
      });
      
      console.log(`✅ ${schemaName}`);
      configured++;
    } catch (error) {
      console.error(`❌ ${schemaName}: ${error.message}`);
      errors++;
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Configured: ${configured}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  console.log(`\n✅ Anchor configuration complete!`);
}

if (require.main === module) {
  configureAnchors()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}

module.exports = { anchorConfigs };
