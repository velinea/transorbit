import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Busboy from 'busboy';
import { parseSrt, writeSrt } from '../subtitles/srt.js';
import { suggestVariants } from '../engines/mock.js';

export function makeApiRouter({ repo, dataDir }) {
  const r = express.Router();

  r.post('/api/projects', express.urlencoded({ extended: false }), (req, res) => {
    const { name, source_lang, target_lang } = req.body;
    const project = repo.createProject({ name, source_lang, target_lang });
    res.redirect(`/p/${project.id}`);
  });

  r.post('/api/projects/:id/upload', (req, res) => {
    const project_id = Number(req.params.id);
    const project = repo.getProject(project_id);
    if (!project) return res.status(404).send('Not found');

    const bb = Busboy({ headers: req.headers });
    let fileBufs = [];
    let filename = 'upload.srt';

    bb.on('file', (_name, file, info) => {
      filename = info.filename || filename;
      file.on('data', d => fileBufs.push(d));
    });

    bb.on('finish', () => {
      const buf = Buffer.concat(fileBufs);
      const sha1 = crypto.createHash('sha1').update(buf).digest('hex');
      const srtText = buf.toString('utf8');

      let segments;
      try {
        segments = parseSrt(srtText);
      } catch (e) {
        return res.status(400).send(`SRT parse error: ${e}`);
      }

      // persist file
      const projDir = path.join(dataDir, 'projects', String(project_id));
      fs.mkdirSync(projDir, { recursive: true });
      const filePath = path.join(projDir, `${Date.now()}_${safeName(filename)}`);
      fs.writeFileSync(filePath, buf);

      repo.addFile({ project_id, kind: 'source_srt', path: filePath, sha1 });
      repo.replaceSegments({ project_id, segments });

      res.redirect(`/p/${project_id}/edit`);
    });

    req.pipe(bb);
  });

  r.post(
    '/api/projects/:id/jobs',
    express.urlencoded({ extended: false }),
    (req, res) => {
      const project_id = Number(req.params.id);
      const project = repo.getProject(project_id);
      if (!project) return res.status(404).send('Not found');

      const type = String(req.body.type || 'translate');
      const job = repo.createJob({ project_id, type });
      res.redirect(`/p/${project_id}`);
    }
  );

  r.get('/api/projects/:id/segments', (req, res) => {
    const project_id = Number(req.params.id);
    res.json({ segments: repo.listSegments(project_id) });
  });

  r.patch('/api/projects/:id/segments/:segId', express.json(), (req, res) => {
    const project_id = Number(req.params.id);
    const segId = Number(req.params.segId);
    const final_text = String(req.body.final_text ?? '');
    const seg = repo.updateSegmentFinal({ project_id, segId, final_text });
    res.json({ segment: seg });
  });

  r.post(
    '/api/projects/:id/segments/:segId/suggest',
    express.json(),
    async (req, res) => {
      const project_id = Number(req.params.id);
      const segId = Number(req.params.segId);

      const seg = repo.listSegments(project_id).find(s => s.id === segId);
      if (!seg) return res.status(404).json({ error: 'Segment not found' });

      const n = Number(req.body.n ?? 3);
      const variants = await suggestVariants({ source_text: seg.source_text, n });
      res.json({ variants });
    }
  );

  r.get('/api/projects/:id/export.srt', (req, res) => {
    const project_id = Number(req.params.id);
    const segs = repo.listSegments(project_id).map(s => ({
      start_ms: s.start_ms,
      end_ms: s.end_ms,
      text: s.final_text ?? s.draft_text ?? s.source_text,
    }));
    const srt = writeSrt(segs);
    res.setHeader('Content-Type', 'application/x-subrip; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="transorbit_${project_id}.srt"`
    );
    res.send(srt);
  });

  // SSE job stream: pushes any job changes (simple polling loop server-side)
  r.get('/api/jobs/stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    let closed = false;
    req.on('close', () => {
      closed = true;
    });

    let last = '';
    const interval = setInterval(() => {
      if (closed) return clearInterval(interval);
      const pid = Number(req.query.project_id || 0);
      const jobs = pid ? repo.listJobs(pid) : [];
      const payload = JSON.stringify({ jobs });

      if (payload !== last) {
        last = payload;
        res.write(`event: jobs\n`);
        res.write(`data: ${payload}\n\n`);
      }
    }, 700);

    res.write(`event: hello\ndata: {}\n\n`);
  });

  return r;
}

function safeName(n) {
  return String(n).replace(/[^a-zA-Z0-9._-]/g, '_');
}
