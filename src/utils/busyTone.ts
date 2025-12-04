// Генерация звука "занято" с помощью Web Audio API
let audioContext: AudioContext | null = null;
let isPlaying = false;

export const playBusyTone = () => {
  if (isPlaying) return;
  
  try {
    // Создаём AudioContext
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    isPlaying = true;
    
    const duration = 0.5; // Длительность каждого гудка
    const pauseDuration = 0.5; // Пауза между гудками
    const frequency = 480; // Частота гудка (Hz)
    const totalBeeps = 3; // Количество гудков
    
    let currentTime = audioContext.currentTime;
    
    for (let i = 0; i < totalBeeps; i++) {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, currentTime);
      
      // Установка громкости с плавным затуханием
      gainNode.gain.setValueAtTime(0.3, currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + duration);
      
      oscillator.start(currentTime);
      oscillator.stop(currentTime + duration);
      
      currentTime += duration + pauseDuration;
    }
    
    // Останавливаем воспроизведение после всех гудков
    setTimeout(() => {
      isPlaying = false;
      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }
    }, (duration + pauseDuration) * totalBeeps * 1000);
    
  } catch (error) {
    console.error('[BusyTone] Failed to play busy tone:', error);
    isPlaying = false;
  }
};

export const stopBusyTone = () => {
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  isPlaying = false;
};
