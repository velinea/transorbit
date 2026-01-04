export function makeRepo(db) {
  const now = () => new Date().toISOString();

  return {
    db,
    // Projects
    createProject({ name, source_lang = 'en', target_lang = 'fi' }) {
      const stmt = db.prepare(
        `INSERT INTO projects (name, source_lang, target_lang) VALUES (?, ?, ?)`
      );
      const info = stmt.run(name, source_lang, target_lang);
      return this.getProject(info.lastInsertRowid);
    },

    listProjects() {
      return db.prepare(`SELECT * FROM projects ORDER BY id DESC`).all();
    },

    getProject(id) {
      return db.prepare(`SELECT * FROM projects WHERE id=?`).get(id);
    },

    // Files
    addFile({ project_id, kind, path, sha1 = null }) {
      const stmt = db.prepare(
        `INSERT INTO files (project_id, kind, path, sha1) VALUES (?, ?, ?, ?)`
      );
      const info = stmt.run(project_id, kind, path, sha1);
      return db.prepare(`SELECT * FROM files WHERE id=?`).get(info.lastInsertRowid);
    },

    // Segments
    replaceSegments({ project_id, segments }) {
      const del = db.prepare(`DELETE FROM segments WHERE project_id=?`);
      const ins = db.prepare(
        `INSERT INTO segments (project_id, idx, start_ms, end_ms, source_text, draft_text, final_text, confidence)
         VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL)`
      );

      const tx = db.transaction(() => {
        del.run(project_id);
        for (const s of segments) {
          ins.run(project_id, s.idx, s.start_ms, s.end_ms, s.text);
        }
      });
      tx();
    },

    listSegments(project_id) {
      return db
        .prepare(`SELECT * FROM segments WHERE project_id=? ORDER BY idx ASC`)
        .all(project_id);
    },

    updateSegmentFinal({ project_id, segId, final_text }) {
      db.prepare(`UPDATE segments SET final_text=? WHERE project_id=? AND id=?`).run(
        final_text,
        project_id,
        segId
      );
      return db.prepare(`SELECT * FROM segments WHERE id=?`).get(segId);
    },

    setSegmentDraftById({ segId, draft_text, confidence }) {
      const info = db
        .prepare(
          `UPDATE segments
        SET draft_text=?, confidence=COALESCE(?, confidence)
        WHERE id=?`
        )
        .run(draft_text, confidence, segId);

      if (info.changes === 0) {
        console.error('DEBUG: update by id failed', segId);
      }
    },

    // Jobs
    createJob({ project_id, type }) {
      const stmt = db.prepare(
        `INSERT INTO jobs (project_id, type, status, progress, updated_at)
         VALUES (?, ?, 'queued', 0, ?)`
      );
      const info = stmt.run(project_id, type, now());
      return this.getJob(info.lastInsertRowid);
    },

    getJob(id) {
      return db.prepare(`SELECT * FROM jobs WHERE id=?`).get(id);
    },

    listJobs(project_id) {
      return db
        .prepare(`SELECT * FROM jobs WHERE project_id=? ORDER BY id DESC`)
        .all(project_id);
    },

    fetchNextQueuedJob() {
      return db
        .prepare(`SELECT * FROM jobs WHERE status='queued' ORDER BY id ASC LIMIT 1`)
        .get();
    },

    setJobStatus(id, status) {
      db.prepare(`UPDATE jobs SET status=?, updated_at=? WHERE id=?`).run(
        status,
        now(),
        id
      );
    },

    setJobProgress(id, progress) {
      db.prepare(`UPDATE jobs SET progress=?, updated_at=? WHERE id=?`).run(
        progress,
        now(),
        id
      );
    },

    appendJobLog(id, line) {
      const job = this.getJob(id);
      const tail = (job.log_tail + '\n' + line).slice(-8000);
      db.prepare(`UPDATE jobs SET log_tail=?, updated_at=? WHERE id=?`).run(
        tail,
        now(),
        id
      );
    },

    failJob(id, error) {
      db.prepare(
        `UPDATE jobs SET status='failed', error=?, updated_at=? WHERE id=?`
      ).run(String(error), now(), id);
    },
  };
}
