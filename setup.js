// setup.js - Enhanced setup for Web3.Storage w3up and PrivyChain
import { create } from '@web3-storage/w3up-client';
import dotenv from 'dotenv';
import readline from 'readline';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(question) {
    return new Promise(resolve => {
        rl.question(question, resolve);
    });
}

function askYesNo(question) {
    return new Promise(resolve => {
        rl.question(question + ' (y/n): ', (answer) => {
            resolve(answer.toLowerCase().startsWith('y'));
        });
    });
}

async function checkEnvironmentFile() {
    try {
        await fs.access('.env');
        return true;
    } catch {
        return false;
    }
}

async function createEnvironmentFile() {
    console.log('📝 Creating .env file...');
    
    const email = await askQuestion('📧 Enter your email for Web3.Storage: ');
    const port = await askQuestion('🌐 Server port (default: 8080): ') || '8080';
    const dbPath = await askQuestion('📊 Database path (default: ./privychain.db): ') || './privychain.db';
    
    const skipSignature = await askYesNo('⚠️  Skip signature verification for development?');
    const enableDebug = await askYesNo('🐛 Enable debug logging?');
    
    const envContent = `# PrivyChain JavaScript Backend Configuration
# =================================
# SERVER CONFIGURATION
# =================================
PORT=${port}
NODE_ENV=development

# DEVELOPMENT SETTINGS
SKIP_SIGNATURE_VERIFICATION=${skipSignature}
DEBUG=${enableDebug}

# =================================
# DATABASE CONFIGURATION
# =================================
DATABASE_PATH=${dbPath}

# =================================
# WEB3.STORAGE CONFIGURATION
# =================================
# Your w3up email (for setup)
W3UP_EMAIL=${email}

# =================================
# BLOCKCHAIN CONFIGURATION (OPTIONAL)
# =================================
# For future blockchain integration
ETHEREUM_RPC=https://api.node.glif.io
CONTRACT_ADDRESS=0x6E2ca2E8278ff38ce091Fc2cB5572ed7efd82f97
PRIVATE_KEY=

# =================================
# SECURITY
# =================================
JWT_SECRET=your-super-secure-jwt-secret-key-change-in-production-${Math.random().toString(36).substring(2, 15)}

# =================================
# OPTIONAL FEATURES
# =================================
# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS settings (comma-separated URLs for production)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
`;

    await fs.writeFile('.env', envContent);
    console.log('✅ .env file created');
    
    // Reload environment
    dotenv.config();
}

async function setupW3up() {
    console.log('🔧 PrivyChain Web3.Storage Setup');
    console.log('================================');
    console.log('');
    
    try {
        // Check if .env exists
        const hasEnv = await checkEnvironmentFile();
        if (!hasEnv) {
            console.log('📝 No .env file found. Let\'s create one!');
            console.log('');
            await createEnvironmentFile();
            console.log('');
        }
        
        // Create w3up client
        console.log('📦 Creating w3up client...');
        const client = await create();
        
        // Check if already set up
        const accounts = client.accounts();
        if (Object.keys(accounts).length > 0) {
            console.log('✅ w3up account already configured!');
            const currentSpace = client.currentSpace();
            if (currentSpace) {
                console.log(`📁 Current space: ${currentSpace.did()}`);
                
                // Test upload to verify everything works
                const testUpload = await askYesNo('🧪 Test file upload?');
                if (testUpload) {
                    await testFileUpload(client);
                }
                
                console.log('🎉 Setup complete! You can now start the server.');
                console.log('   npm start');
                console.log('');
                rl.close();
                return;
            }
        }
        
        // Get email from user or environment
        let email = process.env.W3UP_EMAIL;
        if (!email) {
            email = await askQuestion('📧 Enter your email for Web3.Storage: ');
            
            // Update .env file with email
            if (hasEnv) {
                try {
                    let envContent = await fs.readFile('.env', 'utf8');
                    if (envContent.includes('W3UP_EMAIL=')) {
                        envContent = envContent.replace(/W3UP_EMAIL=.*/, `W3UP_EMAIL=${email}`);
                    } else {
                        envContent += `\nW3UP_EMAIL=${email}\n`;
                    }
                    await fs.writeFile('.env', envContent);
                    console.log('📝 Updated .env file with email');
                } catch (error) {
                    console.log('⚠️  Could not update .env file:', error.message);
                }
            }
        }
        
        console.log('');
        console.log('🔄 Logging in to Web3.Storage...');
        console.log('📬 An email will be sent to you for verification.');
        console.log('👆 Please click the link in the email to continue.');
        console.log('⏳ Waiting for email verification...');
        console.log('');
        
        // Login (this will wait for email verification)
        const account = await client.login(email);
        console.log('✅ Email verified successfully!');
        
        // Create a space
        console.log('📁 Creating a space for PrivyChain...');
        const space = await client.createSpace('privychain-backend');
        await space.save();
        await client.setCurrentSpace(space.did());
        
        // Provision the space
        console.log('🔧 Provisioning space...');
        await account.provision(space.did());
        
        console.log('');
        console.log('🎉 Setup completed successfully!');
        console.log('=====================================');
        console.log(`📧 Account: ${email}`);
        console.log(`📁 Space DID: ${space.did()}`);
        console.log(`🆔 Agent DID: ${client.agent().did()}`);
        console.log('');
        
        // Test upload
        const testUpload = await askYesNo('🧪 Test file upload to verify setup?');
        if (testUpload) {
            await testFileUpload(client);
        }
        
        console.log('✅ You can now start the PrivyChain backend:');
        console.log('   npm start');
        console.log('');
        console.log('📚 Next steps:');
        console.log('   1. Start the server: npm start');
        console.log('   2. Test health endpoint: curl http://localhost:8080/api/v1/health');
        console.log('   3. Check the API documentation for usage examples');
        console.log('');
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        
        if (error.message.includes('User rejected')) {
            console.log('');
            console.log('💡 Email verification was not completed.');
            console.log('   Please try running setup again and click the email link.');
        } else if (error.message.includes('fetch')) {
            console.log('');
            console.log('💡 Network error occurred. Please check your internet connection.');
            console.log('   and try running setup again.');
        } else if (error.message.includes('space')) {
            console.log('');
            console.log('💡 Space creation failed. This might be temporary.');
            console.log('   Please try running setup again.');
        }
        
        console.log('');
        console.log('🔧 Troubleshooting:');
        console.log('   - Ensure you have a stable internet connection');
        console.log('   - Check that your email address is correct');
        console.log('   - Try running the setup again');
        console.log('   - Check Web3.Storage status at https://web3.storage');
        
        process.exit(1);
    } finally {
        rl.close();
    }
}

async function testFileUpload(client) {
    try {
        console.log('🧪 Testing file upload...');
        
        const testData = Buffer.from('Hello from PrivyChain! This is a test file.', 'utf8');
        const testFile = new File([testData], 'test.txt', { type: 'text/plain' });
        
        const cid = await client.uploadFile(testFile);
        console.log(`✅ Test upload successful!`);
        console.log(`📄 Test file CID: ${cid}`);
        console.log(`🌐 Gateway URL: https://w3s.link/ipfs/${cid}`);
        
        // Try to retrieve the file to verify it works
        console.log('🔍 Verifying file retrieval...');
        const response = await fetch(`https://w3s.link/ipfs/${cid}`);
        
        if (response.ok) {
            const content = await response.text();
            if (content.includes('Hello from PrivyChain')) {
                console.log('✅ File retrieval test passed!');
            } else {
                console.log('⚠️  File content mismatch during retrieval test');
            }
        } else {
            console.log('⚠️  File retrieval test failed (this might be normal for new uploads)');
            console.log('💡 Files may take a few minutes to propagate to gateways');
        }
        
    } catch (error) {
        console.log('❌ Test upload failed:', error.message);
        console.log('💡 This doesn\'t necessarily mean setup failed');
        console.log('   The main setup is complete, but there might be a temporary issue');
    }
}

async function displaySystemInfo() {
    console.log('💻 System Information:');
    console.log(`   Node.js: ${process.version}`);
    console.log(`   Platform: ${process.platform}`);
    console.log(`   Architecture: ${process.arch}`);
    console.log('');
    
    try {
        const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
        console.log('📦 PrivyChain Backend:');
        console.log(`   Version: ${packageJson.version}`);
        console.log(`   Dependencies: ${Object.keys(packageJson.dependencies || {}).length}`);
        console.log('');
    } catch {
        // Ignore if package.json not found
    }
}

// Enhanced setup with system checks
async function enhancedSetup() {
    console.log('🔧 PrivyChain Enhanced Setup');
    console.log('============================');
    console.log('');
    
    await displaySystemInfo();
    
    // Check Node.js version
    const nodeVersion = process.version.replace('v', '');
    const majorVersion = parseInt(nodeVersion.split('.')[0]);
    
    if (majorVersion < 18) {
        console.log('⚠️  Warning: Node.js 18+ is recommended for PrivyChain');
        console.log(`   Current version: ${process.version}`);
        console.log('');
        
        const continueAnyway = await askYesNo('Continue with current Node.js version?');
        if (!continueAnyway) {
            console.log('Please upgrade Node.js and run setup again.');
            process.exit(1);
        }
    }
    
    // Check if dependencies are installed
    try {
        await fs.access('node_modules');
        console.log('✅ Dependencies are installed');
    } catch {
        console.log('⚠️  Dependencies not found. Please run: npm install');
        process.exit(1);
    }
    
    console.log('');
    await setupW3up();
}

// Run enhanced setup
enhancedSetup();