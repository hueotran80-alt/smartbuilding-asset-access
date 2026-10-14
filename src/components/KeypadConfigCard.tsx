import { useEffect, useState } from "react";
import { KeyRound, RefreshCw, Save } from "lucide-react";
import {
  getKeypadConfig,
  updateKeypadConfig,
  type KeypadConfig,
} from "../lib/keypadConfigService";

type Props = {
  deviceOnline: boolean;
};

export default function KeypadConfigCard({
  deviceOnline,
}: Props) {
  const [config, setConfig] = useState<KeypadConfig | null>(null);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinLength, setPinLength] = useState(4);
  const [keypadEnabled, setKeypadEnabled] = useState(true);
  const [confirmKey, setConfirmKey] = useState("#");
  const [clearKey, setClearKey] = useState("*");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const next = await getKeypadConfig();
      setConfig(next);

      if (next) {
        setPinLength(next.pinLength);
        setKeypadEnabled(next.keypadEnabled);
        setConfirmKey(next.confirmKey);
        setClearKey(next.clearKey);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể tải cấu hình Keypad.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    setMessage(null);
    setError(null);

    if (!/^\d{4,8}$/.test(pin)) {
      setError("PIN mới phải gồm từ 4 đến 8 chữ số.");
      return;
    }

    if (pin !== pinConfirm) {
      setError("PIN xác nhận không trùng khớp.");
      return;
    }

    if (pin.length !== pinLength) {
      setError("Độ dài PIN không khớp.");
      return;
    }

    setSaving(true);

    try {
      const version = await updateKeypadConfig({
        pin,
        pinLength,
        keypadEnabled,
        confirmKey,
        clearKey,
      });

      setPin("");
      setPinConfirm("");

      const next = await getKeypadConfig();
      setConfig(next);

      setMessage(
        `Đã lưu PIN phiên bản ${version}. ${deviceOnline ? "ESP đang online và sẽ tự đồng bộ." : "ESP đang offline; cấu hình sẽ được đồng bộ khi thiết bị kết nối lại."}`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể cập nhật PIN.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="section-card keypad-config-card">
      <div className="section-head">
        <div>
          <h3>Cấu hình Keypad cửa chính</h3>
          <p>
            Thay PIN và cấu hình phím từ xa, không cần nạp lại firmware cho mỗi lần thay đổi.
          </p>
        </div>

        <button
          className="outline-button"
          type="button"
          onClick={() => void load()}
          disabled={loading || saving}
        >
          <RefreshCw size={14} />
          Làm mới
        </button>
      </div>

      <div className="keypad-config-body">
        <div className="keypad-meta-grid">
          <div className="state-item">
            <span>Thiết bị</span>
            <b>ESP-MAIN-DOOR</b>
          </div>
          <div className="state-item">
            <span>ESP</span>
            <b className={deviceOnline ? "green" : "red"}>
              {deviceOnline ? "Online" : "Offline"}
            </b>
          </div>
          <div className="state-item">
            <span>Phiên bản PIN</span>
            <b>{config?.pinVersion ?? "—"}</b>
          </div>
          <div className="state-item">
            <span>Đã áp dụng trên ESP</span>
            <b>
              {config?.appliedVersion ?? 0}
            </b>
          </div>
        </div>

        <div className="keypad-config-grid">
          <label>
            PIN mới
            <input
              value={pin}
              onChange={(event) =>
                setPin(event.target.value.replace(/\D/g, "").slice(0, 8))
              }
              inputMode="numeric"
              autoComplete="new-password"
              type="password"
              placeholder="Nhập PIN mới"
              disabled={saving}
            />
          </label>

          <label>
            Xác nhận PIN
            <input
              value={pinConfirm}
              onChange={(event) =>
                setPinConfirm(
                  event.target.value.replace(/\D/g, "").slice(0, 8),
                )
              }
              inputMode="numeric"
              autoComplete="new-password"
              type="password"
              placeholder="Nhập lại PIN"
              disabled={saving}
            />
          </label>

          <label>
            Độ dài PIN
            <select
              value={pinLength}
              onChange={(event) =>
                setPinLength(Number(event.target.value))
              }
              disabled={saving}
            >
              {[4, 5, 6, 7, 8].map((length) => (
                <option key={length} value={length}>
                  {length} số
                </option>
              ))}
            </select>
          </label>

          <label>
            Phím xác nhận
            <select
              value={confirmKey}
              onChange={(event) => setConfirmKey(event.target.value)}
              disabled={saving}
            >
              {["#", "*", "A", "B", "C", "D"].map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </label>

          <label>
            Phím xóa
            <select
              value={clearKey}
              onChange={(event) => setClearKey(event.target.value)}
              disabled={saving}
            >
              {["*", "#", "A", "B", "C", "D"].map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </label>

          <label className="keypad-toggle">
            <span>Keypad vật lý</span>
            <button
              type="button"
              className={
                keypadEnabled
                  ? "toggle-button active"
                  : "toggle-button"
              }
              onClick={() => setKeypadEnabled((value) => !value)}
              disabled={saving}
              aria-pressed={keypadEnabled}
            >
              <span />
              {keypadEnabled ? "Đang bật" : "Đang tắt"}
            </button>
          </label>
        </div>

        {message && (
          <div className="info-box keypad-message">
            <KeyRound size={16} />
            <div>
              <b>{message}</b>
              <span>
                ESP chỉ nhận cấu hình có phiên bản mới hơn phiên bản đã lưu.
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="info-box keypad-error">
            <KeyRound size={16} />
            <div>
              <b>Không thể cập nhật</b>
              <span>{error}</span>
            </div>
          </div>
        )}

        <div className="keypad-actions">
          <small>
            PIN được băm SHA-256 trước khi gửi lên máy chủ; cơ sở dữ liệu không lưu PIN dạng chữ.
          </small>
          <button
            className="primary-button"
            type="button"
            onClick={() => void save()}
            disabled={saving || loading || !pin}
          >
            <Save size={15} />
            {saving ? "Đang lưu..." : "Cập nhật Keypad"}
          </button>
        </div>
      </div>
    </div>
  );
}

