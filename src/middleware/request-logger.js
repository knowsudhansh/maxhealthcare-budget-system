function writeLog(entry) {
  console.log(JSON.stringify(entry));
}

function requestLogger(req, res, next) {
  const started = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    writeLog({
      timestamp: new Date().toISOString(),
      level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
      requestId: req.requestId || "",
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      errorCode: res.locals.errorCode || undefined
    });
  });

  next();
}

module.exports = {
  requestLogger,
  writeLog
};
