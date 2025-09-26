import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// Configuration cache
let jwtSecret: string | null = null;

export const getJwtSecret = async (): Promise<string> => {
  // If we already have the secret cached, return it
  if (jwtSecret) {
    return jwtSecret;
  }

  // Fetch from AWS Secrets Manager via JWT_SECRET_ARN
  const secretArn = process.env.JWT_SECRET_ARN;
  if (secretArn) {
    const region = process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1';
    const secretsClient = new SecretsManagerClient({ region });
    
    try {
      const result = await secretsClient.send(new GetSecretValueCommand({
        SecretId: secretArn,
      }));
      
      if (result.SecretString) {
        const secretData = JSON.parse(result.SecretString);
        jwtSecret = secretData.secret;
        
        if (!jwtSecret) {
          throw new Error(`Secret key 'secret' not found in AWS Secrets Manager secret: ${secretArn}`);
        }
        
        console.log('JWT secret loaded from AWS Secrets Manager');
        return jwtSecret;
      } else {
        throw new Error(`Secret string not found in AWS Secrets Manager secret: ${secretArn}`);
      }
    } catch (error) {
      console.error('Failed to get JWT secret from Secrets Manager:', error);
      throw new Error('Configuration error: Unable to retrieve JWT secret from Secrets Manager');
    }
  }

  throw new Error('No JWT secret configuration found: JWT_SECRET_ARN environment variable not set');
};

// Other configuration helpers
export const getConfig = async () => {
  const jwtSecret = await getJwtSecret();
  
  return {
    saltRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h'
  };
};