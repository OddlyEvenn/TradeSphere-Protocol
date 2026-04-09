import express from 'express';
import { register, login, updateWalletAddress, clearDatabase } from '../controllers/authController';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/update-wallet', updateWalletAddress);
router.post('/clear-db', clearDatabase);

export default router;
