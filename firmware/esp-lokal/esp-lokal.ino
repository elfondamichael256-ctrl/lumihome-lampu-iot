// Kontrol 4 lampu via WiFi lokal - ESP32
// Untuk ESP8266: ganti <WiFi.h> -> <ESP8266WiFi.h> dan <WebServer.h> -> <ESP8266WebServer.h>
//                (class WebServer -> ESP8266WebServer), lalu sesuaikan nomor pin.
#include <WiFi.h>
#include <WebServer.h>

const char* WIFI_SSID = "NAMA_WIFI";
const char* WIFI_PASS = "PASSWORD_WIFI";

const int RELAY_PIN[4] = {16, 17, 18, 19};
const bool RELAY_ACTIVE_LOW = true;   // ubah ke false jika modul relay aktif-HIGH

bool lampState[4] = {false, false, false, false};
WebServer server(80);

void applyRelay(int i) {
  bool level = RELAY_ACTIVE_LOW ? !lampState[i] : lampState[i];
  digitalWrite(RELAY_PIN[i], level ? HIGH : LOW);
}

void addCors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
}

// GET /set?ch=1&state=1   (ch: 1-4, state: 0/1)
void handleSet() {
  addCors();
  if (!server.hasArg("ch") || !server.hasArg("state")) {
    server.send(400, "text/plain", "parameter ch dan state wajib");
    return;
  }
  int ch = server.arg("ch").toInt();
  int st = server.arg("state").toInt();
  if (ch < 1 || ch > 4) {
    server.send(400, "text/plain", "ch harus 1-4");
    return;
  }
  lampState[ch - 1] = (st == 1);
  applyRelay(ch - 1);
  server.send(200, "text/plain", "ok");
}

// GET /status  ->  {"1":0,"2":1,"3":0,"4":0}
void handleStatus() {
  addCors();
  String json = "{";
  for (int i = 0; i < 4; i++) {
    json += "\"" + String(i + 1) + "\":" + (lampState[i] ? "1" : "0");
    if (i < 3) json += ",";
  }
  json += "}";
  server.send(200, "application/json", json);
}

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < 4; i++) {
    pinMode(RELAY_PIN[i], OUTPUT);
    applyRelay(i);                    // semua lampu mati saat boot
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Menyambung WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.print("\nIP ESP: ");
  Serial.println(WiFi.localIP());     // isi alamat ini di Pengaturan dashboard

  server.on("/set", handleSet);
  server.on("/status", handleStatus);
  server.begin();
}

void loop() {
  server.handleClient();
  if (WiFi.status() != WL_CONNECTED) {  // sambung ulang jika WiFi putus
    WiFi.reconnect();
    delay(2000);
  }
}
