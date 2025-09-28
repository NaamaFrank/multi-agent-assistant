import * as cdk from 'aws-cdk-lib';
import { Stack } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

export interface CrossRiverStackProps extends cdk.StackProps {
  environment: string;
}

export class CrossRiverStack extends cdk.Stack {
  public readonly httpApi: apigateway.HttpApi;
  public readonly streamingFunctionUrl: string;

  constructor(scope: Construct, id: string, props: CrossRiverStackProps) {
    super(scope, id, props);

    const { environment } = props;

    // Secure JWT Secret using AWS Secrets Manager
    const jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', {
      secretName: `/crossriver/${environment}/jwt-secret`,
      description: 'JWT Secret for CrossRiver application',
      generateSecretString: {
        secretStringTemplate: '{}',
        generateStringKey: 'secret',
        excludeCharacters: '"@/\\\'',
        passwordLength: 64,
      },
    });

    const modelId = new ssm.StringParameter(this, 'ModelId', {
      parameterName: `/crossriver/${environment}/model-id`,
      stringValue: 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
      description: 'Bedrock inference profile ID for Claude 3.5 Haiku (US region)',
    });

    // DynamoDB Tables
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: `crossriver-${environment}-users`,
    });

    const conversationsTable = new dynamodb.Table(this, 'ConversationsTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'conversationId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: `crossriver-${environment}-conversations`,
    });

    const messagesTable = new dynamodb.Table(this, 'MessagesTable', {
      partitionKey: { name: 'conversationId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'messageId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: `crossriver-${environment}-messages`,
    });

    // Add GSI for timestamp-based sorting on messages
    messagesTable.addGlobalSecondaryIndex({
      indexName: 'conversationId-ts-index',
      partitionKey: { name: 'conversationId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'ts', type: dynamodb.AttributeType.STRING },
    });

    // IAM Role for Lambda functions
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        DynamoDBAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Query',
                'dynamodb:Scan',
              ],
              resources: [
                usersTable.tableArn,
                conversationsTable.tableArn,
                messagesTable.tableArn,
                `${messagesTable.tableArn}/index/*`,
              ],
            }),
          ],
        }),
        BedrockAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
              ],
              resources: [
                // Explicit inference profile ARN in this region (note: inference profiles include account ID)
                `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/us.anthropic.claude-3-5-haiku-20241022-v1:0`,
                // Keep existing foundation-model wildcards for flexibility
                `arn:aws:bedrock:*::foundation-model/anthropic.claude-*`,
                `arn:aws:bedrock:*::foundation-model/amazon.titan-*`,
              ],
            }),
          ],
        }),
        SSMAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ssm:GetParameter',
                'ssm:GetParameters',
              ],
              resources: [
                modelId.parameterArn,
              ],
            }),
          ],
        }),
        SecretsAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'secretsmanager:GetSecretValue',
              ],
              resources: [
                jwtSecret.secretArn,
              ],
            }),
          ],
        }),
      },
    });

    // Common Lambda environment variables
    const lambdaEnvironment = {
      PERSISTENCE: 'dynamo',
      USERS_TABLE: usersTable.tableName,
      CONVERSATIONS_TABLE: conversationsTable.tableName,
      MESSAGES_TABLE: messagesTable.tableName,
      BEDROCK_REGION: this.region,
      USE_FAKE_LLM: 'false',
      MAX_PROMPT_CHARS: '8000',
      STREAM_HEARTBEAT_MS: '15000',
      STREAM_IDLE_TIMEOUT_MS: '60000',
      JWT_SECRET_ARN: jwtSecret.secretArn,
      MODEL_ID_PARAM: modelId.parameterName,
      MODEL_ID: 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
    };

    // Lambda layer for shared dependencies
    const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../../server/dist/layer')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Shared dependencies for CrossRiver Lambda functions',
    });

    // Auth Lambda Functions
    const authRegisterFunction = new lambda.Function(this, 'AuthRegisterFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'auth-register.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../server/dist/lambda')),
      role: lambdaRole,
      environment: lambdaEnvironment,
      layers: [sharedLayer],
      timeout: cdk.Duration.seconds(30),
    });

    const authLoginFunction = new lambda.Function(this, 'AuthLoginFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'auth-login.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../server/dist/lambda')),
      role: lambdaRole,
      environment: lambdaEnvironment,
      layers: [sharedLayer],
      timeout: cdk.Duration.seconds(30),
    });

    // Agent Lambda Functions
    const agentConversationsFunction = new lambda.Function(this, 'AgentConversationsFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'agent-conversations.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../server/dist/lambda')),
      role: lambdaRole,
      environment: lambdaEnvironment,
      layers: [sharedLayer],
      timeout: cdk.Duration.seconds(30),
      description: 'Handle conversations API',
    });

    const agentConversationByIdFunction = new lambda.Function(this, 'AgentConversationByIdFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'agent-conversation-by-id.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../server/dist/lambda')),
      role: lambdaRole,
      environment: lambdaEnvironment,
      layers: [sharedLayer],
      timeout: cdk.Duration.seconds(30),
      description: 'Handle conversation by ID API',
    });

    const agentMessagesFunction = new lambda.Function(this, 'AgentMessagesFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'agent-messages.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../server/dist/lambda')),
      role: lambdaRole,
      environment: lambdaEnvironment,
      layers: [sharedLayer],
      timeout: cdk.Duration.seconds(30),
      description: 'Handle conversation messages API',
    });

    const agentConversationDeleteFunction = new lambda.Function(this, 'AgentConversationDeleteFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'agent-conversation-delete.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../server/dist/lambda')),
      role: lambdaRole,
      environment: lambdaEnvironment,
      layers: [sharedLayer],
      timeout: cdk.Duration.seconds(30),
      description: 'Handle conversation deletion API',
    });

    const streamingFunction = new lambda.Function(this, 'StreamingFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'agent-stream.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../server/dist/lambda')),
      role: lambdaRole,
      environment: lambdaEnvironment,
      layers: [sharedLayer],
      timeout: cdk.Duration.minutes(5),
      description: 'Streaming handler with CORS support - v4',
    });

    const streamingFunctionUrl = streamingFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['http://localhost:3000'],
        allowedMethods: [lambda.HttpMethod.GET, lambda.HttpMethod.POST],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cache-Control'],
        maxAge: cdk.Duration.days(1),
      },
    });

    this.httpApi = new apigateway.HttpApi(this, 'HttpApiV4', {
      apiName: `crossriver-${environment}-api-v4`,
      description: 'CrossRiver REST API',
      corsPreflight: {
        allowOrigins: ['http://localhost:3000', 'https://app.crossriver.com'],
        allowMethods: [
          apigateway.CorsHttpMethod.GET,
          apigateway.CorsHttpMethod.POST,
          apigateway.CorsHttpMethod.PUT,
          apigateway.CorsHttpMethod.DELETE,
          apigateway.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
        allowCredentials: false,
      },
    });

    // Lambda integrations
    const authRegisterIntegration = new integrations.HttpLambdaIntegration('AuthRegisterIntegration', authRegisterFunction);
    const authLoginIntegration = new integrations.HttpLambdaIntegration('AuthLoginIntegration', authLoginFunction);
    const agentConversationsIntegration = new integrations.HttpLambdaIntegration('AgentConversationsIntegration', agentConversationsFunction);
    const agentConversationByIdIntegration = new integrations.HttpLambdaIntegration('AgentConversationByIdIntegration', agentConversationByIdFunction);
    const agentMessagesIntegration = new integrations.HttpLambdaIntegration('AgentMessagesIntegration', agentMessagesFunction);
    const agentConversationDeleteIntegration = new integrations.HttpLambdaIntegration('AgentConversationDeleteIntegration', agentConversationDeleteFunction);
    const agentStreamIntegration = new integrations.HttpLambdaIntegration('AgentStreamIntegration', streamingFunction);

    this.httpApi.addRoutes({
      path: '/api/auth/register',
      methods: [apigateway.HttpMethod.POST],
      integration: authRegisterIntegration,
    });

    this.httpApi.addRoutes({
      path: '/api/auth/login',
      methods: [apigateway.HttpMethod.POST],
      integration: authLoginIntegration,
    });

    this.httpApi.addRoutes({
      path: '/api/agent/conversations',
      methods: [apigateway.HttpMethod.GET, apigateway.HttpMethod.POST],
      integration: agentConversationsIntegration,
    });

    this.httpApi.addRoutes({
      path: '/api/agent/conversations/{id}',
      methods: [apigateway.HttpMethod.GET],
      integration: agentConversationByIdIntegration,
    });

    this.httpApi.addRoutes({
      path: '/api/agent/conversations/{conversationId}',
      methods: [apigateway.HttpMethod.DELETE],
      integration: agentConversationDeleteIntegration,
    });

    this.httpApi.addRoutes({
      path: '/api/agent/conversations/{id}/messages',
      methods: [apigateway.HttpMethod.GET, apigateway.HttpMethod.POST],
      integration: agentMessagesIntegration,
    });

    this.streamingFunctionUrl = streamingFunctionUrl.url;

    // Outputs
    new cdk.CfnOutput(this, 'HttpApiUrl', {
      value: this.httpApi.apiEndpoint,
      description: 'HTTP API Gateway endpoint URL',
    });

    new cdk.CfnOutput(this, 'StreamingFunctionUrl', {
      value: streamingFunctionUrl.url,
      description: 'Lambda Function URL for streaming (dev proxy)',
    });

    new cdk.CfnOutput(this, 'ApiGatewayStreamingUrl', {
      value: `${this.httpApi.apiEndpoint}/api/agent/stream`,
      description: 'API Gateway streaming endpoint URL (production fallback)',
    });

    new cdk.CfnOutput(this, 'UsersTableName', {
      value: usersTable.tableName,
      description: 'DynamoDB Users table name',
    });

    new cdk.CfnOutput(this, 'ConversationsTableName', {
      value: conversationsTable.tableName,
      description: 'DynamoDB Conversations table name',
    });

    new cdk.CfnOutput(this, 'MessagesTableName', {
      value: messagesTable.tableName,
      description: 'DynamoDB Messages table name',
    });
  }
}