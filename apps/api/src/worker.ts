import { sql } from "drizzle-orm";
import { db, jobs } from "@collective/db";
import { processAgreement } from "@collective/pipeline";

const POLL_INTERVAL_MS = 5000;
const MAX_ATTEMPTS = 3;

let running = true;

process.on("SIGINT", () => {
  running = false;
});
process.on("SIGTERM", () => {
  running = false;
});

console.log("worker started");

while (running) {
  try {
    const claimed = await db.execute(sql`
      update jobs set status = 'running', attempts = attempts + 1, updated_at = now()
      where id = (
        select id from jobs where status = 'pending' order by created_at limit 1 for update skip locked
      )
      returning *
    `);
    type ClaimedJob = typeof jobs.$inferSelect;
    const job = (claimed.rows as unknown as ClaimedJob[])[0];

    if (!job) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    console.log(`processing job ${job.id} (${job.type})`);
    const result = await processAgreement(job.payload.agreementId as string);

    if (result.ok) {
      await db
        .update(jobs)
        .set({ status: "done", updatedAt: new Date() })
        .where(sql`id = ${job.id}`);
      await triggerRebuild();
    } else if ((job.attempts ?? 1) >= MAX_ATTEMPTS) {
      await db
        .update(jobs)
        .set({ status: "failed", error: result.error, updatedAt: new Date() })
        .where(sql`id = ${job.id}`);
      console.error(`job ${job.id} failed permanently: ${result.error}`);
    } else {
      await db
        .update(jobs)
        .set({ status: "pending", error: result.error, updatedAt: new Date() })
        .where(sql`id = ${job.id}`);
    }
  } catch (err) {
    console.error("worker loop error:", err);
    await sleep(POLL_INTERVAL_MS);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function triggerRebuild(): Promise<void> {
  const url = process.env.REBUILD_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, { method: "POST" });
  } catch (err) {
    console.error("rebuild webhook failed:", err);
  }
}
