package cc.civweave.pocket;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.bluetooth.*;
import android.bluetooth.le.*;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.*;
import android.os.*;
import android.os.ParcelUuid;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import org.json.JSONObject;

/**
 * Civweave Pocket's Android-native BLE central and authenticated status bridge.
 * No phone Wi-Fi sharing or PC is required. Status only comes from a user-
 * configured HTTPS server carrying a dedicated bearer token.
 * BLE is a local visualization transport; no private audio is sent by v0.5.
 */
public final class PocketService extends Service {
    public static final String ACTION_START="cc.civweave.pocket.START";
    public static final String ACTION_STOP="cc.civweave.pocket.STOP";
    public static final String ACTION_CONFIG="cc.civweave.pocket.CONFIG";
    public static final String ACTION_VOICE="cc.civweave.pocket.VOICE";
    public static final String ACTION_PREVIEW_IDLE="cc.civweave.pocket.PREVIEW_IDLE";
    public static final String ACTION_PREVIEW_BATTLE="cc.civweave.pocket.PREVIEW_BATTLE";
    private static final UUID SERVICE=UUID.fromString("bc257ca0-197e-4ba4-8ab7-c70ef45c0010");
    private static final UUID RX=UUID.fromString("bc257ca0-197e-4ba4-8ab7-c70ef45c0011");
    private static final UUID TX=UUID.fromString("bc257ca0-197e-4ba4-8ab7-c70ef45c0012");
    private static final UUID CCCD=UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");
    private static final String CHANNEL="civweave-pocket-ble";
    private static final int NOTIFICATION=4305;
    private final Handler main=new Handler(Looper.getMainLooper());
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final ArrayDeque<byte[]> queue=new ArrayDeque<>();
    private final HashMap<String,Bitmap> atlases=new HashMap<>();
    private BluetoothManager manager;
    private BluetoothLeScanner scanner;
    private BluetoothGatt gatt;
    private BluetoothGattCharacteristic receiver;
    private BluetoothGattCharacteristic sender;
    private boolean busy=false, connected=false, enabled=false, voice=false;
    private int mtu=23;
    private long lastGood=0L,lastSeq=-1,lastStateTransmit=0,lastFrameTransmit=0;
    private String currentMode="disconnected";
    private String agent="Weaveling", task="Waiting for server", jobId="", invite="";
    private int imagePose=0;
    private final Runnable poll=new Runnable(){@Override public void run(){
        if(!enabled)return;
        worker.execute(()->refresh());
        main.postDelayed(this,3000);
    }};

    @Override public void onCreate(){super.onCreate();manager=(BluetoothManager)getSystemService(BLUETOOTH_SERVICE);
        NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        nm.createNotificationChannel(new NotificationChannel(CHANNEL,"Civweave Pocket link",NotificationManager.IMPORTANCE_LOW));
    }
    @Override public int onStartCommand(Intent intent,int flags,int id){
        String action=intent==null?ACTION_START:intent.getAction();
        if(ACTION_STOP.equals(action)){stopSelf();return START_NOT_STICKY;}
        if(ACTION_PREVIEW_IDLE.equals(action)||ACTION_PREVIEW_BATTLE.equals(action)){
            if(connected){final boolean b=ACTION_PREVIEW_BATTLE.equals(action);
                sendPacket(new byte[]{6,(byte)(b?'B':'I')});
                worker.execute(()->renderAndSend(b?"generating":"idle","weaveling","ART PREVIEW · NOT REAL WORK"));
                updateNotice("Artwork preview only; not a generation receipt");
            }return START_STICKY;
        }
        if(ACTION_VOICE.equals(action)){voice=!voice;updateNotice(voice?"Push-to-talk controls ready; audio transport pending":"Voice controls closed");return START_STICKY;}
        if(!enabled){enabled=true;startForeground(NOTIFICATION,notice("Connecting to StickS3"));
            scan();main.post(poll);
        }else if(ACTION_CONFIG.equals(action)){lastSeq=-1;lastGood=0;clearStatus();}
        return START_STICKY;
    }
    private Notification notice(String message){return new Notification.Builder(this,CHANNEL)
        .setSmallIcon(android.R.drawable.stat_notify_sync)
        .setContentTitle("Civweave Pocket")
        .setContentText(message)
        .setOngoing(true)
        .setContentIntent(android.app.PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),
            android.app.PendingIntent.FLAG_UPDATE_CURRENT|android.app.PendingIntent.FLAG_IMMUTABLE)).build();}
    private void updateNotice(String message){((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(NOTIFICATION,notice(message));}
    private boolean allowed(){return Build.VERSION.SDK_INT<31 ||
        (checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN)==PackageManager.PERMISSION_GRANTED &&
        checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)==PackageManager.PERMISSION_GRANTED);}
    @SuppressLint("MissingPermission") private void scan(){
        if(!allowed()){updateNotice("Grant Nearby devices permission");return;}
        BluetoothAdapter adapter=manager.getAdapter();if(adapter==null||!adapter.isEnabled()){updateNotice("Enable Bluetooth");return;}
        scanner=adapter.getBluetoothLeScanner();if(scanner==null)return;
        ScanFilter filter=new ScanFilter.Builder().setServiceUuid(new ParcelUuid(SERVICE)).build();
        scanner.startScan(Collections.singletonList(filter),new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(),scanCallback);
    }
    private final ScanCallback scanCallback=new ScanCallback(){
        @SuppressLint("MissingPermission") @Override public void onScanResult(int type,ScanResult result){
            if(!enabled||connected||gatt!=null||!allowed())return;
            BluetoothDevice dev=result.getDevice();
            // Only our custom service UUID is discoverable here; never connect to unrelated peripherals.
            if(scanner!=null)scanner.stopScan(this);
            gatt=dev.connectGatt(PocketService.this,false,callback,BluetoothDevice.TRANSPORT_LE);
            updateNotice("Pairing StickS3");
        }
        @Override public void onScanFailed(int error){updateNotice("Bluetooth scan error "+error);}
    };
    private final BluetoothGattCallback callback=new BluetoothGattCallback(){
        @SuppressLint("MissingPermission") @Override public void onConnectionStateChange(BluetoothGatt g,int status,int state){
            if(!enabled)return;
            if(status==BluetoothGatt.GATT_SUCCESS&&state==BluetoothProfile.STATE_CONNECTED){
                g.discoverServices();
            }else if(state==BluetoothProfile.STATE_DISCONNECTED||status!=BluetoothGatt.GATT_SUCCESS){
                synchronized(queue){queue.clear();busy=false;}connected=false;receiver=null;sender=null;mtu=23;
                g.close();gatt=null;updateNotice("Stick disconnected; reconnecting");
                main.postDelayed(()->{if(enabled)scan();},3000);
            }
        }
        @SuppressLint("MissingPermission") @Override public void onServicesDiscovered(BluetoothGatt g,int status){
            if(status!=BluetoothGatt.GATT_SUCCESS)return;
            BluetoothGattService service=g.getService(SERVICE);if(service==null)return;
            receiver=service.getCharacteristic(RX);sender=service.getCharacteristic(TX);
            if(receiver==null||sender==null)return;
            if(!g.setCharacteristicNotification(sender,true))return;
            BluetoothGattDescriptor desc=sender.getDescriptor(CCCD);if(desc==null)return;
            if(Build.VERSION.SDK_INT>=33)g.writeDescriptor(desc,BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
            else {desc.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);g.writeDescriptor(desc);}
        }
        @SuppressLint("MissingPermission") @Override public void onDescriptorWrite(BluetoothGatt g,BluetoothGattDescriptor d,int status){
            if(status!=BluetoothGatt.GATT_SUCCESS)return;
            connected=true;updateNotice("Stick connected · server status authoritative");
            g.requestMtu(247);sendState(false);
        }
        @Override public void onMtuChanged(BluetoothGatt g,int size,int status){if(status==BluetoothGatt.GATT_SUCCESS)mtu=size;}
        @Override public void onCharacteristicWrite(BluetoothGatt g,BluetoothGattCharacteristic c,int status){
            synchronized(queue){busy=false;if(status!=BluetoothGatt.GATT_SUCCESS){queue.clear();updateNotice("BLE send failed");return;}}
            nextWrite();
        }
        @Override public void onCharacteristicChanged(BluetoothGatt g,BluetoothGattCharacteristic c,byte[] value){
            if(TX.equals(c.getUuid()))handleButton(value);
        }
        @SuppressWarnings("deprecation") @Override public void onCharacteristicChanged(BluetoothGatt g,BluetoothGattCharacteristic c){
            if(Build.VERSION.SDK_INT<33&&TX.equals(c.getUuid()))handleButton(c.getValue());
        }
    };
    private void handleButton(byte[] packet){if(packet==null||packet.length==0)return;
        String key=new String(packet,StandardCharsets.US_ASCII);
        if("Q".equals(key))worker.execute(()->postAction("needs_human".equals(currentMode)&&!invite.isEmpty()?"accept":"query"));
        else if("X".equals(key))worker.execute(()->postAction(voice?"hangup":"snooze"));
        else if("P".equals(key))updateNotice("PTT held · no audio transmission in v0.5");
        else if("T".equals(key))updateNotice("PTT released · audio transport not yet paired");
        else if(key.startsWith("K")){
            if("K0".equals(key))updateNotice("Stick rejected a frame");
        }
    }
    private void postAction(String action){
        String url=getSharedPreferences("pocket", MODE_PRIVATE).getString("endpoint","");
        String token=getSharedPreferences("pocket", MODE_PRIVATE).getString("token","");
        if(!MainActivity.validUrl(url)||token.isEmpty())return;
        try{
            String body=new JSONObject().put("action",action).toString();
            HttpURLConnection c=(HttpURLConnection)new URL(url.replace("/v1/pocket/state","/v1/pocket/action")).openConnection();
            c.setConnectTimeout(5000);c.setReadTimeout(5000);c.setRequestMethod("POST");c.setDoOutput(true);
            c.setRequestProperty("Authorization","Bearer "+token);c.setRequestProperty("Content-Type","application/json");
            try(OutputStream o=c.getOutputStream()){o.write(body.getBytes(StandardCharsets.UTF_8));}
            int result=c.getResponseCode();c.disconnect();updateNotice(result==200?"Civweave request sent":"Server action rejected ("+result+")");
        }catch(Exception e){updateNotice("Server unavailable; action not sent");}
    }
    private void clearStatus(){
        currentMode="disconnected";jobId="";invite="";lastGood=0;
        synchronized(queue){queue.clear();}
        sendPacket(new byte[]{4});updateNotice("Offline · no verified AI work");
    }
    private void refresh(){
        String url=getSharedPreferences("pocket", MODE_PRIVATE).getString("endpoint","");
        String token=getSharedPreferences("pocket", MODE_PRIVATE).getString("token","");
        if(!MainActivity.validUrl(url)||token.length()<24){if(lastGood>0)clearStatus();return;}
        try{
            HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();
            c.setConnectTimeout(5000);c.setReadTimeout(5000);c.setRequestProperty("Authorization","Bearer "+token);c.setRequestProperty("Accept","application/json");
            c.setRequestProperty("Cache-Control","no-store");
            if(c.getResponseCode()!=200)throw new IOException("not authorized");
            byte[] bytes=readBounded(c.getInputStream(),2048);c.disconnect();
            JSONObject s=new JSONObject(new String(bytes,StandardCharsets.UTF_8));
            // A fresh authorization response is necessary but not sufficient: check upstream provenance too.
            String origin=s.optString("source");String mode=s.optString("mode");
            if(!"civweave.pocket.state.v1".equals(s.optString("schema"))||!"trusted-server".equals(origin)
                ||!s.optBoolean("fresh",false)||s.optDouble("age_seconds",999)>8||s.optDouble("age_seconds",999)<0
                ||!Arrays.asList("idle","generating","completed","blocked","needs_human").contains(mode))throw new IOException("unverified state");
            long seq=s.optLong("seq",-1);if(seq<0||seq<lastSeq)throw new IOException("replayed state");
            if("generating".equals(mode)&&s.optString("job_id").isEmpty())throw new IOException("generation lacks job receipt");
            boolean changed=seq!=lastSeq||!mode.equals(currentMode);
            lastSeq=seq;lastGood=System.currentTimeMillis();currentMode=mode;
            agent=s.optString("agent","Weaveling");task=s.optString("task","Working");jobId=s.optString("job_id","");invite=s.optString("invite_id","");
            if(changed || System.currentTimeMillis()-lastStateTransmit>4500L){
                synchronized(queue){if(queue.size()<20){sendState(true);lastStateTransmit=System.currentTimeMillis();}}
            }
            long now=System.currentTimeMillis();
            if(connected && (changed||now-lastFrameTransmit>("generating".equals(mode)?5500:11000))){
                boolean free; synchronized(queue){free=queue.isEmpty()&&!busy;}
                if(free){lastFrameTransmit=now;renderAndSend(mode,agent,task);}
            }
        }catch(Exception e){
            if(System.currentTimeMillis()-lastGood>8000 && !"disconnected".equals(currentMode))clearStatus();
        }
    }
    private static byte[] readBounded(InputStream s,int cap)throws IOException{
        ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buf=new byte[512];int n;
        try(InputStream in=s){while((n=in.read(buf))!=-1){if(out.size()+n>cap)throw new IOException("Oversized payload");out.write(buf,0,n);}}
        return out.toByteArray();
    }
    private void sendState(boolean fresh){
        if(!connected)return;
        try{JSONObject o=new JSONObject().put("schema","civweave.pocket.state.v1").put("source",fresh?"server":"offline")
            .put("fresh",fresh).put("mode",fresh?currentMode:"disconnected").put("agent",agent.substring(0,Math.min(agent.length(),32)))
            .put("task",task.substring(0,Math.min(task.length(),90))).put("seq",lastSeq);
            sendTransfer('S',o.toString().getBytes(StandardCharsets.UTF_8));
        }catch(Exception ignored){}
    }
    private void renderAndSend(String mode,String agent,String task){
        // Phone performs image compositing from existing Civweave art. Stick only displays frames.
        try{
            boolean battle="generating".equals(mode);
            int w=battle?240:135,h=battle?135:240;
            Bitmap result=Bitmap.createBitmap(w,h,Bitmap.Config.RGB_565);
            Canvas cv=new Canvas(result);cv.drawColor(Color.rgb(12,24,39));
            Paint p=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
            p.setColor(Color.rgb(240,210,148));p.setTextSize(11f);
            cv.drawText(battle?"GENERATING · SERVER":"NEXT AI · SERVER",7,15,p);
            String key=agent.toLowerCase(Locale.ROOT).replaceAll("[^a-z]","");
            if(!Arrays.asList("weaveling","moss","rook","merlin","kamiya").contains(key))key="weaveling";
            Bitmap sheet=getAtlas(key); if(sheet!=null){
                int iw=sheet.getWidth()/3,ih=sheet.getHeight()/2;
                int beat=imagePose++;
                int pose=battle?new int[]{0,2,3,4}[beat%4]:new int[]{0,1,0,0}[beat%4];
                Rect src=new Rect((pose%3)*iw,(pose/3)*ih,(pose%3+1)*iw,(pose/3+1)*ih);
                Rect dst=battle?new Rect(5,15,112,108):new Rect(4,24,131,186);
                cv.drawBitmap(sheet,src,dst,p);
            }
            if(battle){
                Bitmap lari=getAtlas("lari");if(lari!=null){int cw=lari.getWidth()/2,ch=lari.getHeight()/2;
                    int idx=(imagePose/2)%4;
                    cv.drawBitmap(lari,new Rect((idx%2)*cw,(idx/2)*ch,((idx%2)+1)*cw,((idx/2)+1)*ch),new Rect(125,15,231,108),p);}
            }
            p.setColor(Color.WHITE);p.setTextSize(11);
            String caption=battle?agent+" vs Lari":agent;
            cv.drawText(caption.substring(0,Math.min(caption.length(),battle?30:16)),5,h-17,p);
            cv.drawText(task.substring(0,Math.min(task.length(),battle?31:18)),5,h-4,p);
            ByteArrayOutputStream out=new ByteArrayOutputStream();result.compress(Bitmap.CompressFormat.JPEG,56,out);result.recycle();
            byte[] data=out.toByteArray();if(data.length<=22000)sendTransfer('I',data);
        }catch(Exception e){updateNotice("Artwork unavailable; status still connected");}
    }
    private Bitmap getAtlas(String key){
        if(atlases.containsKey(key))return atlases.get(key);
        String path="https://civweave-staging.pages.dev/app/assets/ai/"+key+"-review-sprites-v1.png";
        try{
            HttpURLConnection c=(HttpURLConnection)new URL(path).openConnection();c.setConnectTimeout(4000);c.setReadTimeout(5000);
            if(c.getResponseCode()!=200)throw new IOException("Art missing");
            byte[] data=readBounded(c.getInputStream(),6_000_000);c.disconnect();
            Bitmap bitmap=BitmapFactory.decodeByteArray(data,0,data.length);
            if(bitmap==null||bitmap.getWidth()<100)throw new IOException("Invalid atlas");
            atlases.put(key,bitmap);return bitmap;
        }catch(Exception e){atlases.put(key,null);return null;}
    }
    // BLE framing is also used by UIFlow2 firmware. Write-with-response prevents overrun.
    private void sendTransfer(char kind,byte[] payload){
        if(!connected||payload.length>22000)return;
        synchronized(queue){if(queue.size()>100)return;}
        int sum=0;for(byte b:payload)sum=(sum+(b&255))&65535;
        sendPacket(new byte[]{1,(byte)kind,(byte)(payload.length>>8),(byte)payload.length,(byte)(sum>>8),(byte)sum});
        // MTU negotiation may increase the payload from 19 to ~220 bytes.
        int stride=Math.max(19,Math.min(220,mtu-4));
        for(int at=0;at<payload.length;at+=stride){int len=Math.min(stride,payload.length-at);
            byte[] chunk=new byte[len+1];chunk[0]=2;System.arraycopy(payload,at,chunk,1,len);sendPacket(chunk);}
        sendPacket(new byte[]{3});
    }
    private void sendPacket(byte[] bytes){
        synchronized(queue){if(queue.size()>1800){queue.clear();busy=false;updateNotice("BLE queue overflow; reconnect");return;}
            queue.add(bytes);}nextWrite();
    }
    @SuppressLint("MissingPermission") private void nextWrite(){
        if(!connected||receiver==null||gatt==null||!allowed())return;
        byte[] packet;
        synchronized(queue){if(busy)return;packet=queue.poll();if(packet==null)return;busy=true;}
        int code;
        if(Build.VERSION.SDK_INT>=33)code=gatt.writeCharacteristic(receiver,packet,BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
        else {receiver.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);receiver.setValue(packet);
            code=gatt.writeCharacteristic(receiver)?BluetoothStatusCodes.SUCCESS:-1;}
        if(code!=BluetoothStatusCodes.SUCCESS){synchronized(queue){busy=false;queue.clear();}updateNotice("BLE write refused: "+code);}
    }
    @Override public void onDestroy(){enabled=false;main.removeCallbacks(poll);
        if(scanner!=null&&allowed()){try{scanner.stopScan(scanCallback);}catch(Exception ignored){}}
        if(gatt!=null&&allowed()){try{gatt.disconnect();gatt.close();}catch(Exception ignored){}}
        worker.shutdownNow();stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();
    }
    @Override public IBinder onBind(Intent i){return null;}
}
