#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CrossRiverStack } from '../lib/crossriver-stack';

const app = new cdk.App();

const stackName = app.node.tryGetContext('stackName') || 'CrossRiverStack';
const environment = app.node.tryGetContext('environment') || 'dev';

new CrossRiverStack(app, stackName, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  environment,
});