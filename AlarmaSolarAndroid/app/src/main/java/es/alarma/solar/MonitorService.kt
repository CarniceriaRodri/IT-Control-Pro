package es.alarma.solar

import android.app.*
import android.content.*
import android.os.*
import java.time.LocalTime
import java.util.concurrent.Executors

class MonitorService: Service() {
    private val executor=Executors.newSingleThreadExecutor()
    @Volatile private var running=false
    private var lowSince=0L; private var lastOk=0L; private var alarm=false; private var disconnectAlarm=false
    private lateinit var manager: NotificationManager
    override fun onBind(intent:Intent?)=null
    override fun onCreate() { super.onCreate(); manager=getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(NotificationChannel("monitor","Vigilancia solar",NotificationManager.IMPORTANCE_LOW))
        manager.createNotificationChannel(NotificationChannel("alerts","Alarmas solares",NotificationManager.IMPORTANCE_HIGH))
    }
    private fun note(title:String,message:String,alert:Boolean): Notification {
        val channel=if(alert) "alerts" else "monitor"
        return Notification.Builder(this,channel).setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle(title).setContentText(message)
            .setContentIntent(PendingIntent.getActivity(this,0,Intent(this,MainActivity::class.java),PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)).build()
    }
    private fun alert(title:String, message:String) { manager.notify((System.currentTimeMillis()%100000).toInt()+10, note(title,message,true)) }
    override fun onStartCommand(intent:Intent?,flags:Int,startId:Int):Int {
        if(intent?.action=="STOP") { running=false; stopSelf(); return START_NOT_STICKY }
        startForeground(1,note("Vigilancia solar activa","09:30–19:00 · Solo lectura",false))
        if(!running) { running=true; executor.execute { loop() } }
        return START_STICKY
    }
    private fun loop() {
        val prefs=getSharedPreferences("solar",MODE_PRIVATE)
        while(running) {
            try {
                val now=LocalTime.now()
                val active=!now.isBefore(LocalTime.of(9,30)) && now.isBefore(LocalTime.of(19,0))
                if(active) {
                    val w=Tuya(this).watts(); val threshold=prefs.getString("threshold","100")!!.toDoubleOrNull()?:100.0
                    lastOk=System.currentTimeMillis(); disconnectAlarm=false
                    prefs.edit().putString("last","%.1f W · %s".format(w,java.time.LocalTime.now().toString())).apply()
                    if(w < threshold) {
                        if(lowSince==0L) lowSince=System.currentTimeMillis()
                        if(!alarm && System.currentTimeMillis()-lowSince >= 600000L) { alert("Producción solar baja", "${"%.1f".format(w)} W; menos de $threshold W durante al menos 10 min"); alarm=true }
                    } else {
                        lowSince=0L
                        if(alarm) { alert("Producción solar recuperada","${"%.1f".format(w)} W"); alarm=false }
                    }
                } else { lowSince=0L; alarm=false; disconnectAlarm=false;lastOk=0L }
            } catch(e:Exception) {
                prefs.edit().putString("last","Error de lectura: ${e.message}").apply()
                if(lastOk>0 && !disconnectAlarm && System.currentTimeMillis()-lastOk >= 600000L) { alert("Sin lectura solar", "No se reciben datos válidos del inversor"); disconnectAlarm=true }
            }
            try { Thread.sleep(60000) } catch(_:InterruptedException) { break }
        }
    }
    override fun onDestroy(){running=false;executor.shutdownNow();super.onDestroy()}
}
