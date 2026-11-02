import app from './app.js';
import { env } from './config/env.js';

app.listen(env.port, () => {
  console.log(`GameHub API listening at http://localhost:${env.port}`);
});
