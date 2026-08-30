package com.junyingjun.jinke;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.PersistableBundle;
import android.util.Log;

/**
 * A second, system-owned reminder path.
 *
 * AlarmManager remains the exact primary path.  This persisted JobScheduler entry is a
 * deliberately slightly-late safety net for OEM builds that occasionally suppress an alarm
 * after aggressively reclaiming the application process.  Both paths enter the same receiver
 * and share NotificationSupport's duplicate-delivery lock.
 */
public class ReminderBackupJobService extends JobService {
    private static final String LOG_TAG = "JinkeReminder";
    private static final String EXTRA_KIND = "kind";
    private static final String EXTRA_TIME = "time";
    private static final String KIND_DAILY = "daily";
    private static final String KIND_DDL = "ddl";
    private static final String KIND_TEST = "test";
    private static final int DAILY_JOB_BASE = 30000;
    private static final int DDL_JOB_BASE = 40000;
    private static final int TEST_JOB_ID = 49990;
    private static final long BACKUP_DELAY_MILLIS = 20000L;
    private static final long BACKUP_DEADLINE_MILLIS = 120000L;

    static boolean scheduleDaily(Context context, String time, long triggerAtMillis) {
        return schedule(context, KIND_DAILY, time, triggerAtMillis, dailyJobId(time));
    }

    static boolean scheduleDdl(Context context, String time, long triggerAtMillis) {
        return schedule(context, KIND_DDL, time, triggerAtMillis, ddlJobId(time));
    }

    static void cancelDaily(Context context, String time) {
        cancel(context, dailyJobId(time));
    }

    static void cancelDdl(Context context, String time) {
        cancel(context, ddlJobId(time));
    }

    static boolean scheduleTest(Context context, long triggerAtMillis) {
        return schedule(context, KIND_TEST, "test", triggerAtMillis, TEST_JOB_ID);
    }

    static void cancelTest(Context context) {
        cancel(context, TEST_JOB_ID);
    }

    static int pendingCount(Context context) {
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        if (scheduler == null) return 0;
        int count = 0;
        ComponentName component = new ComponentName(context, ReminderBackupJobService.class);
        for (JobInfo job : scheduler.getAllPendingJobs()) {
            if (component.equals(job.getService())) count += 1;
        }
        return count;
    }

    private static boolean schedule(
            Context context, String kind, String time, long triggerAtMillis, int jobId) {
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        if (scheduler == null) return false;
        long delay = Math.max(0L, triggerAtMillis - System.currentTimeMillis());
        PersistableBundle extras = new PersistableBundle();
        extras.putString(EXTRA_KIND, kind);
        extras.putString(EXTRA_TIME, time);
        JobInfo info = new JobInfo.Builder(
                jobId,
                new ComponentName(context, ReminderBackupJobService.class))
                .setMinimumLatency(delay + BACKUP_DELAY_MILLIS)
                .setOverrideDeadline(delay + BACKUP_DEADLINE_MILLIS)
                .setPersisted(true)
                .setExtras(extras)
                .build();
        int result = scheduler.schedule(info);
        boolean accepted = result == JobScheduler.RESULT_SUCCESS;
        Log.i(LOG_TAG, "Scheduled " + kind + " backup job " + jobId + " at "
                + triggerAtMillis + ", accepted=" + accepted);
        return accepted;
    }

    private static void cancel(Context context, int jobId) {
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        if (scheduler != null) scheduler.cancel(jobId);
    }

    private static int dailyJobId(String time) {
        return DAILY_JOB_BASE + minutesFromClock(time);
    }

    private static int ddlJobId(String time) {
        return DDL_JOB_BASE + minutesFromClock(time);
    }

    private static int minutesFromClock(String time) {
        if (time == null || !time.matches("(?:[01]\\d|2[0-3]):[0-5]\\d")) return 0;
        return Integer.parseInt(time.substring(0, 2)) * 60 + Integer.parseInt(time.substring(3));
    }

    @Override
    public boolean onStartJob(JobParameters parameters) {
        PersistableBundle extras = parameters.getExtras();
        String kind = extras.getString(EXTRA_KIND, "");
        String time = extras.getString(EXTRA_TIME, "");
        Intent intent;
        if (KIND_DAILY.equals(kind)) {
            intent = new Intent(this, DailyAlarmReceiver.class)
                    .setAction("com.junyingjun.jinke.BACKUP_DAILY." + time.replace(":", ""))
                    .putExtra(DailyScheduler.EXTRA_REMINDER_TIME, time);
        } else if (KIND_DDL.equals(kind)) {
            intent = new Intent(this, DdlAlarmReceiver.class)
                    .setAction("com.junyingjun.jinke.BACKUP_DDL." + time.replace(":", ""))
                    .putExtra(DdlScheduler.EXTRA_REMINDER_TIME, time);
        } else if (KIND_TEST.equals(kind)) {
            intent = new Intent(this, ReminderTestReceiver.class)
                    .setAction(ReminderTestReceiver.ACTION);
        } else {
            Log.w(LOG_TAG, "Ignoring malformed reminder backup job " + parameters.getJobId());
            return false;
        }
        intent.setPackage(getPackageName()).addFlags(Intent.FLAG_RECEIVER_FOREGROUND);
        Log.i(LOG_TAG, "Reminder backup job fired for " + kind + " at " + time);
        sendBroadcast(intent);
        return false;
    }

    @Override
    public boolean onStopJob(JobParameters parameters) {
        return true;
    }
}
