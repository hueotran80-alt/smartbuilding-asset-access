#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <bearssl/bearssl_hash.h>

// =====================================================
// SMART BUILDING ACCESS - ESP8266 + TCA9555/PCA9555
// Hardware map:
//   Relay: D0 (GPIO16), active-LOW relay module assumed: LOW = release latch, HIGH = lock
//   Reed output: A0 (ADC), assumed low ADC value = door closed
//   I2C: SDA D2, SCL D1
//   Keypad 4x4: TCA9555 P00-P07
//   Buzzer control: D5 (GPIO14), use a suitable transistor/MOSFET
//                   driver for a 5V buzzer; do not power buzzer from GPIO.
// IMPORTANT: verify relay active level before reconnecting lock power. This
// file defaults to active-LOW relay because relay modules commonly use that.
// Reed output on A0 is read with analogRead(); threshold may need calibration.
// A0 voltage limit depends on board: NodeMCU dev boards commonly accept up to ~3.3V;
// bare ESP8266 ADC input is limited to 1.0V. Verify your exact board before wiring.
// =====================================================

// ---------- Wi-Fi fallback ----------
const char* wifiSsid[3] = {"WIFI_SSID_1", "WIFI_SSID_2", "WIFI_SSID_3"};
const char* wifiPassword[3] = {"REPLACE_WITH_WIFI_PASSWORD_1", "REPLACE_WITH_WIFI_PASSWORD_2", "REPLACE_WITH_WIFI_PASSWORD_3"};

// ---------- MQTT ----------
const char* mqtt_server = "test.mosquitto.org";
const int mqtt_port = 1883;
const char* topic_cmd = "smartbuilding/door/command";
const char* topic_state = "smartbuilding/door/state";
const char* topic_heartbeat = "smartbuilding/door/heartbeat";
const char* topic_event = "smartbuilding/door/event";
const char* topic_config = "smartbuilding/door/config/ESP-MAIN-DOOR/17d657b03d77019043a490dd";

// ---------- ESP8266 pins ----------
const uint8_t RELAY_PIN = D0;
// A0 is the ESP8266 ADC input, not a normal digital GPIO.
const int REED_ADC_THRESHOLD = 512; // 0..1023; adjust after checking Serial Monitor readings
const uint8_t BUZZER_PIN = D5;

// IMPORTANT: this version assumes a common ACTIVE-LOW relay module.
// If your relay module is active-HIGH, swap RELAY_UNLOCK_LEVEL and RELAY_LOCK_LEVEL.
const uint8_t RELAY_UNLOCK_LEVEL = LOW;
const uint8_t RELAY_LOCK_LEVEL   = HIGH;

// Reed analog assumption: ADC below threshold = door closed.
// If readings show the opposite, set REED_CLOSED_BELOW_THRESHOLD to false.
const bool REED_CLOSED_BELOW_THRESHOLD = true;

// ---------- I2C / TCA9555 ----------
const uint8_t TCA9555_ADDR = 0x20; // Common default; address pins A0-A2 LOW. Change if your module differs.
const uint8_t REG_INPUT0  = 0x00;
const uint8_t REG_INPUT1  = 0x01;
const uint8_t REG_OUTPUT0 = 0x02;
const uint8_t REG_OUTPUT1 = 0x03;
const uint8_t REG_POLARITY0 = 0x04;
const uint8_t REG_POLARITY1 = 0x05;
const uint8_t REG_CONFIG0 = 0x06;
const uint8_t REG_CONFIG1 = 0x07;

// Keypad uses P00-P03 as rows and P04-P07 as columns.
// TCA9555 has no internal GPIO pull-ups. Add 4.7k-10k pull-up resistors
// from P04, P05, P06, P07 to 3.3V unless your keypad/module already provides them.
const byte ROWS = 4;
const byte COLS = 4;
const char keys[ROWS][COLS] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};

// ---------- Timing ----------
const unsigned long UNLOCK_DURATION_MS = 3000;
const unsigned long HEARTBEAT_INTERVAL_MS = 5000;
const unsigned long MQTT_RECONNECT_INTERVAL_MS = 5000;
const unsigned long DOOR_DEBOUNCE_MS = 100;
const unsigned long KEYPAD_SCAN_INTERVAL_MS = 20;
const unsigned long BUZZER_BEEP_MS = 120;
const unsigned long DOOR_OPEN_ALARM_DELAY_MS = 10000;
const unsigned long DOOR_ALARM_REPEAT_MS = 1800;

WiFiClient espClient;
PubSubClient client(espClient);

unsigned long unlockStartTime = 0;
unsigned long lastMqttReconnectAttempt = 0;
unsigned long lastHeartbeat = 0;
unsigned long lastKeypadScan = 0;
unsigned long buzzerOffAt = 0;
bool isUnlocked = false;
bool doorClosedStable = true;
bool doorClosedLastRaw = true;
unsigned long doorSensorChangedAt = 0;
String inputPin = "";
char lastKey = 0;
bool keypadReady = false;
bool buzzerActive = false;
unsigned long doorOpenedAt = 0;
unsigned long lastDoorAlarmBeepAt = 0;

// No default keypad PIN is shipped in this example.
// Set the PIN from the Admin app after provisioning the device.
String keypadPinHash = "";
int keypadPinLength = 6;
bool keypadEnabled = true;
char keypadConfirmKey = '#';
char keypadClearKey = '*';
uint32_t keypadConfigVersion = 0;

// ---------- TCA9555 low-level I2C ----------
bool tcaWriteRegister(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(TCA9555_ADDR);
  Wire.write(reg);
  Wire.write(value);
  return Wire.endTransmission() == 0;
}

bool tcaReadRegister(uint8_t reg, uint8_t &value) {
  Wire.beginTransmission(TCA9555_ADDR);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom((int)TCA9555_ADDR, 1) != 1) return false;
  value = Wire.read();
  return true;
}

bool initTCA9555() {
  // Disable polarity inversion. Port 0: P00-P03 outputs (rows), P04-P07 inputs (columns).
  // Port 1 remains inputs and is unused.
  if (!tcaWriteRegister(REG_POLARITY0, 0x00)) return false;
  if (!tcaWriteRegister(REG_POLARITY1, 0x00)) return false;
  if (!tcaWriteRegister(REG_OUTPUT0, 0xFF)) return false;
  if (!tcaWriteRegister(REG_OUTPUT1, 0xFF)) return false;
  if (!tcaWriteRegister(REG_CONFIG0, 0xF0)) return false;
  if (!tcaWriteRegister(REG_CONFIG1, 0xFF)) return false;
  return true;
}

char scanKeypadRaw() {
  if (!keypadReady) return 0;
  for (byte row = 0; row < ROWS; row++) {
    // Keep all row lines HIGH except the currently scanned row, which is LOW.
    uint8_t rowOutput = (uint8_t)(0x0F & ~(1 << row));
    uint8_t outputValue = (uint8_t)(0xF0 | rowOutput);
    if (!tcaWriteRegister(REG_OUTPUT0, outputValue)) return 0;
    delayMicroseconds(500);

    uint8_t inputValue = 0xFF;
    if (!tcaReadRegister(REG_INPUT0, inputValue)) return 0;
    for (byte col = 0; col < COLS; col++) {
      if ((inputValue & (1 << (col + 4))) == 0) {
        // Basic single-key scan. Multi-key combinations are not supported.
        tcaWriteRegister(REG_OUTPUT0, 0xFF);
        return keys[row][col];
      }
    }
  }
  tcaWriteRegister(REG_OUTPUT0, 0xFF);
  return 0;
}

char getKeypadKey() {
  if (millis() - lastKeypadScan < KEYPAD_SCAN_INTERVAL_MS) return 0;
  lastKeypadScan = millis();
  char key = scanKeypadRaw();
  if (key == lastKey) return 0;
  lastKey = key;
  return key; // Emits one character on press; emits 0 after release.
}

// ---------- Wi-Fi ----------
bool connectToConfiguredWiFi() {
  for (int i = 0; i < 3; i++) {
    if (wifiSsid[i][0] == '\0') continue;
    Serial.println();
    Serial.print("Trying WiFi "); Serial.print(i + 1); Serial.print(": "); Serial.println(wifiSsid[i]);
    WiFi.disconnect();
    WiFi.begin(wifiSsid[i], wifiPassword[i]);
    unsigned long startAttempt = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 10000) {
      delay(500); Serial.print('.');
    }
    Serial.println();
    if (WiFi.status() == WL_CONNECTED) {
      Serial.print("WiFi connected: "); Serial.println(WiFi.SSID());
      Serial.print("ESP IP: "); Serial.println(WiFi.localIP());
      return true;
    }
    Serial.print("WiFi "); Serial.print(i + 1); Serial.println(" failed.");
  }
  return false;
}

void setup_wifi() {
  Serial.println("Connecting to fallback Wi-Fi networks...");
  WiFi.mode(WIFI_STA);
  if (!connectToConfiguredWiFi()) Serial.println("No configured Wi-Fi connected.");
}

void ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.println("Wi-Fi disconnected; retrying...");
  WiFi.mode(WIFI_STA);
  connectToConfiguredWiFi();
}

// ---------- SHA-256 ----------
String sha256Hex(const String& value) {
  br_sha256_context ctx;
  uint8_t digest[32];
  br_sha256_init(&ctx);
  br_sha256_update(&ctx, value.c_str(), value.length());
  br_sha256_out(&ctx, digest);
  const char* hex = "0123456789abcdef";
  String result;
  result.reserve(64);
  for (int i = 0; i < 32; i++) {
    result += hex[(digest[i] >> 4) & 0x0F];
    result += hex[digest[i] & 0x0F];
  }
  return result;
}

// ---------- Buzzer ----------
// Active HIGH output to a transistor/MOSFET driver. Do not connect a 5V buzzer
// directly between a GPIO and GND; GPIO is a 3.3V signal and has a current limit.
void startBuzzerBeep(unsigned long durationMs = BUZZER_BEEP_MS, unsigned int frequencyHz = 2000) {
  // Use tone() so passive buzzers can sound; this is non-blocking on ESP8266.
  tone(BUZZER_PIN, frequencyHz);
  buzzerActive = true;
  buzzerOffAt = millis() + durationMs;
}

void updateBuzzer() {
  if (buzzerActive && (long)(millis() - buzzerOffAt) >= 0) {
    noTone(BUZZER_PIN);
    digitalWrite(BUZZER_PIN, LOW);
    buzzerActive = false;
  }
}

void updateDoorOpenAlarm() {
  // Reed sensor alone determines door state; relay state is not used here.
  if (doorClosedStable) {
    doorOpenedAt = 0;
    lastDoorAlarmBeepAt = 0;
    return;
  }

  const unsigned long now = millis();
  if (doorOpenedAt == 0) doorOpenedAt = now;
  if (now - doorOpenedAt < DOOR_OPEN_ALARM_DELAY_MS) return;

  // One short alarm tone every ~1.8 seconds while the door remains open.
  if (!buzzerActive && (lastDoorAlarmBeepAt == 0 || now - lastDoorAlarmBeepAt >= DOOR_ALARM_REPEAT_MS)) {
    startBuzzerBeep(350, 2400);
    lastDoorAlarmBeepAt = now;
  }
}

// ---------- MQTT event/state ----------
void publishEvent(const String& source, const String& result) {
  if (!client.connected()) return;
  String payload = "{\"source\":\"" + source + "\",\"result\":\"" + result + "\"}";
  client.publish(topic_event, payload.c_str());
  Serial.print("MQTT EVENT: "); Serial.println(payload);
}

void publishState() {
  if (!client.connected()) return;
  const char* state = isUnlocked ? "UNLOCKED" : "LOCKED";
  client.publish(topic_state, state);
  Serial.print("MQTT STATE: "); Serial.println(state);
}

void publishDoorSensorState() {
  if (!client.connected()) return;
  const char* state = doorClosedStable ? "DOOR_CLOSED" : "DOOR_OPEN";
  client.publish(topic_state, state);
  Serial.print("MQTT DOOR STATE: "); Serial.println(state);
}

void publishHeartbeat() {
  if (!client.connected()) return;
  client.publish(topic_heartbeat, "ESP-MAIN-DOOR");
  lastHeartbeat = millis();
  Serial.println("MQTT HEARTBEAT: ESP-MAIN-DOOR");
}

void reportWrongPin(const String& source) {
  if (client.connected()) client.publish(topic_state, "WRONG_PIN");
  publishEvent(source, "FAILED");
  startBuzzerBeep(250, 900);
}

void publishKeypadConfigAck(bool success) {
  if (!client.connected()) return;
  String payload = "{\"source\":\"Keypad Config\",\"version\":" + String(keypadConfigVersion) +
                   ",\"result\":\"" + (success ? "SUCCESS" : "FAILED") + "\"}";
  client.publish(topic_event, payload.c_str());
  Serial.print("MQTT KEYPAD CONFIG ACK: "); Serial.println(payload);
}

// CFG|version|pin_hash|pin_length|enabled|confirm_key|clear_key
void applyKeypadConfig(String message) {
  int positions[6];
  int from = 0;
  for (int i = 0; i < 6; i++) {
    positions[i] = message.indexOf('|', from);
    if (positions[i] < 0) {
      Serial.println("Invalid keypad config.");
      publishKeypadConfigAck(false);
      return;
    }
    from = positions[i] + 1;
  }
  uint32_t version = message.substring(positions[0] + 1, positions[1]).toInt();
  String hash = message.substring(positions[1] + 1, positions[2]);
  int length = message.substring(positions[2] + 1, positions[3]).toInt();
  String enabledText = message.substring(positions[3] + 1, positions[4]);
  String confirm = message.substring(positions[4] + 1, positions[5]);
  String clear = message.substring(positions[5] + 1);
  bool enabled = enabledText == "1" || enabledText.equalsIgnoreCase("true");

  if (version == 0 || hash.length() != 64 || length < 4 || length > 8 || confirm.length() != 1 || clear.length() != 1) {
    Serial.println("Keypad config rejected: invalid data.");
    publishKeypadConfigAck(false);
    return;
  }
  if (version < keypadConfigVersion) {
    Serial.println("Ignoring older keypad config.");
    return;
  }
  keypadPinHash = hash;
  keypadPinLength = length;
  keypadEnabled = enabled;
  keypadConfirmKey = confirm.charAt(0);
  keypadClearKey = clear.charAt(0);
  keypadConfigVersion = version;
  inputPin = "";
  Serial.println("Keypad config updated from Admin.");
  publishKeypadConfigAck(true);
}

// ---------- Reed sensor ----------
int readReedAdc() {
  return analogRead(A0);
}

bool readDoorClosedRaw() {
  const int adc = readReedAdc();
  return REED_CLOSED_BELOW_THRESHOLD ? (adc < REED_ADC_THRESHOLD) : (adc >= REED_ADC_THRESHOLD);
}

void updateDoorSensor() {
  const int adcValue = readReedAdc();
  const bool rawClosed = REED_CLOSED_BELOW_THRESHOLD ? (adcValue < REED_ADC_THRESHOLD) : (adcValue >= REED_ADC_THRESHOLD);
  static unsigned long lastReedDebug = 0;
  if (millis() - lastReedDebug >= 500) {
    lastReedDebug = millis();
    Serial.print("REED A0 ADC=");
    Serial.print(adcValue);
    Serial.print(" interpreted=");
    Serial.println(rawClosed ? "DOOR_CLOSED" : "DOOR_OPEN");
  }
  if (rawClosed != doorClosedLastRaw) {
    doorClosedLastRaw = rawClosed;
    doorSensorChangedAt = millis();
    return;
  }
  if (rawClosed != doorClosedStable && millis() - doorSensorChangedAt >= DOOR_DEBOUNCE_MS) {
    doorClosedStable = rawClosed;
    publishDoorSensorState();
    Serial.print("REED -> "); Serial.println(doorClosedStable ? "DOOR CLOSED" : "DOOR OPEN");
    if (!doorClosedStable) {
      doorOpenedAt = millis();
      lastDoorAlarmBeepAt = 0;
      startBuzzerBeep(120, 1500); // brief indication when door opens
    } else {
      doorOpenedAt = 0;
      lastDoorAlarmBeepAt = 0;
    }
  }
}

// ---------- Lock actuator ----------
void unlockDoor(String source) {
  digitalWrite(RELAY_PIN, RELAY_UNLOCK_LEVEL);
  isUnlocked = true;
  unlockStartTime = millis();
  Serial.println("RELAY RELEASE LATCH");
  Serial.print("Source: "); Serial.println(source);
  publishState();
  publishEvent(source, "SUCCESS");
}

void lockDoor() {
  digitalWrite(RELAY_PIN, RELAY_LOCK_LEVEL);
  isUnlocked = false;
  Serial.println("RELAY LOCKED");
  publishState();
}

// ---------- MQTT callback ----------
void callback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) message += (char)payload[i];
  Serial.print("MQTT ["); Serial.print(topic); Serial.print("]: "); Serial.println(message);

  if (String(topic) == topic_config && message.startsWith("CFG|")) {
    applyKeypadConfig(message);
    return;
  }
  if (String(topic) != topic_cmd) return;
  if (message == "UNLOCK") unlockDoor("MQTT Web");
  else if (message == "LOCK") lockDoor();
  else if (message == "WRONG") reportWrongPin("MQTT Web");
}

void reconnectMQTT() {
  if (millis() - lastMqttReconnectAttempt < MQTT_RECONNECT_INTERVAL_MS) return;
  lastMqttReconnectAttempt = millis();
  if (WiFi.status() != WL_CONNECTED) return;
  Serial.println("Connecting to MQTT broker...");
  String clientId = "ESP8266Client-" + String(ESP.getChipId(), HEX) + "-" + String(random(0xffff), HEX);
  if (client.connect(clientId.c_str())) {
    Serial.println("MQTT connected.");
    client.subscribe(topic_cmd);
    client.subscribe(topic_config);
    publishState();
    publishDoorSensorState();
    publishHeartbeat();
  } else {
    Serial.print("MQTT connection failed, rc="); Serial.println(client.state());
  }
}

void sendHeartbeat() {
  if (client.connected() && millis() - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) publishHeartbeat();
}

// ---------- Physical keypad ----------
void handleKeypadPhysical() {
  char key = getKeypadKey();
  if (!key || !keypadEnabled) return;
  Serial.print("Keypad pressed: "); Serial.println(key);

  if (key == keypadConfirmKey) {
    if (inputPin.length() != keypadPinLength) {
      Serial.println("PIN length is incorrect.");
      reportWrongPin("Keypad Vat Ly");
    } else if (sha256Hex(inputPin) == keypadPinHash) {
      unlockDoor("Keypad Vat Ly");
      startBuzzerBeep(120, 1900);
    } else {
      Serial.println("Incorrect keypad PIN.");
      reportWrongPin("Keypad Vat Ly");
    }
    inputPin = "";
    return;
  }
  if (key == keypadClearKey) {
    inputPin = "";
    Serial.println("PIN cleared.");
    return;
  }
  if (key >= '0' && key <= '9' && inputPin.length() < keypadPinLength) {
    inputPin += key;
    Serial.print("PIN entered: ");
    for (unsigned int i = 0; i < inputPin.length(); i++) Serial.print('*');
    Serial.println();
  }
}

// ---------- Setup / loop ----------
void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println();
  Serial.println("SMART BUILDING ACCESS - ESP8266 (REED ON A0)");
  Serial.println("Relay assumption: ACTIVE-LOW; LOW=unlock pulse, HIGH=lock.");
  Serial.println("Reed on A0: ADC below threshold=door closed (default threshold 512).");

  // Preload the LOCK level before setting OUTPUT to reduce relay glitches at startup.
  digitalWrite(RELAY_PIN, RELAY_LOCK_LEVEL);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_LOCK_LEVEL);
  isUnlocked = false;

  // A0 is analog input; do not use pinMode(INPUT_PULLUP) for it.
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  Wire.begin(D2, D1); // SDA, SCL
  Wire.setClock(100000);
  delay(20);
  keypadReady = initTCA9555();
  if (keypadReady) {
    Serial.println("TCA9555 found/configured for keypad.");
  } else {
    Serial.println("ERROR: TCA9555 not responding. Check address, power, SDA/SCL.");
  }

  doorClosedStable = readDoorClosedRaw();
  doorClosedLastRaw = doorClosedStable;
  doorSensorChangedAt = millis();
  Serial.print("REED initial A0 ADC: ");
  Serial.println(readReedAdc());
  Serial.print("REED initial interpreted state: ");
  Serial.println(doorClosedStable ? "DOOR_CLOSED" : "DOOR_OPEN");

  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  Serial.println("Buzzer tone mode: success=1900Hz, wrong PIN=900Hz, door-open alarm after 10s=2400Hz.");
  Serial.println("ESP8266 ready.");
}

void loop() {
  ensureWiFi();
  if (!client.connected()) reconnectMQTT();
  else client.loop();

  sendHeartbeat();
  updateDoorSensor();
  handleKeypadPhysical();
  updateBuzzer();
  updateDoorOpenAlarm();

  if (isUnlocked && millis() - unlockStartTime >= UNLOCK_DURATION_MS) lockDoor();
  delay(2);
}
