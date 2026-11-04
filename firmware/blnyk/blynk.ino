#define BLYNK_TEMPLATE_ID "TMPL6jctJzQTH"
#define BLYNK_TEMPLATE_NAME "Quickstart Template"
#define BLYNK_AUTH_TOKEN "qUQqBhtMPL1HHru6DpO25c05vUpGo0Vc"

#define BLYNK_PRINT Serial

#include <ESP8266WiFi.h>
#include <BlynkSimpleEsp8266.h>

char auth[] = BLYNK_AUTH_TOKEN;
char ssid[] = "TOTOLINK_N200RE";
char pass[] = "12344321";

BlynkTimer timer;

// Gunakan GPIO yang aman untuk relay (hindari D3 & D4 jika boot bermasalah)
#define LAMPU_1 5   // D1
#define LAMPU_2 4   // D2
#define LAMPU_3 0   // D3
#define LAMPU_4 2   // D4

// ===================== BLYNK CONTROL =====================

// Lampu 1 → V0
BLYNK_WRITE(V0)
{
  int value = param.asInt();
  if (value == 1) {
    digitalWrite(LAMPU_1, LOW);   // Relay ON (aktif LOW)
    Serial.println("Lampu 1: ON");
  } else {
    digitalWrite(LAMPU_1, HIGH);  // Relay OFF
    Serial.println("Lampu 1: OFF");
  }
}

// Lampu 2 → V4
BLYNK_WRITE(V4)
{
  int value = param.asInt();
  if (value == 1) {
    digitalWrite(LAMPU_2, LOW);
    Serial.println("Lampu 2: ON");
  } else {
    digitalWrite(LAMPU_2, HIGH);
    Serial.println("Lampu 2: OFF");
  }
}

// Lampu 3 → V5
BLYNK_WRITE(V5)
{
  int value = param.asInt();
  if (value == 1) {
    digitalWrite(LAMPU_3, LOW);
    Serial.println("Lampu 3: ON");
  } else {
    digitalWrite(LAMPU_3, HIGH);
    Serial.println("Lampu 3: OFF");
  }
}

// Lampu 4 → V6
BLYNK_WRITE(V6)
{
  int value = param.asInt();
  if (value == 1) {
    digitalWrite(LAMPU_4, LOW);
    Serial.println("Lampu 4: ON");
  } else {
    digitalWrite(LAMPU_4, HIGH);
    Serial.println("Lampu 4: OFF");
  }
}

// ===================== SETUP =====================
void setup()
{
  Serial.begin(115200);

  // Set pin relay sebagai OUTPUT
  pinMode(LAMPU_1, OUTPUT);
  pinMode(LAMPU_2, OUTPUT);
  pinMode(LAMPU_3, OUTPUT);
  pinMode(LAMPU_4, OUTPUT);

  // KONDISI AWAL: SEMUA LAMPU MATI (relay OFF)
  // Relay aktif LOW → HIGH = OFF
  digitalWrite(LAMPU_1, HIGH);
  digitalWrite(LAMPU_2, HIGH);
  digitalWrite(LAMPU_3, HIGH);
  digitalWrite(LAMPU_4, HIGH);

  // Koneksi ke Blynk
  Blynk.begin(auth, ssid, pass);
}

// ===================== LOOP =====================
void loop()
{
  Blynk.run();
  timer.run();
}