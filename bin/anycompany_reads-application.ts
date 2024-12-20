#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AnyCompanyReadsBackendStack } from '../lib/anycompany_reads-backend-stack';
import { AnyCompanyReadsFrontendStack } from '../lib/anycompany_reads-frontend-stack';

const app = new cdk.App();

const backend = new AnyCompanyReadsBackendStack(app, 'AnyCompanyReadsBackendStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

const frontend = new AnyCompanyReadsFrontendStack(app, 'AnyCompanyReadsFrontendStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});