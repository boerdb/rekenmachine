/** PM2 — Rekenmachine (poort 3019). */
module.exports = {
  apps: [
    {
      name: "rekenmachine",
      cwd: "/var/www/rekenmachine",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3019,
        TZ: "Europe/Amsterdam",
      },
    },
  ],
};
