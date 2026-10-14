const SOUND_FILES = {
  fingerprintFailed: "/assets/sounds/fingerprint_failed.mp3",
  passwordFailed: "/assets/sounds/password_failed.mp3",
  authSuccess: "/assets/sounds/auth_success.mp3",
  doorOpened: "/assets/sounds/door_opened.mp3",
  doorAlarm: "/assets/sounds/door_alarm.mp3",
} as const;

type SoundType = keyof typeof SOUND_FILES;

let audioContext: AudioContext | null = null;
let audioUnlocked = false;
let alarmTimer: number | null = null;
const bufferCache = new Map<string, AudioBuffer>();
const loadingCache = new Map<string, Promise<AudioBuffer>>();

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (!audioContext) {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;

    if (!AudioContextClass) return null;
    audioContext = new AudioContextClass();
  }

  return audioContext;
}

async function loadBuffer(path: string): Promise<AudioBuffer> {
  const cached = bufferCache.get(path);
  if (cached) return cached;

  const loading = loadingCache.get(path);
  if (loading) return loading;

  const promise = fetch(path)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} while loading ${path}`);
      }
      return response.arrayBuffer();
    })
    .then((data) => {
      const context = getAudioContext();
      if (!context) throw new Error("Web Audio API is unavailable");
      return context.decodeAudioData(data);
    })
    .then((buffer) => {
      bufferCache.set(path, buffer);
      loadingCache.delete(path);
      return buffer;
    })
    .catch((error) => {
      loadingCache.delete(path);
      throw error;
    });

  loadingCache.set(path, promise);
  return promise;
}

export function unlockSounds(): void {
  const context = getAudioContext();
  if (!context) return;

  audioUnlocked = true;

  if (context.state === "suspended") {
    void context.resume().catch((error) => {
      audioUnlocked = false;
      console.warn("Không thể mở khóa audio:", error);
    });
  }
}

export function playSound(type: SoundType): void {
  const context = getAudioContext();
  if (!context) {
    console.warn("Web Audio API không khả dụng:", type);
    return;
  }

  if (context.state === "suspended") {
    void context.resume().then(() => playSound(type)).catch((error) => {
      console.warn("Không thể resume audio:", type, error);
    });
    return;
  }

  audioUnlocked = true;

  void loadBuffer(SOUND_FILES[type])
    .then((buffer) => {
      if (!audioContext || audioContext.state !== "running") return;

      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start(0);
    })
    .catch((error) => {
      console.warn("Không thể phát âm thanh:", type, error);
    });
}

function playAlarmPulse(): void {
  const context = getAudioContext();
  if (!context || context.state !== "running") return;

  void loadBuffer(SOUND_FILES.doorAlarm)
    .then((buffer) => {
      if (!audioContext || audioContext.state !== "running") return;

      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);

      // Chỉ lên lịch lần kế tiếp sau khi file cảnh báo hiện tại phát xong.
      source.onended = () => {
        if (alarmTimer === null) return;
        alarmTimer = window.setTimeout(() => {
          alarmTimer = null;
          playAlarmPulse();
        }, 0);
      };

      source.start(0);
    })
    .catch((error) => {
      console.warn("Không thể phát âm thanh cảnh báo:", error);
    });
}

export function startAlarm(): void {
  const context = getAudioContext();
  if (!context) return;

  if (context.state === "suspended") {
    void context.resume().then(() => startAlarm()).catch((error) => {
      console.warn("Không thể bật báo động:", error);
    });
    return;
  }

  audioUnlocked = true;

  if (alarmTimer !== null) return;

  alarmTimer = -1;
  playAlarmPulse();
}

export function stopAlarm(): void {
  if (alarmTimer !== null) {
    window.clearTimeout(alarmTimer);
    alarmTimer = null;
  }
}

export function preloadSounds(): void {
  Object.values(SOUND_FILES).forEach((path) => {
    void loadBuffer(path).catch((error) => {
      console.warn("Không thể preload âm thanh:", path, error);
    });
  });
}
