import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function createAccessToken(userId) {
  return jwt.sign({ sub: userId }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}
