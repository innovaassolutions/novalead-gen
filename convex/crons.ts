import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily analytics generation at midnight UTC
crons.daily(
  "generate-daily-analytics",
  { hourUTC: 0, minuteUTC: 0 },
  internal.jobs.createFromCron,
  {
    type: "generate_analytics",
    priority: 3,
    payload: { period: "daily" },
  }
);

// Weekly analytics on Mondays at 1am UTC
crons.weekly(
  "generate-weekly-analytics",
  { dayOfWeek: "monday", hourUTC: 1, minuteUTC: 0 },
  internal.jobs.createFromCron,
  {
    type: "generate_analytics",
    priority: 3,
    payload: { period: "weekly" },
  }
);

export default crons;
