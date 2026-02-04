const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const certDir = path.join(__dirname, 'certs');

if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir);
}

const keyPath = path.join(certDir, 'server.key');
const certPath = path.join(certDir, 'server.crt');

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    console.log('SSL证书已存在，跳过生成');
    process.exit(0);
}

try {
    execSync(`openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=localhost"`, {
        stdio: 'inherit'
    });
    console.log('SSL证书生成成功');
    console.log(`证书文件: ${certPath}`);
    console.log(`私钥文件: ${keyPath}`);
} catch (error) {
    console.error('生成SSL证书失败:', error.message);
    process.exit(1);
}