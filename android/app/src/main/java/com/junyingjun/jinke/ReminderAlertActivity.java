package com.junyingjun.jinke;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class ReminderAlertActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setContentView(buildContent());
    }

    private View buildContent() {
        float density = getResources().getDisplayMetrics().density;
        int padding = Math.round(28 * density);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(padding, padding, padding, padding);
        root.setBackgroundColor(Color.argb(210, 8, 7, 6));

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(padding, padding, padding, padding);
        GradientDrawable cardBackground = new GradientDrawable();
        cardBackground.setColor(Color.rgb(28, 26, 23));
        cardBackground.setCornerRadius(30 * density);
        cardBackground.setStroke(Math.max(1, Math.round(density)), Color.rgb(72, 68, 63));
        card.setBackground(cardBackground);

        TextView title = new TextView(this);
        title.setText(getIntent().getStringExtra(NotificationSupport.EXTRA_REMINDER_TITLE));
        title.setTextColor(Color.WHITE);
        title.setTextSize(24);
        title.setTypeface(null, android.graphics.Typeface.BOLD);

        TextView message = new TextView(this);
        message.setText(getIntent().getStringExtra(NotificationSupport.EXTRA_REMINDER_MESSAGE));
        message.setTextColor(Color.rgb(210, 207, 201));
        message.setTextSize(17);
        message.setLineSpacing(5 * density, 1f);
        LinearLayout.LayoutParams messageParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        messageParams.topMargin = Math.round(18 * density);

        Button open = button("打开今刻", Color.rgb(255, 96, 72), Color.WHITE);
        open.setOnClickListener(view -> {
            int notificationId = getIntent().getIntExtra(NotificationSupport.EXTRA_NOTIFICATION_ID, -1);
            startActivity(NotificationSupport.openTodayActivityIntent(
                    this,
                    "com.junyingjun.jinke.OPEN_FROM_LOCK_SCREEN",
                    notificationId));
            finish();
        });
        LinearLayout.LayoutParams openParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                Math.round(56 * density));
        openParams.topMargin = Math.round(24 * density);

        Button dismiss = button("稍后", Color.TRANSPARENT, Color.rgb(190, 186, 180));
        dismiss.setOnClickListener(view -> finish());
        LinearLayout.LayoutParams dismissParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                Math.round(48 * density));
        dismissParams.topMargin = Math.round(8 * density);

        card.addView(title);
        card.addView(message, messageParams);
        card.addView(open, openParams);
        card.addView(dismiss, dismissParams);
        root.addView(card, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
        return root;
    }

    private Button button(String text, int backgroundColor, int textColor) {
        Button button = new Button(this);
        button.setText(text);
        button.setTextColor(textColor);
        button.setTextSize(17);
        button.setAllCaps(false);
        GradientDrawable background = new GradientDrawable();
        background.setColor(backgroundColor);
        background.setCornerRadius(18 * getResources().getDisplayMetrics().density);
        button.setBackground(background);
        return button;
    }
}
