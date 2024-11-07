const express = require("express");
const pino = require("pino");

const app = express();
const port = process.env.APP_PORT ?? 8888;

const transport = pino.transport({
  target: "pino-opentelemetry-transport",
});

const logger = pino(transport);

async function firstHandler(req, res) {
  logger.info("heyyy 33!!");
  return res.sendStatus(200);
}

app.get("/first", firstHandler);

app.listen(port, () => {
  console.log(`Starting ${process.env.OTEL_SERVICE_NAME} on port ${port}`);
});
