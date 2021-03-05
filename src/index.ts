import Serverless, { Options } from "serverless";
import Plugin, { VariableResolver } from "serverless/classes/Plugin";
import * as AWS from 'aws-sdk';
import * as YAML from 'js-yaml';
import Aws from "serverless/plugins/aws/provider/awsProvider";

const S3ObjPattern = RegExp(/^(?:\${)?s3obj:(.+?)\/(.+)$/);
const extensionPattern = RegExp(/^.+?\.(yml|yaml|json)$/);

export class ServerlessPlugin implements Plugin {
  hooks: Plugin.Hooks = {};
  commands?: Plugin.Commands;
  variableResolvers?: Plugin.VariableResolvers;
  serverless: Serverless;
  options: Options;

  constructor(serverless: Serverless, options: Options) {
    this.serverless = serverless;
    this.options = options;
    this.variableResolvers = {
      's3obj': this.getRemoteValue
    }
  }

  async getRemoteValue(reference: string) {
    const groups = reference.match(S3ObjPattern) || [];
    const bucket = groups[1];
    const key = groups[2];
    const extension = (key.match(extensionPattern) || [])[1];


    this.serverless.cli.log(`bucket: ${bucket}`)
    this.serverless.cli.log(`key: ${key}`);
    this.serverless.cli.log(`extension: ${extension}`);

    const response: AWS.S3.GetObjectOutput =  await this.serverless
    .getProvider('aws')
    .request(
      'S3',
      'getObject',
      {
        Bucket: bucket,
        Key: key
      },
      {
        useCache: true
      }
    );

    const body = response.Body?.toString();

    if (body) {
      switch(extension) {
        case 'yml':
        case 'yaml': {
          this.serverless.cli.log('parsing response as yaml');
          return YAML.load(body);
        }
        case 'json': {
          this.serverless.cli.log('parsing response as json');
          return JSON.parse(body);
        }
        default: {
          this.serverless.cli.log('using raw body');
          return body;
        }
      }
    } else {
      return null;
    }
  }
}


module.exports = ServerlessPlugin;
