// PM2 keeps both processes alive and restarts them on crash/reboot.
// From the project root on the server:
//   pm2 start ecosystem.config.cjs
//   pm2 save          # remember these processes
//   pm2 startup       # run once, then paste the command it prints (auto-start on reboot)
module.exports = {
  apps: [
    {
      name: "pawtrack-web",
      cwd: __dirname,
      script: "npm",
      args: "start", // next start (port 3000)
      env: { NODE_ENV: "production" },
      time: true,
    },
    {
      name: "pawtrack-realtime",
      cwd: __dirname,
      script: "npm",
      args: "run start:realtime", // socket.io + Telegram bot (port 3001)
      env: { NODE_ENV: "production" },
      time: true,
    },
  ],
};
