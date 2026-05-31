import express, { type Express } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";  // 只保留具名 import
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();  // 確保 app 有宣告

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
