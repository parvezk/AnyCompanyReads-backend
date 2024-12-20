import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { AmplifyClient, StartDeploymentCommand } from "@aws-sdk/client-amplify";

const s3Client = new S3Client();
const amplifyClient = new AmplifyClient();

export const handler = async (event, context) => {
  console.log(event);
  const getObjectCommand = new GetObjectCommand({
    Bucket: event.BucketName,
    Key: event.ObjectKey
  });

  const url = await getSignedUrl(s3Client, getObjectCommand, { expiresIn: 300 });

  const startDeploymentCommand = new StartDeploymentCommand({
    appId: event.AppId,
    branchName: event.BranchName,
    sourceUrl: url
  });

  const response = await amplifyClient.send(startDeploymentCommand);

  return response;

};