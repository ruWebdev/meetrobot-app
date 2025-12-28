module.exports = {
    apps: [
        {
            name: 'meetrobot-backend',
            cwd: './backend',
            script: 'dist/main.js',
            instances: 1,
            autorestart: true,
            watch: false,
            env: {
                NODE_ENV: 'production',
            },
        },
    ],
};
