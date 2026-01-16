const path = require('path');

module.exports = {
    apps: [
        {
            name: 'meetrobot-backend',
            script: 'dist/main.js',
            cwd: path.join(__dirname, 'backend'),

            exec_mode: 'fork',   // ← КРИТИЧНО
            instances: 1,        // ← строго 1

            autorestart: true,
            watch: false,

            env: {
                NODE_ENV: 'production',
            },
        },
    ],
};