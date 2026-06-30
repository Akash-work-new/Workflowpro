import { Router } from 'express';
import {
  register,
  login,
  refresh,
  setup2FA,
  verify2FA,
  verifyEmail,
  forgotPassword,
  resetPassword,
} from '../controllers/authController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/verify-email', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// 2FA Routes (setup requires auth, verify handles login or setup verify)
router.post('/2fa/setup', requireAuth, setup2FA);
router.post('/2fa/verify', (req, res, next) => {
  // If request contains an authorization header, verify it as authenticated setup verification
  if (req.headers.authorization) {
    return requireAuth(req, res, next);
  }
  next();
}, verify2FA);

export default router;
