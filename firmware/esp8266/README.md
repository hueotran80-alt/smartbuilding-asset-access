# ESP8266 firmware (safe example)

`main/main.example.ino` is the version intended for source control. It contains no real Wi-Fi passwords and does not ship with a default keypad PIN.

## Prepare local firmware

1. Copy `main/main.example.ino` to `main/main.ino`.
2. Fill the local Wi-Fi SSIDs and passwords in `main.ino`. Keep that file local; it is excluded by the repository `.gitignore`.
3. Provision the device and configure a PIN through the Admin flow before using the keypad. Do not hardcode a real PIN or its known hash into a public source tree.
4. Verify relay polarity, reed ADC threshold and wiring against the exact board before reconnecting lock power.

`main.ino` is intentionally not tracked because local copies may contain Wi-Fi credentials or deployment-specific configuration.
