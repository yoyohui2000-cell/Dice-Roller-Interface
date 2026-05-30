import { Router, type IRouter } from "express";
import healthRouter from "./health";
import geminiRouter from "./gemini";
import campaignRouter from "./campaign";

const router: IRouter = Router();

router.use(healthRouter);
router.use(geminiRouter);
router.use(campaignRouter);

export default router;
