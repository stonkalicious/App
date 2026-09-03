import { Router, type IRouter } from "express";
import healthRouter from "./health";
import warriorsRouter from "./warriors";
import identityRouter from "./identity";
import assetsRouter from "./assets";

const router: IRouter = Router();

router.use(healthRouter);
router.use(assetsRouter);
router.use(warriorsRouter);
router.use(identityRouter);

export default router;
