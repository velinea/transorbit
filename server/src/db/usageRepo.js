export function makeUsageRepo(db) {
  return {
    addUsage({ month, provider, amount }) {
      db.prepare(
        `
        INSERT INTO usage_monthly (month, provider, amount, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(month, provider)
        DO UPDATE SET
          amount = amount + excluded.amount,
          updated_at = datetime('now')
      `
      ).run(month, provider, amount);
    },

    getUsage(month) {
      return db.prepare(`SELECT * FROM usage_monthly WHERE month=?`).all(month);
    },
  };
}
