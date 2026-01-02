import express from 'express';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { openDb, migrate } from './db/db.js';
import { makeRepo } from './db/repo.js';
import { makeUiRouter } from './routes/ui.js';
import { makeApiRouter } from './routes/api.js';
import { startJobRunner } from './jobs/runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 7030);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const SCHEMA_PATH = path.join(__dirname, 'db', 'schema.sql');

const db = openDb({ dataDir: DATA_DIR });
migrate(db, SCHEMA_PATH);
const repo = makeRepo(db);

const app = express();
app.disable('x-powered-by');
app.use(morgan('dev'));

app.use('/public', express.static(path.join(__dirname, 'public')));

app.use(makeApiRouter({ repo, dataDir: DATA_DIR }));
app.use(makeUiRouter({ repo }));

startJobRunner({ repo, pollMs: 800 });

app.listen(PORT, () => {
  console.log(`TransOrbit listening on http://0.0.0.0:${PORT}`);
  console.log(`DATA_DIR=${DATA_DIR}`);
});
