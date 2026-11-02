export function getHealth(_req, res) {
  res.json({
    success: true,
    message: 'GameHub API is running',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
  });
}
