package es.alarma.solar

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.graphics.Color
import android.view.ViewGroup
import android.widget.*

class MainActivity: Activity() {
    override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(savedInstanceState)
        val p=getSharedPreferences("solar", MODE_PRIVATE)
        val root=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(32,32,32,32); setBackgroundColor(Color.rgb(248,250,253)) }
        val scroll=ScrollView(this); scroll.addView(root);setContentView(scroll)
        fun title(t:String) { root.addView(TextView(this).apply { text=t; textSize=24f;setTextColor(Color.rgb(21,44,61)); setPadding(0,15,0,20) }) }
        title("☀ Alarma Solar Pro")
        root.addView(TextView(this).apply { text="Independiente de Smart Life para vigilar y avisar. Requiere autorización de lectura mediante Tuya Cloud. No modifica el inversor.\nHorario: 09:30–19:00. Alarma tras 10 min bajo el umbral.\n";textSize=15f })
        val fields=linkedMapOf("region" to "Servidor Tuya (Europa)","id" to "Tuya Access ID", "secret" to "Tuya Access Secret", "device" to "Device ID", "code" to "Código de potencia (DP)", "scale" to "Divisor del valor (1, 10, 100...)","threshold" to "Umbral de alarma (W)")
        val defaults=mapOf("region" to "https://openapi.tuyaeu.com", "code" to "total_power", "scale" to "1", "threshold" to "100")
        val widgets=mutableMapOf<String,EditText>()
        for((key,label) in fields) {
            root.addView(TextView(this).apply {text=label;setPadding(0,14,0,0);textSize=14f})
            val entry=EditText(this).apply {setSingleLine(true);setText(p.getString(key,defaults[key]?:""));textSize=15f
                if(key=="secret") inputType=129 }
            root.addView(entry,LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));widgets[key]=entry
        }
        fun save() { val e=p.edit(); widgets.forEach { (key,entry)->e.putString(key,entry.text.toString().trim()) }; e.apply() }
        fun button(text:String,onClick:()->Unit) { root.addView(Button(this).apply {this.text=text;setOnClickListener {onClick()} },LinearLayout.LayoutParams(-1,-2)) }
        button("Guardar configuración") {save(); Toast.makeText(this,"Guardado en este teléfono",Toast.LENGTH_SHORT).show()}
        val status=TextView(this).apply {text="Última lectura: ${p.getString("last","No hay lecturas")}";textSize=15f;setPadding(0,16,0,16)};root.addView(status)
        button("Comprobar lectura ahora") { save(); status.text="Consultando...";Thread {val result=try { "Producción: ${Tuya(this).watts()} W" } catch(e:Exception) {"Error: ${e.message}"}; runOnUiThread { status.text=result } }.start() }
        button("▶ Iniciar vigilancia") { save(); if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS),1)
            try {startForegroundService(Intent(this,MonitorService::class.java));Toast.makeText(this,"Servicio solicitado. Comprueba notificación persistente.",Toast.LENGTH_LONG).show()}catch(e:Exception){Toast.makeText(this,e.message,Toast.LENGTH_LONG).show()} }
        button("■ Detener vigilancia") {startService(Intent(this,MonitorService::class.java).setAction("STOP"))}
        button("🔔 Probar notificación") {val manager=getSystemService(NOTIFICATION_SERVICE) as android.app.NotificationManager
            manager.createNotificationChannel(android.app.NotificationChannel("alerts","Alarmas solares",android.app.NotificationManager.IMPORTANCE_HIGH))
            manager.notify(8000,android.app.Notification.Builder(this,"alerts").setSmallIcon(android.R.drawable.ic_dialog_alert).setContentTitle("Prueba de Alarma Solar").setContentText("Las notificaciones funcionan").build()) }
        root.addView(TextView(this).apply{text="VERSIÓN EXPERIMENTAL: la app no está conectada automáticamente a tu inversor. Tuya Cloud exige credenciales propias y acceso autorizado. No introduzcas claves reales hasta completar una revisión de seguridad. El servicio Android puede ser detenido por el sistema.";textSize=12f;setPadding(0,18,0,20)})
    }
}
