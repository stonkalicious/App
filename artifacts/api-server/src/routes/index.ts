import { Router, type IRouter } from "express";
import healthRouter from "./health";
import warriorsRouter from "./warriors";

const router: IRouter = Router();

router.use(healthRouter);
router.use(warriorsRouter);

export default router;
