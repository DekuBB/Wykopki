import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import citiesRouter from "./cities";
import productsRouter from "./products";
import districtsRouter from "./districts";
import ordersRouter from "./orders";
import settingsRouter from "./settings";
import statsRouter from "./stats";
import telegramRouter from "./telegram";
import authRouter from "./auth";
import productPhotosRouter from "./product-photos";
import storageRouter from "./storage";
import couponsRouter from "./coupons";
import broadcastRouter from "./broadcast";
import telegramMiniAppRouter from "./telegram-mini-app";

import categoriesRouter from "./categories";

const router: IRouter = Router();

router.use(authRouter);
router.use(categoriesRouter);
router.use(storageRouter);
router.use(healthRouter);
router.use(usersRouter);
router.use(citiesRouter);
router.use(productsRouter);
router.use(districtsRouter);
router.use(ordersRouter);
router.use(settingsRouter);
router.use(statsRouter);
router.use(telegramRouter);
router.use(telegramMiniAppRouter);
router.use(productPhotosRouter);
router.use(couponsRouter);
router.use(broadcastRouter);

export default router;
