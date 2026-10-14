package com.smartbuilding.access;
import android.app.*;import android.content.*;import android.media.MediaPlayer;import android.os.*;import androidx.annotation.Nullable;import androidx.core.app.NotificationCompat;import java.io.*;import java.net.*;import java.util.concurrent.*;import org.json.JSONArray;import org.json.JSONObject;
public class BackgroundDoorMonitorService extends Service{
 static final String CH="door_background_monitor";static final int ID=9133;ScheduledExecutorService scheduler;MediaPlayer player;boolean alarm;long openSince;String last="";
 public void onCreate(){super.onCreate();channel();startForeground(ID,note("Door monitor running"));scheduler=Executors.newSingleThreadScheduledExecutor();scheduler.scheduleWithFixedDelay(this::poll,0,2,TimeUnit.SECONDS);}
 public int onStartCommand(Intent i,int f,int id){if(i!=null){SharedPreferences.Editor e=getSharedPreferences("door_monitor",0).edit();put(e,"url",i.getStringExtra("supabase_url"));put(e,"anon",i.getStringExtra("supabase_anon"));put(e,"access",i.getStringExtra("supabase_access"));put(e,"refresh",i.getStringExtra("supabase_refresh"));e.apply();}return START_STICKY;}
 void put(SharedPreferences.Editor e,String k,String v){if(v!=null&&!v.isEmpty())e.putString(k,v);}
 void poll(){try{SharedPreferences p=getSharedPreferences("door_monitor",0);String base=p.getString("url",""),anon=p.getString("anon",""),access=p.getString("access",""),refresh=p.getString("refresh","");if(base.isEmpty()||anon.isEmpty())return;
  HttpResult dev=get(base+"/rest/v1/devices?device_code=eq.ESP-MAIN-DOOR&select=id&limit=1",anon,access);if(dev.code==401&&!refresh.isEmpty()){access=refreshToken(base,anon,refresh);if(access.isEmpty())return;dev=get(base+"/rest/v1/devices?device_code=eq.ESP-MAIN-DOOR&select=id&limit=1",anon,access);}if(dev.code<200||dev.code>=300)return;JSONArray ds=new JSONArray(dev.body);if(ds.length()==0)return;String id=ds.getJSONObject(0).optString("id","");if(id.isEmpty())return;
  HttpResult door=get(base+"/rest/v1/door_states?device_id=eq."+id+"&select=door_status,device_online&limit=1",anon,access);if(door.code==401&&!refresh.isEmpty()){access=refreshToken(base,anon,refresh);if(access.isEmpty())return;door=get(base+"/rest/v1/door_states?device_id=eq."+id+"&select=door_status,device_online&limit=1",anon,access);}if(door.code<200||door.code>=300)return;JSONArray rows=new JSONArray(door.body);if(rows.length()==0)return;JSONObject row=rows.getJSONObject(0);
  String state=row.optString("door_status","");
  boolean deviceOnline=row.optBoolean("device_online",false);

  // door_status có thể giữ OPEN cuối cùng trong DB khi ESP mất nguồn.
  // Không được dùng trạng thái cũ đó để kích hoạt báo động nền.
  if(!deviceOnline){
    last="";
    openSince=0;
    stopAlarm();
    noteUpdate("ESP offline - bỏ qua trạng thái cửa cũ");
    return;
  }

  if("OPEN".equals(state)){if(!"OPEN".equals(last)){last="OPEN";openSince=System.currentTimeMillis();noteUpdate("Door open - monitoring 10 seconds");}else if(!alarm&&System.currentTimeMillis()-openSince>=10000){alarm=true;playOnce();noteUpdate("ALARM: door open over 10 seconds");}}
  else if("CLOSED".equals(state)){if(!"CLOSED".equals(last)||alarm){last="CLOSED";openSince=0;stopAlarm();noteUpdate("Door closed");}}
 }catch(Exception ignored){}}
 HttpResult get(String endpoint,String anon,String access){try{HttpURLConnection c=(HttpURLConnection)new URL(endpoint).openConnection();c.setRequestMethod("GET");c.setConnectTimeout(5000);c.setReadTimeout(5000);c.setRequestProperty("apikey",anon);if(!access.isEmpty())c.setRequestProperty("Authorization","Bearer "+access);int code=c.getResponseCode();InputStream s=code>=400?c.getErrorStream():c.getInputStream();String body=read(s);c.disconnect();return new HttpResult(code,body);}catch(Exception e){return new HttpResult(-1,"");}}
 String refreshToken(String base,String anon,String refresh){try{HttpURLConnection c=(HttpURLConnection)new URL(base+"/auth/v1/token?grant_type=refresh_token").openConnection();c.setRequestMethod("POST");c.setDoOutput(true);c.setConnectTimeout(5000);c.setReadTimeout(5000);c.setRequestProperty("apikey",anon);c.setRequestProperty("Content-Type","application/json");String payload="{\"refresh_token\":\""+refresh.replace("\\","\\\\").replace("\"","\\\"")+"\"}";c.getOutputStream().write(payload.getBytes("UTF-8"));int code=c.getResponseCode();if(code<200||code>=300)return "";String body=read(c.getInputStream());c.disconnect();JSONObject o=new JSONObject(body);String a=o.optString("access_token","");String r=o.optString("refresh_token",refresh);if(!a.isEmpty())getSharedPreferences("door_monitor",0).edit().putString("access",a).putString("refresh",r).apply();return a;}catch(Exception e){return "";}}
 String read(InputStream s)throws Exception{if(s==null)return "";BufferedReader r=new BufferedReader(new InputStreamReader(s,"UTF-8"));StringBuilder b=new StringBuilder();String l;while((l=r.readLine())!=null)b.append(l);r.close();return b.toString();}
 void playOnce(){if(!alarm)return;player=MediaPlayer.create(this,R.raw.door_alarm);if(player==null){alarm=false;return;}player.setOnCompletionListener(m->{m.release();player=null;if(alarm)playOnce();});player.setOnErrorListener((m,w,e)->{m.release();player=null;alarm=false;return true;});player.start();}
 void stopAlarm(){alarm=false;if(player!=null){try{if(player.isPlaying())player.stop();}catch(Exception ignored){}try{player.release();}catch(Exception ignored){}player=null;}}
 void channel(){if(Build.VERSION.SDK_INT>=26)getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel(CH,"Door monitor",NotificationManager.IMPORTANCE_LOW));}
 Notification note(String text){Intent i=getPackageManager().getLaunchIntentForPackage(getPackageName());PendingIntent p=i==null?null:PendingIntent.getActivity(this,0,i,PendingIntent.FLAG_UPDATE_CURRENT|(Build.VERSION.SDK_INT>=23?PendingIntent.FLAG_IMMUTABLE:0));return new NotificationCompat.Builder(this,CH).setSmallIcon(R.drawable.app_logo).setContentTitle("Smart Building").setContentText(text).setOngoing(true).setCategory(NotificationCompat.CATEGORY_SERVICE).setContentIntent(p).build();}
 void noteUpdate(String t){((NotificationManager)getSystemService(Context.NOTIFICATION_SERVICE)).notify(ID,note(t));}
 public void onDestroy(){stopAlarm();if(scheduler!=null)scheduler.shutdownNow();super.onDestroy();}
 @Nullable public IBinder onBind(Intent i){return null;}
 static class HttpResult{final int code;final String body;HttpResult(int c,String b){code=c;body=b;}}
}