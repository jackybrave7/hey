module.exports = {
  apps: [{
    name: 'hey',
    script: 'server/src/index.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    restart_delay: 2000,
    max_restarts: 10,
    watch: false
  }]
};
