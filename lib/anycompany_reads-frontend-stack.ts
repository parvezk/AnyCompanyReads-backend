import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cr from 'aws-cdk-lib/custom-resources';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { Asset } from "aws-cdk-lib/aws-s3-assets";
import * as path from "path";
import {
  Role,
  ServicePrincipal,
  ManagedPolicy
} from "aws-cdk-lib/aws-iam";
import {
  App,
  Branch,
  RedirectStatus
} from '@aws-cdk/aws-amplify-alpha';

export class AnyCompanyReadsFrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const buildArtifact = new Asset(this, 'AmplifyBuildArtifact', {
      path: path.join(__dirname, '../../frontend-build.zip')
    });

    // Define service role for AWS Amplify
    const serviceRole = new Role(this, 'AmplifyServiceRole', {
      assumedBy: new ServicePrincipal('amplify.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess-Amplify'),
      ],
    });

    // Define Amplify app
    const app = new App(this, 'AnyCompanyReads-frontend', {
      appName: "AnyCompanyReads-frontend",
      role: serviceRole,
      customRules: [{
        source: "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>",
        target: '/index.html',
        status: RedirectStatus.REWRITE
      }]
    });

    // Create a new environment from the associated branch
    const mainEnv = new Branch(this, 'main', { app });

    // Custom Lambda function resource for Amplify deployments
    const amplifyDeploymentLambda = new NodejsFunction(this, "AmplifyDeploymentCustom", {
      runtime: Runtime.NODEJS_18_X,
      code: Code.fromAsset('lambda/amplify_deployment'),
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(300),
      memorySize: 1024,
      logRetention: RetentionDays.ONE_WEEK
    });

    // Define permissions for Lambda function
    buildArtifact.grantRead(amplifyDeploymentLambda);
    amplifyDeploymentLambda.addToRolePolicy(new PolicyStatement({
      actions: [
        "amplify:StartDeployment"
      ],
      effect: Effect.ALLOW,
      resources: [
        "*"
      ]
    }));

    const payload = {
      AppId: app.appId,
      BranchName: mainEnv.branchName,
      BucketName: buildArtifact.s3BucketName,
      ObjectKey: buildArtifact.s3ObjectKey
    }

    new cr.AwsCustomResource(this, "AmplifyDeploymentCR", {
      policy: cr.AwsCustomResourcePolicy.fromStatements([new PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [ amplifyDeploymentLambda.functionArn ],
        effect: Effect.ALLOW
      })]),
      timeout: cdk.Duration.seconds(360),
      onCreate: {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: amplifyDeploymentLambda.functionName,
          InvocationType: 'Event',
          Payload: JSON.stringify(payload)
        },
        physicalResourceId: cr.PhysicalResourceId.of("AmplifyDeployment")
      },
      onUpdate: {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: amplifyDeploymentLambda.functionName,
          InvocationType: 'Event',
          Payload: JSON.stringify(payload)
        },
        physicalResourceId: cr.PhysicalResourceId.of("AmplifyDeployment")
      }
    })

    new cdk.CfnOutput(this, 'AmplifyApp-Url', { value: `https://${mainEnv.branchName}.${app.defaultDomain}` });
    new cdk.CfnOutput(this, 'AmplifyApp-ID', { value: app.appId });
    new cdk.CfnOutput(this, 'AmplifyApp-Branch', { value: mainEnv.branchName });

  }
}