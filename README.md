# serverless-s3obj
serverless-s3obj is a serverless plugin that provides a means to include
partial `yaml` or `json` files stored in S3 within your `serverless.yml`
files.  This is an extension of [serverless built in s3 variable resolution](https://www.serverless.com/framework/docs/providers/aws/guide/variables/#referencing-s3-objects)
which simply interpolates the string  body of the s3 object.  This makes
it useless for things like snippets of related resources to be included
in your app's resources.  s3obj takes things a step further to see if there is
a `yml`, `yaml` or `json` extension to the object's key, and if so, parses it
as such so that you can render the contents into the generated cloudformation
templates underlying your serverless stacks.

Reasons you might want to use serverless-s3obj:

* You have collections of resources that you find yourself defining
over and over for common scenarios, such as defining all the cloudformation
resources for application load balancers fronting serverless microservices
* You want to distribute reusable snippets for use across an organization
* You want centralized control of portions of so that you can make changes
in that central location and have it propagate to all your serverless apps

## Usage
### 1. Create S3 bucket
Create an S3 bucket.  How you do that and manage access is up to you, but this
is infrastructure that spans serverless applications, so do it outside of any
`serverless.yml` files.  For example purposes, we will use the name
`infrastructure-bucket`.

### 2. Push yaml or json templates to your bucket
Again, these are cross-cutting bits of infrastructure-as-code that do not belong
to any one app.  How you get the templates into the S3 bucket are up to you.
Maintain any `yml`, `yaml` or `json` extensions the templates might have.

For example, the following snippet of cloudformation creates the security group,
application load balancer, target group and listener needed to front an
internall serverless app accessible only from your VPC.

```
  Resources:
    SecurityGroup:
      Type: AWS::EC2::SecurityGroup
      Properties:
        GroupDescription: Generic HTTP Security Group
        SecurityGroupIngress:
          - CidrIp: # whatever your VPCs cidr range is for production
            FromPort: 80
            IpProtocol: tcp
            ToPort: 80
        VpcId: # whatever your vpc id is for production

    LoadBalancer:
      Type: AWS::ElasticLoadBalancingV2::LoadBalancer
      Properties:
        Scheme: internal
        SecurityGroups:
          - Ref: SecurityGroup
        Subnets:
          - # one of your private subnet ids for production
          - # another of your private subnet ids for production

    TargetGroup:
      Type: AWS::ElasticLoadBalancingV2::TargetGroup
      Properties:
        TargetType: lambda

    Listener:
      Type: AWS::ElasticLoadBalancingV2::Listener
      Properties:
        DefaultActions:
          - TargetGroupArn:
              Ref: TargetGroup
            Type: forward
        LoadBalancerArn:
          Ref: LoadBalancer
        Port: 80
        Protocol: HTTP

  Outputs:
      DnsName:
        Value:
          'Fn::GetAtt': [LoadBalancer, DNSName]
      ALBName:
        Value:
          'Fn::GetAtt': [LoadBalancer, LoadBalancerFullName]
```

If you wanted to make this reusable across serverless applications with s3obj,
you might place it at:

```
s3://infrastructure-bucket/production/alb.yml
```

You might place an analogous snippet for your development environment at:

```
s3://infrastructure-bucket/development/alb.yml
```

### 3. Use the serverless-s3obj plugin
In your `serverless.yml` files, declare the plugin's usage like so:

```
plugins:
  - serverless-s3obj
```

Make sure the module is installed with `npm`, `yarn` or whatever you
use.

### 4. Include templates
In your `serverless.yml` files, use the `s3obj` variable source to reference
centralized templates and snippets.  For the ALB example above, we would have
a line like the following:

```
resources:
  - ${s3obj:infrastructure-bucket/${opt:stage}/alb.yml
```

### 5. Reference the resources in templates (if needed)
If the templates and snippets included with s3obj define resources, you
can reference them by their logical name as defined in the template.  Again
using our ALB example, we might define some functions in `serverless.yml` to
be triggered by `alb` events from our application load balancer in our private
subnets:

```
functions:
  hello:
    handler: handler.hello
    events:
      - alb:
          listenerArn:
            Ref: Listener
          priority: 1
          conditions:
            path: /hello
```

Note the `Ref` to the logical `Listener` defined in the snippet stored in
s3 that we defined back in step 2.

### 6. Deploy your app
Deploy your app like you normally would with the `serverless` cli.  Whatever
is running the command will need to be able to access the objects in the
s3 bucket you defined.  How you manage that is up to you.  For example, we
might deploy the app to production using the `alb.yml` snippet appropriate for
that environment with:

```
serverless deploy --stage production
```

The `${opt:stage}` in our s3obj reference in `serverless.yml` below is replaced
with `production` and your stacks will stand up a new ALB for your app that can
be used to lock it down to a private subnet:

```
resources:
  - ${s3obj:infrastructure-bucket/${opt:stage}/alb.yml
```

## Contributing
The scope of s3obj is simply to resolve variables sourced with `s3obj` from
objects stored in s3.  Contributions to that end are welcome.  Contributions
that extend that scope will most likely not be accepted.  I have no intention or
inclination to maintain something of a larger scope.  Feel free to fork and take
in different directions if your needs require it.

## TODO
This is in a very early stage, and for this to be a properly reliable open
source tool, the following needs to happen:

* Write tests/specs
* Set up CI/builds
