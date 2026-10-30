package cc.civweave.pocket;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.graphics.Color;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.net.URI;

/** Native, origin-isolated BLE control plane plus normal Civweave WebView.
 * Never expose a JavaScript interface to remote pages. */
public class MainActivity extends Activity {
    private LinearLayout controls;
    private TextView feedback;
    private WebView web;
    private EditText endpoint, token;

    private TextView text(String value) {
        TextView v=new TextView(this); v.setText(value); v.setTextSize(14);v.setTextColor(Color.rgb(230,240,240));
        v.setPadding(12,9,12,9);return v;
    }
    private Button button(String label, Runnable action) {
        Button b=new Button(this);b.setText(label);b.setOnClickListener(v->action.run());return b;
    }
    private void service(String action) { Intent i=new Intent(this,PocketService.class).setAction(action);
        if(Build.VERSION.SDK_INT>=26 && PocketService.ACTION_START.equals(action))startForegroundService(i); else startService(i);
    }
    @Override public void onCreate(Bundle state){super.onCreate(state);
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.rgb(10,20,30));
        controls=new LinearLayout(this);controls.setOrientation(LinearLayout.VERTICAL);
        controls.addView(text("CIVWEAVE POCKET · BLE v0.5"));
        feedback=text("Bluetooth setup is explicit. Battles require fresh server-issued state.");controls.addView(feedback);
        LinearLayout actions=new LinearLayout(this);actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.addView(button("CONNECT",()->{if(permissions())service(PocketService.ACTION_START);}));
        actions.addView(button("STOP",()->service(PocketService.ACTION_STOP)));
        actions.addView(button("VOICE CTRL",()->service(PocketService.ACTION_VOICE)));
        controls.addView(actions);
        LinearLayout previews=new LinearLayout(this);previews.setOrientation(LinearLayout.HORIZONTAL);
        previews.addView(button("PREVIEW IDLE",()->service(PocketService.ACTION_PREVIEW_IDLE)));
        previews.addView(button("PREVIEW BATTLE",()->service(PocketService.ACTION_PREVIEW_BATTLE)));
        controls.addView(previews);
        endpoint=new EditText(this);endpoint.setSingleLine(true);endpoint.setHint("HTTPS trusted /v1/pocket/state URL");endpoint.setTextColor(Color.WHITE);
        endpoint.setHintTextColor(Color.LTGRAY);
        endpoint.setText(getSharedPreferences("pocket", MODE_PRIVATE).getString("endpoint",""));controls.addView(endpoint);
        token=new EditText(this);token.setSingleLine(true);token.setHint("Dedicated pocket device bearer token");token.setTextColor(Color.WHITE);
        token.setHintTextColor(Color.LTGRAY);
        token.setInputType(129); token.setText(getSharedPreferences("pocket", MODE_PRIVATE).getString("token",""));controls.addView(token);
        controls.addView(button("SAVE SERVER LINK",()->{
            String url=endpoint.getText().toString().trim(), secret=token.getText().toString().trim();
            if(!url.isEmpty() && (!validUrl(url)||secret.length()<24)){feedback.setText("Requires HTTPS /v1/pocket/state and a 24+ character dedicated token");return;}
            getSharedPreferences("pocket", MODE_PRIVATE).edit().putString("endpoint",url).putString("token",secret).apply();
            service(PocketService.ACTION_CONFIG);feedback.setText(url.isEmpty()?"Unlinked; BLE art preview only":"Server link saved; awaiting trusted status");
        }));
        controls.addView(text("Tap CONNECT, then turn on the StickS3. Foreground notification keeps BLE connected. " +
          "The voice button enables a hold-to-talk control session; audio forwarding stays disabled until secured voice pairing is implemented."));
        root.addView(controls,new LinearLayout.LayoutParams(-1,-2));
        web=new WebView(this);WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView view,android.webkit.WebResourceRequest req){
            String host=req.getUrl().getHost();return !("civweave.cc".equals(host)||"civweave-staging.pages.dev".equals(host));
        }});
        root.addView(web,new LinearLayout.LayoutParams(-1,0,1));
        setContentView(root); web.loadUrl("https://civweave-staging.pages.dev/app/");
        if(permissions())feedback.setText("Ready to connect over BLE (not Wi-Fi)");
    }
    static boolean validUrl(String s){try{URI u=new URI(s);return "https".equalsIgnoreCase(u.getScheme()) && u.getRawUserInfo()==null && u.getHost()!=null && u.getRawFragment()==null && "/v1/pocket/state".equals(u.getPath());}catch(Exception e){return false;}}
    boolean permissions(){
        if(Build.VERSION.SDK_INT>=31){
            String[] need = Build.VERSION.SDK_INT>=33 ? new String[]{Manifest.permission.BLUETOOTH_SCAN,Manifest.permission.BLUETOOTH_CONNECT,Manifest.permission.POST_NOTIFICATIONS}:new String[]{Manifest.permission.BLUETOOTH_SCAN,Manifest.permission.BLUETOOTH_CONNECT};
            for(String p:need)if(checkSelfPermission(p)!=PackageManager.PERMISSION_GRANTED){requestPermissions(need,19);return false;}
        }else if(Build.VERSION.SDK_INT>=23&&checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION},19);return false;}
        return true;
    }
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);
        if(request==19){ boolean ble=true;for(int i=0;i<permissions.length;i++)if(!Manifest.permission.POST_NOTIFICATIONS.equals(permissions[i])&&results[i]!=PackageManager.PERMISSION_GRANTED)ble=false;
            feedback.setText(ble?"Permissions ready; tap CONNECT":"Bluetooth permission denied. Open Android Settings to allow Nearby devices."); }
    }
    @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
    @Override protected void onDestroy(){if(web!=null)web.destroy();super.onDestroy();}
}
