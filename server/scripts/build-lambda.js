const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const lambdaDir = path.join(__dirname, '../src/lambda');
const distDir = path.join(__dirname, '../dist');
const lambdaDistDir = path.join(distDir, 'lambda');
const layerDistDir = path.join(distDir, 'layer');

// Ensure dist directories exist
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);
if (!fs.existsSync(lambdaDistDir)) fs.mkdirSync(lambdaDistDir, { recursive: true });
if (!fs.existsSync(layerDistDir)) fs.mkdirSync(layerDistDir, { recursive: true });

async function buildLambdas() {
  console.log('Building Lambda functions...');

  // Get all lambda handler files
  const lambdaFiles = fs.readdirSync(lambdaDir)
    .filter(file => file.endsWith('.ts'))
    .map(file => path.join(lambdaDir, file));

  // Build each lambda function separately
  for (const file of lambdaFiles) {
    const baseName = path.basename(file, '.ts');
    console.log(`Building ${baseName}...`);

    try {
      await esbuild.build({
        entryPoints: [file],
        bundle: true,
        platform: 'node',
        target: 'node20',
        format: 'cjs',
        outfile: path.join(lambdaDistDir, `${baseName}.js`),
        external: [
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/lib-dynamodb', 
          '@aws-sdk/client-bedrock-runtime',
          '@aws-sdk/client-ssm', 
          'aws-lambda',
          'isolated-vm'
        ],
        minify: true,
        sourcemap: false,
      });
      console.log(`✅ Built ${baseName}`);
    } catch (error) {
      console.error(`❌ Failed to build ${baseName}:`, error);
      process.exit(1);
    }
  }

  console.log('Lambda functions built successfully!');
}

async function buildLayer() {
  console.log('Building shared layer...');

  // Create a simple package.json for the layer
  const layerPackageJson = {
    name: 'crossriver-lambda-layer',
    version: '1.0.0',
    dependencies: {
      '@aws-sdk/client-dynamodb': '^3.450.0',
      '@aws-sdk/lib-dynamodb': '^3.450.0', 
      '@aws-sdk/client-bedrock-runtime': '^3.450.0',
      '@aws-sdk/client-ssm': '^3.450.0'
    }
  };

  const layerNodeModules = path.join(layerDistDir, 'nodejs');
  if (!fs.existsSync(layerNodeModules)) fs.mkdirSync(layerNodeModules, { recursive: true });

  fs.writeFileSync(
    path.join(layerNodeModules, 'package.json'),
    JSON.stringify(layerPackageJson, null, 2)
  );

  console.log('✅ Layer structure created');
  console.log('ℹ️  Run "npm install --production" in dist/layer/nodejs to install dependencies');
}

async function main() {
  try {
    await buildLambdas();
    await buildLayer();
    console.log('🎉 Build completed successfully!');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

main();