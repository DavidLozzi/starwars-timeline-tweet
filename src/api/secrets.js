const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

const getTwitterSecrets = async () => {
  // If you need more information about configurations or implementing the sample code, visit the AWS docs:
  // https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/getting-started.html

  const secret_name = process.env.SECRET_ARN;

  let client;
  if (process.env.AWS_SAM_LOCAL === "true") {
    client = new SecretsManagerClient({
      region: "us-east-2",
      endpoint: 'http://172.16.123.1:4566/'
    });
  } else {
    client = new SecretsManagerClient({
      region: "us-east-2",
    });
  }

  let response;
  try {
    response = await client.send(
      new GetSecretValueCommand({
        SecretId: secret_name,
        VersionStage: "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified
      })
    );
  } catch (error) {
    // For a list of exceptions thrown, see
    // https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
    throw error;
  }

  const secret = response.SecretString;
  return JSON.parse(secret)[0];
}

module.exports = { getTwitterSecrets }