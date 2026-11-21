package es.alarma.solar

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import java.security.MessageDigest

internal class Tuya(private val context: Context) {
    private val pref = context.getSharedPreferences("solar", Context.MODE_PRIVATE)
    private val host get() = pref.getString("region", "https://openapi.tuyaeu.com")!!.trimEnd('/')
    private val cid get() = pref.getString("id", "")!!
    private val secret get() = pref.getString("secret", "")!!
    private fun sha(body: String) = MessageDigest.getInstance("SHA-256").digest(body.toByteArray()).joinToString("") { "%02x".format(it) }
    private fun hmac(data: String): String { val mac=Mac.getInstance("HmacSHA256"); mac.init(SecretKeySpec(secret.toByteArray(), "HmacSHA256")); return mac.doFinal(data.toByteArray()).joinToString("") { "%02X".format(it) } }
    private fun request(path: String, token: String = ""): JSONObject {
        val timestamp=System.currentTimeMillis().toString()
        val signString = "GET\n${sha("")}\n\n$path"
        val signature=hmac(cid + token + timestamp + signString)
        val con=URL(host+path).openConnection() as HttpURLConnection
        con.requestMethod="GET"; con.connectTimeout=12000; con.readTimeout=12000
        con.setRequestProperty("client_id", cid); con.setRequestProperty("t",timestamp)
        con.setRequestProperty("sign_method","HMAC-SHA256"); con.setRequestProperty("sign",signature)
        if(token.isNotEmpty()) con.setRequestProperty("access_token",token)
        return try {
            val body=(if(con.responseCode in 200..299) con.inputStream else con.errorStream)?.bufferedReader()?.use { it.readText() } ?: "{}"
            val json=JSONObject(body)
            if(!json.optBoolean("success",false)) throw IllegalStateException(json.optString("msg", "API error")+" ("+json.optString("code")+")")
            json
        } finally { con.disconnect() }
    }
    private var token=""; private var expiresAt=0L
    private fun token(): String {
        if(System.currentTimeMillis() >= expiresAt || token.isBlank()) {
            val response=request("/v1.0/token?grant_type=1")
            val result=response.getJSONObject("result"); token=result.getString("access_token")
            expiresAt=System.currentTimeMillis()+ (result.optLong("expire_time",7200)-120).coerceAtLeast(60)*1000
        }
        return token
    }
    fun watts(): Double {
        require(cid.isNotBlank() && secret.isNotBlank()) { "Configura las credenciales Tuya" }
        val device=pref.getString("device","")!!.trim(); require(device.isNotEmpty()) { "Falta Device ID" }
        val code=pref.getString("code","total_power")!!.trim()
        val response=request("/v1.0/iot-03/devices/$device/status", token())
        val statuses=response.getJSONArray("result")
        for(i in 0 until statuses.length()) {
            val item=statuses.getJSONObject(i)
            if(item.optString("code")==code) {
                val value=item.opt("value")
                if(value is Number) return value.toDouble() / pref.getString("scale","1")!!.toDouble().takeIf { it > 0 }!!
                throw IllegalArgumentException("El dato $code no es numérico")
            }
        }
        throw IllegalArgumentException("No se encuentra el código '$code'. Verifica el código de potencia en Tuya")
    }
}
