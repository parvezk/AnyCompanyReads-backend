// Import dependencies
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as db from "aws-cdk-lib/aws-dynamodb";
import * as appsync from "aws-cdk-lib/aws-appsync";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";

// setup a static expiration date for the API KEY
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const WORKSHOP_DATE = new Date(); // date of this workshop
const KEY_EXPIRATION_DATE = new Date(WORKSHOP_DATE.getTime() + SEVEN_DAYS);

export class AnyCompanyReadsBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Configure the User Pool & Client
    const pool = new cognito.UserPool(this, "UserPool", {
      userPoolName: "WorkshopUserPool",
      selfSignUpEnabled: true,
      autoVerify: { email: true },
      standardAttributes: { email: { required: true } },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const client = pool.addClient("customer-app-client-web", {
      preventUserExistenceErrors: true,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
    });

    // Define the AppSync API
    const api = new appsync.GraphqlApi(this, "AppSyncBooksAPI", {
      name: "BooksAPI-CDK",
      definition: appsync.Definition.fromFile(
        "appsync/schemas/bookSchema.graphql"
      ),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
          apiKeyConfig: {
            name: "default",
            description: "default auth mode",
            expires: cdk.Expiration.atDate(KEY_EXPIRATION_DATE),
          },
        },
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.USER_POOL,
            userPoolConfig: {
              userPool: pool,
            },
          },
        ],
      },
    });

    // Define the DynamoDB table with partition key and additional DDB indexes
    const table = new db.Table(this, "BooksTable-CDK", {
      partitionKey: { name: "id", type: db.AttributeType.STRING },
      billingMode: db.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    table.addGlobalSecondaryIndex({
      indexName: "author-index",
      partitionKey: { name: "authorId", type: db.AttributeType.STRING },
    });

    table.addGlobalSecondaryIndex({
      indexName: "publisher-index",
      partitionKey: { name: "publisherId", type: db.AttributeType.STRING },
    });

    // Define the custom auth Lambda function
    const customAuthFunction = new lambda.Function(this, "CustomAuthFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/custom-auth"),
      environment: {
        ALLOW: "true",
      },
    });

    // Set up table as a data source
    const dataSource = api.addDynamoDbDataSource("BooksTableSource", table);

    // Set up custom auth lambda function as a data source
    const lambdaDataSource = api.addLambdaDataSource(
      "CustomAuthLambda",
      customAuthFunction
    );

    // Define AppSync functions for Pipeline resolvers
    const appsyncCustomAuthFunction = lambdaDataSource.createFunction(
      "AppSyncCustomAuthFunction",
      {
        name: "AppSyncCustomAuthFunction",
        code: appsync.Code.fromAsset(
          "appsync/resolvers/booksApi/js/customAuthFunction.js"
        ),
        runtime: appsync.FunctionRuntime.JS_1_0_0,
      }
    );

    const appsyncListBooksByGenreFunction = dataSource.createFunction(
      "AppSyncListBooksByGenreFunction",
      {
        name: "AppSyncListBooksByGenreFunction",
        code: appsync.Code.fromAsset(
          "appsync/resolvers/booksApi/js/queryListBooksByGenre.js"
        ),
        runtime: appsync.FunctionRuntime.JS_1_0_0,
      }
    );

    // Define resolvers
    api.createResolver("MutationCreateBookResolver", {
      typeName: "Mutation",
      fieldName: "createBook",
      dataSource: dataSource,
      code: appsync.Code.fromAsset(
        "appsync/resolvers/booksApi/js/mutationCreateBook.js"
      ),
      runtime: appsync.FunctionRuntime.JS_1_0_0,
    });

    api.createResolver("MutationUpdateBookResolver", {
      typeName: "Mutation",
      fieldName: "updateBook",
      dataSource: dataSource,
      code: appsync.Code.fromAsset(
        "appsync/resolvers/booksApi/js/mutationUpdateBook.js"
      ),
      runtime: appsync.FunctionRuntime.JS_1_0_0,
    });

    api.createResolver("MutationDeleteBookResolver", {
      typeName: "Mutation",
      fieldName: "deleteBook",
      dataSource: dataSource,
      code: appsync.Code.fromAsset(
        "appsync/resolvers/booksApi/js/mutationDeleteBook.js"
      ),
      runtime: appsync.FunctionRuntime.JS_1_0_0,
    });

    api.createResolver("QueryGetBookResolver", {
      typeName: "Query",
      fieldName: "getBook",
      dataSource: dataSource,
      code: appsync.Code.fromAsset(
        "appsync/resolvers/booksApi/js/queryGetBook.js"
      ),
      runtime: appsync.FunctionRuntime.JS_1_0_0,
    });

    api.createResolver("QueryListBooksResolver", {
      typeName: "Query",
      fieldName: "listBooks",
      dataSource: dataSource,
      code: appsync.Code.fromAsset(
        "appsync/resolvers/booksApi/js/queryListBooks.js"
      ),
      runtime: appsync.FunctionRuntime.JS_1_0_0,
    });

    api.createResolver("QueryBooksByAuthorIndexResolver", {
      typeName: "Query",
      fieldName: "queryBooksByAuthorIndex",
      dataSource: dataSource,
      code: appsync.Code.fromAsset(
        "appsync/resolvers/booksApi/js/queryBooksByAuthorIndex.js"
      ),
      runtime: appsync.FunctionRuntime.JS_1_0_0,
    });

    api.createResolver("QueryBooksByPublisherIndexResolver", {
      typeName: "Query",
      fieldName: "queryBooksByPublisherIndex",
      dataSource: dataSource,
      code: appsync.Code.fromAsset(
        "appsync/resolvers/booksApi/js/queryBooksByPublisherIndex.js"
      ),
      runtime: appsync.FunctionRuntime.JS_1_0_0,
    });

    api.createResolver("QueryListBooksByGenreResolver", {
      typeName: "Query",
      fieldName: "listBooksByGenre",
      code: appsync.Code.fromAsset("appsync/resolvers/booksApi/js/default.js"),
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      pipelineConfig: [
        appsyncCustomAuthFunction,
        appsyncListBooksByGenreFunction,
      ],
    });

    // Stack outputs
    new cdk.CfnOutput(this, "GraphQLAPI_ID", { value: api.apiId });
    new cdk.CfnOutput(this, "GraphQLAPI_URL", { value: api.graphqlUrl });
    new cdk.CfnOutput(this, "GraphQLAPI_KEY", { value: api.apiKey ?? "" });
    new cdk.CfnOutput(this, "STACK_REGION", { value: this.region });
    new cdk.CfnOutput(this, "USER_POOLS_ID", { value: pool.userPoolId });
    new cdk.CfnOutput(this, "USER_POOLS_WEB_CLIENT_ID", {
      value: client.userPoolClientId,
    });
  }
}
