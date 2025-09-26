#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SimpleCrossRiverStack } from '../lib/simple-stack';

const app = new cdk.App();

const stackName = app.node.tryGetContext('stackName') || 'CrossRiverSimpleStack';
const environment = app.node.tryGetContext('environment') || 'dev';

new SimpleCrossRiverStack(app, stackName, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  environment,
});