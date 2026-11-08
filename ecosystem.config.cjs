const path = require('path');
const dotenv = require('dotenv');

const root = __dirname;
const parsed = dotenv.config({ path: path.join(root, '.env') }).parsed || {};

module.exports = {
    apps: [
        {
            name: 'sibyl-system',
            script: 'build/index.js',
            cwd: root,
            env: {
                ...parsed,
                NODE_ENV: 'production',
                HOST: '0.0.0.0',
                PORT: '3002',
                DATABASE_PATH: path.join(root, 'citizen.db'),
                BODY_SIZE_LIMIT: parsed.BODY_SIZE_LIMIT || '8M'
            }
        },
        {
            name: 'sibyl-bot',
            script: 'sibyl-bot.js',
            cwd: path.join(root, 'sibyl-bot'),
            env: {
                ...parsed,
                NODE_ENV: 'production'
            }
        }
    ]
};
