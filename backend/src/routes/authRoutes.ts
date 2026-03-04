import express from 'express';
import { register, login, updateWalletAddress } from '../controllers/authController';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/update-wallet', updateWalletAddress);

export default router;
