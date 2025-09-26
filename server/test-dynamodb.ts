// Test DynamoDB connectivity specifically
import dotenv from 'dotenv';
import { DynamoDBClient, ListTablesCommand, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

// Load environment variables
dotenv.config();

async function testDynamoDBConnectivity() {
  console.log('🗄️  Testing DynamoDB Connectivity...\n');
  
  const region = process.env.AWS_REGION || 'us-east-1';
  const client = new DynamoDBClient({ region });
  
  console.log('📍 Region:', region);
  console.log('🔧 Persistence mode:', process.env.PERSISTENCE);
  
  // Test 1: List existing tables
  console.log('\n1️⃣ Checking existing tables...');
  try {
    const result = await client.send(new ListTablesCommand({}));
    console.log('✅ DynamoDB Connection: WORKING');
    console.log(`📊 Found ${result.TableNames?.length || 0} tables total`);
    
    if (result.TableNames?.length) {
      console.log('   All tables:', result.TableNames.join(', '));
      
      // Check for our specific tables
      const expectedTables = [
        process.env.USERS_TABLE || 'crossriver-dev-users',
        process.env.CONVERSATIONS_TABLE || 'crossriver-dev-conversations', 
        process.env.MESSAGES_TABLE || 'crossriver-dev-messages'
      ];
      
      console.log('\n📋 Checking for CrossRiver tables...');
      for (const tableName of expectedTables) {
        if (result.TableNames.includes(tableName)) {
          console.log(`✅ ${tableName}: EXISTS`);
          
          // Get table details
          try {
            const desc = await client.send(new DescribeTableCommand({ TableName: tableName }));
            console.log(`   Status: ${desc.Table?.TableStatus}`);
            console.log(`   Items: ~${desc.Table?.ItemCount || 0}`);
          } catch (err) {
            console.log('   (Could not get details)');
          }
        } else {
          console.log(`❌ ${tableName}: MISSING`);
          console.log('   💡 You need to deploy the CDK stack first');
        }
      }
    } else {
      console.log('❌ No tables found - you need to deploy the CDK infrastructure first');
    }
  } catch (error: any) {
    console.log('❌ DynamoDB Connection: FAILED');
    console.log('   Error:', error.message);
    
    if (error.message.includes('credentials')) {
      console.log('   💡 AWS credentials not configured');
      console.log('   💡 Run: aws configure');
    } else if (error.message.includes('region')) {
      console.log('   💡 Check your AWS_REGION environment variable');
    } else {
      console.log('   💡 Check your AWS configuration and permissions');
    }
    return false;
  }
  
  return true;
}

// Test 2: Repository connectivity
async function testRepositoryConnectivity() {
  console.log('\n🏗️  Testing Repository Layer...\n');
  
  try {
    // Import our repository factory
    const { getConversationsRepo, getMessagesRepo, getUserRepo } = await import('./src/repositories/factory');
    
    console.log('✅ Repository factory: IMPORTED');
    
    // Test repository creation
    const userRepo = getUserRepo();
    const conversationsRepo = getConversationsRepo();
    const messagesRepo = getMessagesRepo();
    
    console.log('✅ Repositories: CREATED');
    console.log('   User repo:', userRepo.constructor.name);
    console.log('   Conversations repo:', conversationsRepo.constructor.name);
    console.log('   Messages repo:', messagesRepo.constructor.name);
    
    // If using DynamoDB repos, test a simple operation
    if (process.env.PERSISTENCE === 'dynamo') {
      console.log('\n📡 Testing DynamoDB repository operations...');
      
      // Test conversation repo (safest test - just try to list)
      try {
        await conversationsRepo.listByUser(999999); // Use a user ID that definitely doesn't exist
        console.log('✅ DynamoDB operations: WORKING');
      } catch (error: any) {
        if (error.message.includes('ResourceNotFoundException')) {
          console.log('❌ DynamoDB tables not found - deploy CDK stack first');
        } else {
          console.log('❌ DynamoDB operations: FAILED');
          console.log('   Error:', error.message);
        }
      }
    } else {
      console.log('💾 Using memory repositories (PERSISTENCE !== dynamo)');
    }
    
  } catch (error: any) {
    console.log('❌ Repository layer: FAILED');
    console.log('   Error:', error.message);
    return false;
  }
  
  return true;
}

// Run both tests
async function runAllTests() {
  console.log('🧪 AWS & DynamoDB Connectivity Tests\n');
  console.log('=' .repeat(50));
  
  const dynamoOk = await testDynamoDBConnectivity();
  console.log('\n' + '=' .repeat(50));
  
  const repoOk = await testRepositoryConnectivity();
  
  console.log('\n' + '=' .repeat(50));
  console.log('\n📝 Summary:');
  console.log(`   DynamoDB: ${dynamoOk ? '✅ OK' : '❌ FAILED'}`);
  console.log(`   Repositories: ${repoOk ? '✅ OK' : '❌ FAILED'}`);
  
  if (!dynamoOk || !repoOk) {
    console.log('\n🚀 Next Steps:');
    console.log('   1. Make sure AWS credentials are configured: aws configure');
    console.log('   2. Deploy the CDK infrastructure: cd ../infra && npm run deploy');
    console.log('   3. Update .env with the correct table names and region');
  } else {
    console.log('\n🎉 Everything looks good! You should be able to use DynamoDB.');
  }
}

runAllTests().catch(console.error);