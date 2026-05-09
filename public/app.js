document.addEventListener('DOMContentLoaded', () => {
    // --- Custom Alert System ---
    window.alert = function(message, type = 'error') {
        let container = document.getElementById('game-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'game-toast-container';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = `game-toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    function printConsole(msg, type = 'error') {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            const msgDiv = document.createElement('div');
            msgDiv.className = 'chat-msg';
            const color = type === 'error' ? '#ff3b30' : '#0a84ff';
            msgDiv.innerHTML = `<span class="chat-msg-emoji">💻</span> <span class="chat-msg-user" style="color: ${color}">Sunucu:</span> <span class="chat-msg-text" style="color: ${color}; font-weight: bold;">${msg}</span>`;
            chatMessages.appendChild(msgDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    // --- UI Elements ---
    const screens = {
        auth: document.getElementById('auth-screen'),
        lobby: document.getElementById('lobby-screen'),
        game: document.getElementById('game-screen')
    };

    const buttons = {
        login: document.getElementById('btn-login'),
        register: document.getElementById('btn-register'),
        start: document.getElementById('btn-start'),
        backToLobby: document.getElementById('btn-back-lobby'),
        submitLogin: document.getElementById('submit-login'),
        submitRegister: document.getElementById('submit-register'),
        submitVerify: document.getElementById('submit-verify')
    };

    const uiElements = {
        username: document.getElementById('player-username'),
        score: document.getElementById('score-counter'),
        energy: document.getElementById('energy-val'),
        energyTimer: document.getElementById('energy-timer'),
        coins: document.getElementById('coin-val'),
        profileModal: document.getElementById('profile-modal'),
        playerId: document.getElementById('player-id-val'),
        profileStats: {
            totalArea: document.getElementById('stat-total-area'),
            totalKills: document.getElementById('stat-total-kills'),
            totalCoins: document.getElementById('stat-total-coins'),
            profileName: document.getElementById('profile-name')
        },
        coordDisplay: document.getElementById('coord-display')
    };

    // --- Game Settings ---
    const defaultSettings = {
        masterSound: true,
        music: true,
        sfx: true,
        vfx: true,
        musicVolume: 1.0,
        sfxVolume: 1.0
    };

    // Ayarları localStorage'dan yükle
    const savedSettings = localStorage.getItem('turkiye_fethi_settings');
    window.gameSettings = savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;

    function saveSettings() {
        localStorage.setItem('turkiye_fethi_settings', JSON.stringify(window.gameSettings));
    }

    function syncSettingsUI() {
        const masterSoundToggle = document.getElementById('toggle-master-sound');
        const musicToggle = document.getElementById('toggle-music');
        const sfxToggle = document.getElementById('toggle-sfx');
        const vfxToggle = document.getElementById('toggle-vfx');
        const musicVolumeSlider = document.getElementById('volume-music');
        const sfxVolumeSlider = document.getElementById('volume-sfx');

        if (masterSoundToggle) masterSoundToggle.checked = window.gameSettings.masterSound;
        if (musicToggle) musicToggle.checked = window.gameSettings.music;
        if (sfxToggle) sfxToggle.checked = window.gameSettings.sfx;
        if (vfxToggle) vfxToggle.checked = window.gameSettings.vfx;
        if (musicVolumeSlider) musicVolumeSlider.value = window.gameSettings.musicVolume * 100;
        if (sfxVolumeSlider) sfxVolumeSlider.value = window.gameSettings.sfxVolume * 100;
    }

    // İlk açılışta UI'ı güncelle
    syncSettingsUI();

    /* ==============================
       Premium Sound Manager (Web Audio)
       ============================== */
    const SoundManager = (() => {
        let audioCtx = null;
        
        const init = () => {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
        };

        const playSynthesizedSound = (params) => {
            if (!window.gameSettings.masterSound || !window.gameSettings.sfx) return;
            try {
                init();
                if (audioCtx.state === 'suspended') audioCtx.resume();

                const { freq, type = 'sine', duration = 0.1, volume = 0.2, ramp = false, endFreq = 0 } = params;
                
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                
                oscillator.type = type;
                oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
                
                if (ramp && endFreq > 0) {
                    oscillator.frequency.exponentialRampToValueAtTime(endFreq, audioCtx.currentTime + duration);
                }

                // ADSR-like Volume Envelope
                const finalVolume = volume * window.gameSettings.sfxVolume;
                gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
                gainNode.gain.linearRampToValueAtTime(finalVolume, audioCtx.currentTime + 0.01);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

                oscillator.connect(gainNode).connect(audioCtx.destination);
                
                oscillator.start();
                oscillator.stop(audioCtx.currentTime + duration);
            } catch (e) {
                console.warn("Ses sentezlenemedi:", e);
            }
        };

        let isBgmPlaying = false;
        const startBGM = () => {
            if (!window.gameSettings.masterSound || !window.gameSettings.music) return;
            if (isBgmPlaying) return;
            try {
                init();
                if (audioCtx.state === 'suspended') audioCtx.resume();
                
                isBgmPlaying = true;
                let step = 0;
                const bpm = 130;
                const stepTime = (60 / bpm) / 2; // 8th notes
                let nextNoteTime = audioCtx.currentTime + 0.1;

                // Happy Arcade 4-Chord Arpeggio (C, C, F, G)
                const melody = [
                    261.63, 329.63, 392.00, 523.25, // C E G C
                    523.25, 392.00, 329.63, 261.63, // C G E C
                    349.23, 440.00, 523.25, 698.46, // F A C F
                    392.00, 493.88, 587.33, 783.99  // G B D G
                ];

                // Bouncy Bass (C3, F3, G3)
                const bass = [
                    130.81, null, 130.81, null,
                    130.81, null, 130.81, null,
                    174.61, null, 174.61, null,
                    196.00, null, 196.00, null
                ];

                const scheduleNote = () => {
                    if (!isBgmPlaying || !window.gameSettings.masterSound || !window.gameSettings.music) {
                        isBgmPlaying = false;
                        return;
                    }
                    
                    while (nextNoteTime < audioCtx.currentTime + 0.1) {
                        // Melody
                        if (melody[step]) {
                            const osc = audioCtx.createOscillator();
                            const gain = audioCtx.createGain();
                            osc.type = 'triangle';
                            osc.frequency.value = melody[step];
                            
                            const maxGain = 0.04 * window.gameSettings.musicVolume;
                            gain.gain.setValueAtTime(0, nextNoteTime);
                            gain.gain.linearRampToValueAtTime(maxGain, nextNoteTime + 0.01);
                            gain.gain.exponentialRampToValueAtTime(0.001, nextNoteTime + stepTime - 0.01);
                            
                            osc.connect(gain).connect(audioCtx.destination);
                            osc.start(nextNoteTime);
                            osc.stop(nextNoteTime + stepTime);
                        }

                        // Bass
                        if (bass[step]) {
                            const oscB = audioCtx.createOscillator();
                            const gainB = audioCtx.createGain();
                            oscB.type = 'square';
                            oscB.frequency.value = bass[step];
                            
                            const maxGainB = 0.02 * window.gameSettings.musicVolume;
                            gainB.gain.setValueAtTime(0, nextNoteTime);
                            gainB.gain.linearRampToValueAtTime(maxGainB, nextNoteTime + 0.01);
                            gainB.gain.exponentialRampToValueAtTime(0.001, nextNoteTime + stepTime - 0.01);
                            
                            const filter = audioCtx.createBiquadFilter();
                            filter.type = 'lowpass';
                            filter.frequency.value = 350;
                            
                            oscB.connect(filter).connect(gainB).connect(audioCtx.destination);
                            oscB.start(nextNoteTime);
                            oscB.stop(nextNoteTime + stepTime);
                        }
                        
                        step = (step + 1) % 16;
                        nextNoteTime += stepTime;
                    }
                    setTimeout(scheduleNote, 25);
                };
                
                scheduleNote();
            } catch (e) {
                console.warn("BGM başlatılamadı:", e);
            }
        };

        return {
            startBGM,
            click: () => playSynthesizedSound({ freq: 600, type: 'triangle', duration: 0.08, volume: 0.15, ramp: true, endFreq: 400 }),
            success: () => {
                playSynthesizedSound({ freq: 523.25, type: 'sine', duration: 0.15, volume: 0.2 }); // C5
                setTimeout(() => playSynthesizedSound({ freq: 659.25, type: 'sine', duration: 0.3, volume: 0.2 }), 100); // E5
            },
            fail: () => {
                playSynthesizedSound({ freq: 220, type: 'sawtooth', duration: 0.2, volume: 0.1, ramp: true, endFreq: 110 });
            },
            energyLoss: () => {
                playSynthesizedSound({ freq: 300, type: 'square', duration: 0.1, volume: 0.05 });
                setTimeout(() => playSynthesizedSound({ freq: 200, type: 'square', duration: 0.2, volume: 0.05 }), 50);
            },
            conquest: () => {
                const notes = [523.25, 659.25, 783.99, 1046.50]; // C-E-G-C Arpeggio
                notes.forEach((f, i) => {
                    setTimeout(() => playSynthesizedSound({ freq: f, type: 'sine', duration: 0.4, volume: 0.15 }), i * 100);
                });
            }
        };
    })();


    console.log("Uygulama başlatıldı, butonlar bağlandı.");

    /* ==============================
       VFX Manager (Visual Feedback)
       ============================== */
    const VFXManager = (() => {
        return {
            shake: (element = document.body) => {
                if (!window.gameSettings.vfx) return;
                if (!element) return;
                element.classList.remove('vfx-shake');
                void element.offsetWidth; // Trigger reflow
                element.classList.add('vfx-shake');
                setTimeout(() => element.classList.remove('vfx-shake'), 400);
            },
            pulse: (element, color = 'rgba(255, 255, 255, 0.5)') => {
                if (!window.gameSettings.vfx) return;
                if (!element) return;
                element.style.transition = 'box-shadow 0.2s ease-out, transform 0.1s ease-out';
                element.style.boxShadow = `0 0 25px ${color}`;
                element.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    element.style.boxShadow = '';
                    element.style.transform = '';
                }, 200);
            },
            flash: () => {
                if (!window.gameSettings.vfx) return;
                const flashDiv = document.createElement('div');
                flashDiv.className = 'vfx-flash';
                document.body.appendChild(flashDiv);
                setTimeout(() => flashDiv.remove(), 700);
            }
        };
    })();


    // --- Minigame System (Hafıza) ---
    const minigame = {
        modal: document.getElementById('minigame-modal'),

        timerEl: document.getElementById('minigame-timer'),
        msgEl: document.getElementById('minigame-msg'),
        displayEl: document.getElementById('minigame-display'),
        buttonsContainer: document.getElementById('minigame-buttons'),
        progressEl: document.getElementById('minigame-progress'),
        buttons: document.querySelectorAll('.color-btn'),
        isActive: false,
        colors: ['#ff3b30', '#0a84ff', '#34c759', '#ffcc00'], // 4 renk
        sequence: [],
        playerSequence: [],
        timeLeft: 5.0,
        timerInterval: null,
        displayInterval: null,
        onSuccess: null,
        onFail: null
    };

    minigame.buttons.forEach((btn, index) => {
        btn.addEventListener('click', () => {
            if (!minigame.isActive || minigame.buttonsContainer.style.pointerEvents === 'none') return;
            
            const selectedColor = minigame.colors[index];
            minigame.playerSequence.push(selectedColor);
            minigame.progressEl.textContent = `${minigame.playerSequence.length} / 4`;
            
            SoundManager.click();
            VFXManager.pulse(btn, selectedColor);
            
            // Eğer yanlış renk seçildiyse oyunu anında kaybet
            const currentStep = minigame.playerSequence.length - 1;
            if (minigame.playerSequence[currentStep] !== minigame.sequence[currentStep]) {
                endMinigame(false);
                return;
            }

            // Eğer hepsini doğru bildiyse kazan
            if (minigame.playerSequence.length === minigame.sequence.length) {
                endMinigame(true);
            }
        });
    });

    function startMinigame(onSuccess, onFail) {
        if (minigame.isActive) return;
        minigame.isActive = true;
        minigame.sequence = [];
        minigame.playerSequence = [];
        minigame.onSuccess = onSuccess;
        minigame.onFail = onFail;
        
        for (let i = 0; i < 4; i++) {
            const randomColor = minigame.colors[Math.floor(Math.random() * minigame.colors.length)];
            minigame.sequence.push(randomColor);
        }

        minigame.progressEl.textContent = "0 / 4";
        minigame.msgEl.textContent = "Renkleri ezberle!";
        minigame.timerEl.textContent = "--";
        minigame.displayEl.style.backgroundColor = '#333';
        minigame.buttonsContainer.style.pointerEvents = 'none';
        minigame.buttonsContainer.style.opacity = '0.5';
        minigame.modal.style.display = 'flex';

        let showIndex = 0;
        
        minigame.displayInterval = setInterval(() => {
            if (showIndex >= minigame.sequence.length) {
                clearInterval(minigame.displayInterval);
                minigame.displayEl.style.backgroundColor = '#333';
                startPlayerTurn();
                return;
            }

            minigame.displayEl.style.backgroundColor = minigame.sequence[showIndex];
            SoundManager.click(); // Her renk gösterildiğinde kısa bir tık
            
            setTimeout(() => {
                minigame.displayEl.style.backgroundColor = '#333';
            }, 500);

            showIndex++;
        }, 800);
    }

    function startPlayerTurn() {
        minigame.msgEl.textContent = "Sıra Sende! Hızlı Ol!";
        minigame.buttonsContainer.style.pointerEvents = 'auto';
        minigame.buttonsContainer.style.opacity = '1';
        
        minigame.timeLeft = 5.0;
        minigame.timerEl.textContent = "5.0s";

        clearInterval(minigame.timerInterval);
        minigame.timerInterval = setInterval(() => {
            minigame.timeLeft -= 0.1;
            if (minigame.timeLeft <= 0) {
                minigame.timeLeft = 0;
                minigame.timerEl.textContent = "0.0s";
                endMinigame(false);
            } else {
                minigame.timerEl.textContent = minigame.timeLeft.toFixed(1) + "s";
            }
        }, 100);
    }

    function endMinigame(success) {
        if (!minigame.isActive) return;
        minigame.isActive = false;
        clearInterval(minigame.timerInterval);
        clearInterval(minigame.displayInterval);
        minigame.modal.style.display = 'none';
        
        if (success) {
            if (minigame.onSuccess) minigame.onSuccess();
        } else {
            if (minigame.onFail) minigame.onFail();
        }
    }

    // --- Reflex Game System ---
    const reflexGame = {
        modal: document.getElementById('reflex-modal'),
        btnReflex: document.getElementById('btn-reflex'),
        isActive: false,
        timeoutWait: null,
        timeoutWindow: null,
        canPress: false,
        onSuccess: null,
        onFail: null
    };

    if (reflexGame.btnReflex) {
        reflexGame.btnReflex.addEventListener('click', () => {
            if (!reflexGame.isActive) return;

            if (reflexGame.canPress) {
                // Doğru zamanda bastı
                endReflexGame(true);
            } else {
                // Erken bastı (kırmızı iken)
                endReflexGame(false);
            }
        });
    }

    function startReflexGame(onSuccess, onFail) {
        if (reflexGame.isActive) return;
        reflexGame.isActive = true;
        reflexGame.canPress = false;
        reflexGame.onSuccess = onSuccess;
        reflexGame.onFail = onFail;
        
        reflexGame.btnReflex.classList.remove('green-mode'); // Kırmızı (Varsayılan)
        reflexGame.btnReflex.textContent = 'BASMA';
        reflexGame.modal.style.display = 'flex';

        // 1 ile 4 saniye arası bekleme
        const waitTime = 1000 + Math.random() * 3000;
        
        reflexGame.timeoutWait = setTimeout(() => {
            if (!reflexGame.isActive) return;
            
            reflexGame.canPress = true;
            reflexGame.btnReflex.classList.add('green-mode'); // Yeşil
            reflexGame.btnReflex.textContent = 'BAS!';
            
            // 0.5 saniye basma süresi
            reflexGame.timeoutWindow = setTimeout(() => {
                if (!reflexGame.isActive) return;
                // Süre doldu, basamadı
                endReflexGame(false);
            }, 500);

        }, waitTime);
    }

    function endReflexGame(success) {
        if (!reflexGame.isActive) return;
        reflexGame.isActive = false;
        clearTimeout(reflexGame.timeoutWait);
        clearTimeout(reflexGame.timeoutWindow);
        reflexGame.modal.style.display = 'none';
        
        if (success) {
            if (reflexGame.onSuccess) reflexGame.onSuccess();
        } else {
            if (reflexGame.onFail) reflexGame.onFail();
        }
    }

    // --- Math Game System ---
    const mathGame = {
        modal: document.getElementById('math-modal'),
        timerEl: document.getElementById('math-timer'),
        questionEl: document.getElementById('math-question'),
        optionsContainer: document.getElementById('math-options'),
        isActive: false,
        timeLeft: 3.0,
        timerInterval: null,
        onSuccess: null,
        onFail: null
    };

    function startMathGame(onSuccess, onFail) {
        if (mathGame.isActive) return;
        mathGame.isActive = true;
        mathGame.onSuccess = onSuccess;
        mathGame.onFail = onFail;
        mathGame.timeLeft = 3.0;

        const a = Math.floor(Math.random() * 20) + 1;
        const b = Math.floor(Math.random() * 20) + 1;
        const op = Math.random() > 0.5 ? '+' : '-';
        const correctAnswer = op === '+' ? a + b : a - b;
        
        mathGame.questionEl.textContent = `${a} ${op} ${b} = ?`;
        
        const options = [correctAnswer];
        while (options.length < 4) {
            const wrong = correctAnswer + (Math.floor(Math.random() * 10) - 5);
            if (!options.includes(wrong)) options.push(wrong);
        }
        options.sort(() => Math.random() - 0.5);

        mathGame.optionsContainer.innerHTML = '';
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-outline';
            btn.style.width = '100%';
            btn.style.fontSize = '1.2rem';
            btn.textContent = opt;
            btn.onclick = () => {
                if (!mathGame.isActive) return;
                if (opt === correctAnswer) {
                    endMathGame(true);
                } else {
                    endMathGame(false);
                }
            };
            mathGame.optionsContainer.appendChild(btn);
        });

        mathGame.modal.style.display = 'flex';
        mathGame.timerEl.textContent = "3.0s";

        clearInterval(mathGame.timerInterval);
        mathGame.timerInterval = setInterval(() => {
            mathGame.timeLeft -= 0.1;
            if (mathGame.timeLeft <= 0) {
                mathGame.timeLeft = 0;
                mathGame.timerEl.textContent = "0.0s";
                endMathGame(false);
            } else {
                mathGame.timerEl.textContent = mathGame.timeLeft.toFixed(1) + "s";
            }
        }, 100);
    }

    function endMathGame(success) {
        if (!mathGame.isActive) return;
        mathGame.isActive = false;
        clearInterval(mathGame.timerInterval);
        mathGame.modal.style.display = 'none';
        
        if (success) {
            if (mathGame.onSuccess) mathGame.onSuccess();
        } else {
            if (mathGame.onFail) mathGame.onFail();
        }
    }


    function loseEnergy() {
        if (gameState.energy > 0) {
            gameState.energy--;
            if (uiElements.energy) uiElements.energy.textContent = gameState.energy;
            
            SoundManager.energyLoss();
            VFXManager.shake(document.getElementById('game-screen'));

            // Eğer istersen printConsole burada çağırılabilir:
            if (typeof printConsole === 'function') {
                printConsole("Başarısız! Enerjin boşa gitti.", "error");
            }
        }
    }

    // --- State ---
    let gameState = {
        username: "Misafir",
        score: 0,
        energy: 10,
        coins: 1250,
        mapInitialized: false,
        playerColor: '#ff3b30', // Varsayılan Kırmızı
        playerEmoji: '🏰', // Varsayılan Kale
        ownedColors: ['#ff3b30', '#0a84ff', '#34c759', '#ffcc00', '#ff9500', '#af52de', '#ff2d55', '#ffffff'],
        ownedEmojis: ['🏰'],
        kills: 0,
        playerId: "---",
        castleCellId: null,
        turkeyGeoJSON: null,
        email: null
    };

    // --- Mağaza Verileri ---
    const storeColors = [
        // 8 Ana Renk (Ücretsiz)
        { name: 'Kırmızı', color: '#ff3b30', price: 0 },
        { name: 'Mavi', color: '#0a84ff', price: 0 },
        { name: 'Yeşil', color: '#34c759', price: 0 },
        { name: 'Sarı', color: '#ffcc00', price: 0 },
        { name: 'Turuncu', color: '#ff9500', price: 0 },
        { name: 'Mor', color: '#af52de', price: 0 },
        { name: 'Pembe', color: '#ff2d55', price: 0 },
        { name: 'Beyaz', color: '#ffffff', price: 0 },
        // Ekstra Renkler
        { name: 'Neon Yeşili', color: '#39ff14', price: 50 },
        { name: 'Altın Yaldızlı', color: '#ffd700', price: 60 },
        { name: 'Zehir Yeşili', color: '#7fff00', price: 90 },
        { name: 'Plazma Mavisi', color: '#00ffff', price: 110 },
        { name: 'Kozmik Mor', color: '#8a2be2', price: 130 },
        { name: 'Cehennem Kırmızısı', color: '#8b0000', price: 150 },
        { name: 'Hayalet Beyazı', color: '#f8f8ff', price: 175 },
        { name: 'Kuantum Grisi', color: '#696969', price: 200 },
        { name: 'Elmas Mavisi', color: '#b9f2ff', price: 220 },
        { name: 'Cırtlak Sarı', color: '#ccff00', price: 240 },
        { name: 'Şeftali Tonu', color: '#ffcba4', price: 260 },
        { name: 'Radyoaktif', color: '#bfff00', price: 280 },
        { name: 'Mistik Kırmızı', color: '#ff0038', price: 300 },
        { name: 'Şimşek Sarısı', color: '#fcee0a', price: 320 },
        { name: 'Tanrısal Işık', color: '#e6ffff', price: 350 }
    ];

    const storeEmojis = [
        { name: 'Klasik Kale', emoji: '🏰', price: 0 },
        { name: 'Bayrak', emoji: '🚩', price: 100 },
        { name: 'Kral', emoji: '👑', price: 250 },
        { name: 'Ejderha', emoji: '🐲', price: 500 },
        { name: 'Şimşek', emoji: '⚡', price: 750 },
        { name: 'Alev', emoji: '🔥', price: 1000 },
        { name: 'Kuru Kafa', emoji: '💀', price: 1500 },
        { name: 'Elmas', emoji: '💎', price: 2000 },
        { name: 'Aslan', emoji: '🦁', price: 3000 },
        { name: 'Kartal', emoji: '🦅', price: 3000 },
        { name: 'Kurt', emoji: '🐺', price: 3000 },
        { name: 'Ay Yıldız', emoji: '☪️', price: 5000 },
        { name: 'Roket', emoji: '🚀', price: 7500 },
        { name: 'Dünya', emoji: '🌍', price: 10000 }
    ];

    let currentStoreTab = 'colors';

    // Rengin tam zıt (tamamlayıcı) rengini hesaplar
    function getComplementaryColor(hex) {
        if (hex.indexOf('#') === 0) hex = hex.slice(1);
        if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        
        // RGB'yi tersine çevir
        const rInv = (255 - r).toString(16).padStart(2, '0');
        const gInv = (255 - g).toString(16).padStart(2, '0');
        const bInv = (255 - b).toString(16).padStart(2, '0');
        
        return `#${rInv}${gInv}${bInv}`;
    }

    // Rengin üzerine en iyi gidecek yazı rengini (Siyah/Beyaz) hesaplar
    function getContrastText(hex) {
        if (hex.indexOf('#') === 0) hex = hex.slice(1);
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness > 128 ? '#000000' : '#ffffff';
    }

    function renderStore() {
        const storeContainer = document.getElementById('store-grid-container');
        if (!storeContainer) return;
        storeContainer.innerHTML = '';

        if (currentStoreTab === 'colors') {
            storeColors.forEach(item => {
                const isOwned = gameState.ownedColors.includes(item.color);
                const isSelected = gameState.playerColor === item.color;

                const div = document.createElement('div');
                div.className = 'store-item';
                
                let actionBtnHTML = '';
                if (isSelected) {
                    actionBtnHTML = `<button class="btn btn-sm btn-primary" disabled>Seçili</button>`;
                } else if (isOwned) {
                    actionBtnHTML = `<button class="btn btn-sm btn-outline" onclick="selectColor('${item.color}')">Kullan</button>`;
                } else {
                    actionBtnHTML = `<button class="btn btn-sm btn-outline" onclick="buyColor('${item.color}', ${item.price})">Al (${item.price} 🪙)</button>`;
                }

                const priceText = item.price === 0 ? "Ücretsiz" : `${item.price} 🪙`;

                div.innerHTML = `
                    <div class="color-preview" style="width: 40px; height: 40px; border-radius: 50%; background-color: ${item.color}; box-shadow: 0 0 15px ${item.color}80; margin-bottom: 5px;"></div>
                    <div class="item-name" style="color: var(--primary-anti)">${item.name}</div>
                    <div class="item-price" style="color: var(--text-gold); font-size: 0.8rem; font-weight: bold; margin-bottom: 5px;">${isOwned ? 'Sahipsin' : priceText}</div>
                    ${actionBtnHTML}
                `;
                storeContainer.appendChild(div);
            });
        } else {
            storeEmojis.forEach(item => {
                const isOwned = gameState.ownedEmojis.includes(item.emoji);
                const isSelected = gameState.playerEmoji === item.emoji;

                const div = document.createElement('div');
                div.className = 'store-item';
                
                let actionBtnHTML = '';
                if (isSelected) {
                    actionBtnHTML = `<button class="btn btn-sm btn-primary" disabled>Seçili</button>`;
                } else if (isOwned) {
                    actionBtnHTML = `<button class="btn btn-sm btn-outline" onclick="selectEmoji('${item.emoji}')">Kullan</button>`;
                } else {
                    actionBtnHTML = `<button class="btn btn-sm btn-outline" onclick="buyEmoji('${item.emoji}', ${item.price})">Al (${item.price} 🪙)</button>`;
                }

                const priceText = item.price === 0 ? "Ücretsiz" : `${item.price} 🪙`;

                div.innerHTML = `
                    <div class="emoji-preview" style="font-size: 2rem; margin-bottom: 5px;">${item.emoji}</div>
                    <div class="item-name" style="color: var(--primary-anti)">${item.name}</div>
                    <div class="item-price" style="color: var(--text-gold); font-size: 0.8rem; font-weight: bold; margin-bottom: 5px;">${isOwned ? 'Sahipsin' : priceText}</div>
                    ${actionBtnHTML}
                `;
                storeContainer.appendChild(div);
            });
        }
    }

    window.selectColor = function(color) {
        gameState.playerColor = color;
        renderStore();
        if (socket) {
            // Sunucuda rengi güncelle ve kaydet
            socket.emit('update_colors', { color: gameState.playerColor });
        }
        updateLobbyTheme();
    };

    window.buyColor = function(color, price) {
        if (gameState.coins >= price) {
            gameState.coins -= price;
            uiElements.coins.textContent = gameState.coins;
            gameState.ownedColors.push(color);
            
            if (socket) {
                socket.emit('update_coins', { coins: gameState.coins });
                socket.emit('update_colors', { ownedColors: gameState.ownedColors });
            }
            
            selectColor(color);
        } else {
            alert("Yeterli 🪙 yok!");
        }
    };

    window.selectEmoji = function(emoji) {
        gameState.playerEmoji = emoji;
        renderStore();
        if (socket) {
            socket.emit('update_emojis', { emoji: gameState.playerEmoji });
        }
    };

    window.buyEmoji = function(emoji, price) {
        if (gameState.coins >= price) {
            gameState.coins -= price;
            uiElements.coins.textContent = gameState.coins;
            gameState.ownedEmojis.push(emoji);
            
            if (socket) {
                socket.emit('update_coins', { coins: gameState.coins });
                socket.emit('update_emojis', { ownedEmojis: gameState.ownedEmojis });
            }
            
            selectEmoji(emoji);
        } else {
            alert("Yeterli 🪙 yok!");
        }
    };

    // Mağazayı ilk açılışta çiz
    renderStore();

    let map;
    const socket = typeof io !== 'undefined' ? io() : null;
    window.gridCells = {};
    window.playerTerritories = {}; // Turf MultiPolygon data per color
    window.territoryLayers = {};   // Leaflet GeoJSON layers per color

    // --- Navigation ---
    function switchScreen(screenName) {
        Object.values(screens).forEach(screen => {
            screen.classList.remove('active');
        });
        screens[screenName].classList.add('active');
    }

    // --- Auth Logic ---
    const authContainers = {
        login: document.getElementById('login-form-container'),
        register: document.getElementById('register-form-container'),
        verify: document.getElementById('verify-form-container')
    };

    document.getElementById('switch-to-register').addEventListener('click', (e) => {
        e.preventDefault();
        showAuthForm('register');
    });

    document.getElementById('switch-to-login').addEventListener('click', (e) => {
        e.preventDefault();
        showAuthForm('login');
    });

    document.getElementById('back-to-register').addEventListener('click', (e) => {
        e.preventDefault();
        showAuthForm('register');
    });

    function showAuthForm(type) {
        Object.values(authContainers).forEach(c => c.style.display = 'none');
        authContainers[type].style.display = 'block';
    }

    // Password Visibility Toggle
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (input.type === 'password') {
                input.type = 'text';
                btn.textContent = '🔒';
            } else {
                input.type = 'password';
                btn.textContent = '👁️';
            }
        });
    });

    // Login Submission
    buttons.submitLogin.addEventListener('click', async () => {
        console.log("Giriş yap butonuna tıklandı.");
        SoundManager.click();
        VFXManager.pulse(buttons.submitLogin);
        const email = document.getElementById('login-email').value;

        const password = document.getElementById('login-password').value;

        if (!email || !password) { 
            SoundManager.fail(); 
            VFXManager.shake(document.querySelector('.auth-card'));
            return; 
        }

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (res.ok) {
                VFXManager.flash();
                handleAuthSuccess(data.user);
            } else {
                VFXManager.shake(document.querySelector('.auth-card'));
                SoundManager.fail();
            }
        } catch (err) {
            console.error(err);
            VFXManager.shake(document.querySelector('.auth-card'));
            SoundManager.fail();
        }
    });

    // Register Submission
    buttons.submitRegister.addEventListener('click', async () => {
        SoundManager.click();
        VFXManager.pulse(buttons.submitRegister);
        const username = document.getElementById('register-username').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;

        if (!username || !email || !password || !confirmPassword) { SoundManager.fail(); return alert('Lütfen tüm alanları doldurun.'); }
        if (password !== confirmPassword) { SoundManager.fail(); return alert('Şifreler eşleşmiyor!'); }

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            const data = await res.json();
            if (res.ok) {
                SoundManager.success(); 
                VFXManager.flash();
                showAuthForm('verify');
            } else {
                VFXManager.shake(document.querySelector('.auth-card'));
                SoundManager.fail(); alert(data.error || 'Kayıt başarısız.');
            }
        } catch (err) {
            console.error(err);
            alert('Sunucu hatası.');
        }
    });

    // Verify Submission
    buttons.submitVerify.addEventListener('click', async () => {
        SoundManager.click();
        const email = document.getElementById('register-email').value;
        const code = document.getElementById('verify-code').value;

        if (!code) { SoundManager.fail(); return alert('Lütfen kodu girin.'); }

        try {
            const res = await fetch('/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code })
            });
            const data = await res.json();
            if (res.ok) {
                handleAuthSuccess(data.user);
            } else {
                SoundManager.fail(); alert(data.error || 'Doğrulama başarısız.');
            }
        } catch (err) {
            console.error(err);
            alert('Sunucu hatası.');
        }
    });

    // Sync auth state from socket (useful for re-joining)
    if (socket) {
        socket.on('auth_success', (data) => {
            if (data.user) {
                // Ensure UI is synced with server data
                gameState.score = data.user.score || 0;
                gameState.coins = data.user.coins !== undefined ? data.user.coins : 1250;
                gameState.playerColor = data.user.color || '#ff3b30';
                gameState.playerEmoji = data.user.emoji || '🏰';
                gameState.ownedColors = data.user.ownedColors || gameState.ownedColors;
                gameState.ownedEmojis = data.user.ownedEmojis || gameState.ownedEmojis;
                
                uiElements.coins.textContent = gameState.coins;
                uiElements.score.textContent = gameState.score >= 1000000 ? 
                    (gameState.score / 1000000).toLocaleString('tr-TR', { maximumFractionDigits: 3 }) + " km²" : 
                    gameState.score.toLocaleString('tr-TR') + " m²";
                
                renderStore();
            }
        });
    }

    function handleAuthSuccess(user) {
        gameState.username = user.username;
        gameState.playerId = user.id;
        gameState.email = user.email;
        gameState.score = user.score || 0;
        gameState.coins = user.coins !== undefined ? user.coins : 1250;
        gameState.playerColor = user.color || '#ff3b30';
        gameState.playerEmoji = user.emoji || '🏰';
        gameState.ownedColors = user.ownedColors || ['#ff3b30', '#0a84ff', '#34c759', '#ffcc00', '#ff9500', '#af52de', '#ff2d55', '#ffffff'];
        gameState.ownedEmojis = user.ownedEmojis || ['🏰'];
        gameState.castleCellId = user.castle;

        uiElements.username.textContent = gameState.username;
        uiElements.playerId.textContent = `#${gameState.playerId}`;
        uiElements.coins.textContent = gameState.coins;
        uiElements.score.textContent = gameState.score >= 1000000 ? 
            (gameState.score / 1000000).toLocaleString('tr-TR', { maximumFractionDigits: 3 }) + " km²" : 
            gameState.score.toLocaleString('tr-TR') + " m²";

        renderStore(); // Renkler yüklendiği için mağazayı güncelle

        if (socket) {
            socket.emit('player_join', { 
                username: gameState.username, 
                email: gameState.email, 
                color: gameState.playerColor,
                emoji: gameState.playerEmoji
            });
        }
        updateLobbyTheme();
        switchScreen('lobby');
        SoundManager.startBGM(); // Oyuna girince müziği başlat
    }

    function getContrastYIQ(hexcolor){
        if(!hexcolor) return 'white';
        hexcolor = hexcolor.replace("#", "");
        if(hexcolor.length === 3) {
            hexcolor = hexcolor.split('').map(c => c+c).join('');
        }
        var r = parseInt(hexcolor.substr(0,2),16);
        var g = parseInt(hexcolor.substr(2,2),16);
        var b = parseInt(hexcolor.substr(4,2),16);
        var yiq = ((r*299)+(g*587)+(b*114))/1000;
        return (yiq >= 128) ? '#000000' : '#ffffff';
    }

    function getComplementaryColor(hex) {
        hex = hex.replace('#', '');
        let r = parseInt(hex.substr(0, 2), 16);
        let g = parseInt(hex.substr(2, 2), 16);
        let b = parseInt(hex.substr(4, 2), 16);
        r = (255 - r).toString(16).padStart(2, '0');
        g = (255 - g).toString(16).padStart(2, '0');
        b = (255 - b).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }

    function getContrastText(hex) {
        return getContrastYIQ(hex);
    }

    function updateLobbyTheme() {
        const color = gameState.playerColor || '#ff3b30';
        const antiColor = getComplementaryColor(color);
        const contrastText = getContrastText(color);

        document.documentElement.style.setProperty('--primary-red', color);
        document.documentElement.style.setProperty('--primary-anti', antiColor);
        document.documentElement.style.setProperty('--primary-contrast', contrastText);
        
        // Glow blobları da güncelle
        document.querySelectorAll('.glow-blob').forEach(blob => {
            blob.style.backgroundColor = color;
        });

        // Başlat butonu parlamasını da güncelle
        const megaBtn = document.getElementById('btn-start');
        if (megaBtn) {
            megaBtn.style.boxShadow = `0 0 60px ${color}80, inset 0 0 40px rgba(0, 0, 0, 0.4)`;
            megaBtn.style.color = contrastText; // Buton içi yazı rengi okunabilir olsun
        }
    }

    function generatePlayerID() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let id = '';
        for (let i = 0; i < 6; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return id;
    }


    // --- Game Navigation Logic ---
    buttons.start.addEventListener('click', () => {
        SoundManager.click();
        switchScreen('game');
        initMap();
        
        // Map'in yüklenmesini bekleyip öyle spawn olalım (daha stabil)
        setTimeout(() => {
            if (!gameState.castleCellId) {
                console.log("Yeni oyuncu spawn süreci başlıyor...");
        SoundManager.conquest();
                spawnPlayer();
        SoundManager.conquest();
            } else {
                console.log("Eski konumdan devam ediliyor...");
                const coords = gameState.castleCellId.split('_');
                const lat = parseFloat(coords[0]);
                const lng = parseFloat(coords[1]);
                map.setView([lat, lng], 18);
            }
        }, 500);
    });

    // Energy regeneration logic with visible timer
    let energyRegenTime = 5; // 5 saniye
    let currentRegenTime = 0;

    setInterval(() => {
        if (gameState.energy < 10) {
            currentRegenTime++;
            if (currentRegenTime >= energyRegenTime) {
                gameState.energy++;
                currentRegenTime = 0;
                if (uiElements.energy) uiElements.energy.textContent = gameState.energy;
            }
            
            if (uiElements.energyTimer) {
                const remaining = energyRegenTime - currentRegenTime;
                uiElements.energyTimer.textContent = `(${remaining}s)`;
            }
        } else {
            currentRegenTime = 0;
            if (uiElements.energyTimer) uiElements.energyTimer.textContent = "";
        }
    }, 1000);

    buttons.backToLobby.addEventListener('click', () => {
        switchScreen('lobby');
    });

    // --- Tab Navigation Logic ---
    const navBtns = document.querySelectorAll('.nav-btn');
    const hubTabs = document.querySelectorAll('.hub-tab');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active'));
            hubTabs.forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Store sub-tab switching
    const storeSubTabs = document.querySelectorAll('.store-sub-tab');
    storeSubTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            storeSubTabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentStoreTab = btn.getAttribute('data-type');
            renderStore();
        });
    });

    // --- Global Leaderboard Logic ---
    const btnGlobalLb = document.getElementById('btn-global-lb');
    const globalLbModal = document.getElementById('global-lb-modal');
    const closeGlobalLbBtn = document.getElementById('close-global-lb');
    const globalLbList = document.getElementById('global-lb-list');
    const globalLbTitle = document.getElementById('global-lb-title');
    const lbTabBtns = document.querySelectorAll('.lb-tab-btn');
    
    let globalLbData = { areaAllTime: [], areaMonthly: [], killsAllTime: [], killsMonthly: [] };
    let currentGlobalLbType = 'areaAllTime'; 

    function renderGlobalLeaderboard() {
        if (!globalLbList) return;
        globalLbList.innerHTML = '';
        
        const dataToRender = globalLbData[currentGlobalLbType] || [];
        
        // Title formatting
        let title = "Tüm Zamanlar - Alan";
        if (currentGlobalLbType === 'areaMonthly') title = "Bu Ay - Alan";
        if (currentGlobalLbType === 'killsAllTime') title = "Tüm Zamanlar - Leş";
        if (currentGlobalLbType === 'killsMonthly') title = "Bu Ay - Leş";
        
        globalLbTitle.textContent = title;

        // Update active class on buttons
        lbTabBtns.forEach(btn => {
            if (btn.getAttribute('data-type') === currentGlobalLbType) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        if (dataToRender.length === 0) {
            globalLbList.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Veri bulunamadı.</div>';
            return;
        }

        dataToRender.forEach((player, index) => {
            const item = document.createElement('div');
            item.className = 'lb-item';
            
            // Score formatting
            const scoreArea = player.score || 0;
            let scoreText = scoreArea >= 1000000 ? 
                (scoreArea / 1000000).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + " km²" : 
                scoreArea.toLocaleString('tr-TR') + " m²";
                
            const isKillsSorted = currentGlobalLbType.includes('kills');
            const areaStyle = isKillsSorted ? 'color: var(--text-muted);' : 'color: var(--text-gold); font-weight: bold;';
            const killsStyle = isKillsSorted ? 'color: #ff3b30; font-weight: bold; font-size: 1rem;' : 'color: #ff3b30; opacity: 0.7;';

            item.innerHTML = `
                <span class="lb-rank">${index + 1}</span>
                <span class="lb-emoji">${player.emoji || '🏰'}</span>
                <span class="lb-name" style="color: ${player.color}">${player.username}</span>
                <span class="lb-stats" style="text-align: right;">
                    <span style="${areaStyle}">${scoreText}</span> <br> 
                    <small style="${killsStyle}">${player.kills || 0} Leş</small>
                </span>
            `;
            globalLbList.appendChild(item);
        });
    }

    if (btnGlobalLb) {
        btnGlobalLb.addEventListener('click', () => {
            globalLbModal.style.display = 'flex';
            renderGlobalLeaderboard();
        });
    }

    lbTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            currentGlobalLbType = btn.getAttribute('data-type');
            renderGlobalLeaderboard();
        });
    });

    if (closeGlobalLbBtn) {
        closeGlobalLbBtn.addEventListener('click', () => {
            globalLbModal.style.display = 'none';
        });
    }

    // --- Profile Logic ---
    const btnProfile = document.getElementById('btn-profile');
    const btnCloseProfile = document.getElementById('close-profile');

    if (btnProfile) {
        btnProfile.addEventListener('click', () => {
            updateProfileStats();
            uiElements.profileModal.style.display = 'flex';
        });
    }

    if (btnCloseProfile) {
        btnCloseProfile.addEventListener('click', () => {
            uiElements.profileModal.style.display = 'none';
        });
    }

    // Close on click outside
    window.addEventListener('click', (e) => {
        if (e.target === uiElements.profileModal) {
            uiElements.profileModal.style.display = 'none';
        }
        if (e.target === document.getElementById('settings-modal')) {
            document.getElementById('settings-modal').style.display = 'none';
        }
    });

    // --- Settings Logic ---
    const btnSettings = document.getElementById('btn-settings');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');

    if (btnSettings) {
        btnSettings.addEventListener('click', () => {
            settingsModal.style.display = 'flex';
        });
    }

    if (closeSettings) {
        closeSettings.addEventListener('click', () => {
            settingsModal.style.display = 'none';
        });
    }

    document.getElementById('toggle-master-sound')?.addEventListener('change', (e) => {
        window.gameSettings.masterSound = e.target.checked;
        saveSettings();
        if (window.gameSettings.masterSound && window.gameSettings.music && screens.game.classList.contains('active')) {
            SoundManager.startBGM();
        }
    });

    document.getElementById('toggle-music')?.addEventListener('change', (e) => {
        window.gameSettings.music = e.target.checked;
        saveSettings();
        if (window.gameSettings.masterSound && window.gameSettings.music && screens.game.classList.contains('active')) {
            SoundManager.startBGM();
        }
    });

    document.getElementById('toggle-sfx')?.addEventListener('change', (e) => {
        window.gameSettings.sfx = e.target.checked;
        saveSettings();
    });

    document.getElementById('volume-sfx')?.addEventListener('input', (e) => {
        window.gameSettings.sfxVolume = parseInt(e.target.value) / 100;
        saveSettings();
    });

    document.getElementById('toggle-vfx')?.addEventListener('change', (e) => {
        window.gameSettings.vfx = e.target.checked;
        saveSettings();
    });

    document.getElementById('volume-music')?.addEventListener('input', (e) => {
        window.gameSettings.musicVolume = parseInt(e.target.value) / 100;
        saveSettings();
    });

    function updateProfileStats() {
        uiElements.profileStats.profileName.textContent = gameState.username;
        uiElements.profileStats.totalKills.textContent = gameState.kills;
        uiElements.profileStats.totalCoins.textContent = `${gameState.coins} 🪙`;
        
        if (gameState.score >= 1000000) {
            const km2 = (gameState.score / 1000000).toLocaleString('tr-TR', { maximumFractionDigits: 3 });
            uiElements.profileStats.totalArea.textContent = km2 + " km²";
        } else {
            uiElements.profileStats.totalArea.textContent = gameState.score.toLocaleString('tr-TR') + " m²";
        }
    }

    // --- Name Edit Logic ---
    const btnEditName = document.getElementById('btn-edit-name');
    const btnSaveName = document.getElementById('btn-save-name');
    const btnCancelName = document.getElementById('btn-cancel-name');
    const nameEditInputGroup = document.getElementById('name-edit-input-group');
    const inputNewName = document.getElementById('input-new-name');
    const nameEditWrapper = document.querySelector('.name-edit-wrapper');

    if (btnEditName) {
        btnEditName.addEventListener('click', () => {
            nameEditWrapper.style.display = 'none';
            nameEditInputGroup.style.display = 'flex';
            inputNewName.value = gameState.username;
            inputNewName.focus();
        });
    }

    if (btnCancelName) {
        btnCancelName.addEventListener('click', () => {
            nameEditWrapper.style.display = 'flex';
            nameEditInputGroup.style.display = 'none';
        });
    }

    if (btnSaveName) {
        btnSaveName.addEventListener('click', () => {
            const newName = inputNewName.value.trim();
            if (newName.length < 5 || newName.length > 14) {
                alert("İsim 5 ile 14 karakter arasında olmalıdır!");
                return;
            }

            gameState.username = newName;
            uiElements.username.textContent = newName;
            updateProfileStats();
            
            nameEditWrapper.style.display = 'flex';
            nameEditInputGroup.style.display = 'none';

            if (socket) {
                socket.emit('player_update', { username: gameState.username });
            }
        });
    }

    // --- Game/Map Logic ---
    function initMap() {
        if (gameState.mapInitialized) {
            // Force leaflet to recalculate size when unhidden
            setTimeout(() => map.invalidateSize(), 100);
            return;
        }

        // Sınırlandırılmış harita alanı (Türkiye)
        const bounds = [
            [35.0, 25.0], // Güney Batı
            [43.0, 45.0]  // Kuzey Doğu
        ];

        // Initialize Map centered on Turkey
        map = L.map('map-container', {
            center: [39.0, 35.2433], // Turkey approx center
            zoom: 6,
            minZoom: 6,
            maxZoom: 22,
            maxBounds: bounds,
            maxBoundsViscosity: 1.0,
            zoomControl: false,
            attributionControl: false
        });

        // Add sleek dark theme map tiles with city names
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            subdomains: 'abcd',
            maxZoom: 22
        }).addTo(map);

        // Harita katmanları için özel panel (Sınırların her zaman en üstte kalması için)
        map.createPane('borders');
        map.getPane('borders').style.zIndex = 10000; // En üst katman
        map.getPane('borders').style.pointerEvents = 'none';

        // Türkiye Sınırları (Lokal dosyadan yükle - Kesin çözüm)
        fetch('/turkey.geojson')
            .then(res => res.json())
            .then(data => {
                // turkey.geojson doğrudan bir Feature objesidir
                const turkey = data;
                
                if (turkey && turkey.geometry) {
                    gameState.turkeyGeoJSON = turkey;
                    console.log("Türkiye sınırı yüklendi. Tip:", turkey.geometry.type);
                    
                    if (window.turkeyBorderLayer) map.removeLayer(window.turkeyBorderLayer);

                    window.turkeyBorderLayer = L.geoJSON(turkey, {
                        pane: 'borders',
                        style: {
                            color: '#ff0000',
                            weight: 2,
                            opacity: 1,
                            fillOpacity: 0,
                            interactive: false
                        }
                    }).addTo(map);

                    map.fitBounds(window.turkeyBorderLayer.getBounds(), {padding: [20, 20]});
                    console.log("Kırmızı sınır çizildi.");
                } else {
                    console.error("Geçersiz turkey.geojson formatı:", data);
                }
            })
            .catch(err => {
                console.error("turkey.geojson yüklenemedi:", err);
            });


            // Her 2 saniyede bir sınırı en üste getir
            setInterval(() => {
                if (window.turkeyBorderLayer) window.turkeyBorderLayer.bringToFront();
            }, 2000);

            generateTurkeyGrid();
        gameState.mapInitialized = true;
    }

    let conqueredGridGroup;
    let hoverRect;
    const gridSize = 0.00002; // Gerçekçi ölçek: 2.2m x 2.2m = 5m² (Yaklaşık 156 Milyar parça)

    function isAdjacent(lat, lng) {
        if (gameState.score === 0 || !gameState.castleCellId) {
            console.log("İlk fetih: Bitişiklik aranmıyor.");
            return true;
        }

        const neighbors = [
            [1,0], [-1,0], [0,1], [0,-1],
            [1,1], [1,-1], [-1,1], [-1,-1]
        ];

        for (const [dLat, dLng] of neighbors) {
            const nLat = lat + (dLat * gridSize);
            const nLng = lng + (dLng * gridSize);
            const nId = `${nLat.toFixed(5)}_${nLng.toFixed(5)}`;
            
            const neighbor = window.gridCells[nId];
            if (neighbor && neighbor.isConquered) {
                // Sadece kendi hücremizse bitişik sayılır (aynı renkteki başka oyuncunun hücresi sayılmaz)
                if (neighbor.owner === gameState.email) {
                    return true;
                }
            }
        }
        
        console.warn("Bitişiklik bulunamadı. Email:", gameState.email, "Skor:", gameState.score);
        return false;
    }

    function spawnPlayer() {
        // Rastgele başlangıç pozisyonu (Türkiye sınırları içinde)
        let randomLat, randomLng, cellId;
        let isValid = false;
        let attempts = 0;

        // Türkiye'nin kaba bounding box'ı
        const minLat = 36.0, maxLat = 42.0;
        const minLng = 26.0, maxLng = 44.0;

        while (!isValid && attempts < 100) {
            randomLat = Math.random() * (maxLat - minLat) + minLat;
            randomLng = Math.random() * (maxLng - minLng) + minLng;
            
            // Grid'e hizala
            randomLat = Math.floor(randomLat / gridSize) * gridSize;
            randomLng = Math.floor(randomLng / gridSize) * gridSize;

            // Eğer GeoJSON yüklendiyse içinde mi kontrol et
            if (gameState.turkeyGeoJSON && typeof turf !== 'undefined') {
                const point = turf.point([randomLng, randomLat]);
                if (turf.booleanPointInPolygon(point, gameState.turkeyGeoJSON)) {
                    isValid = true;
                }
            } else {
                // Yüklenmediyse kaba bounds yeterli
                isValid = true;
            }
            attempts++;
        }

        cellId = `${randomLat.toFixed(5)}_${randomLng.toFixed(5)}`;

        gameState.castleCellId = cellId;
        map.flyTo([randomLat, randomLng], 18, {
            duration: 2.0,
            easeLinearity: 0.25
        });

        drawConqueredCell(randomLat, randomLng, cellId, gameState.playerColor, true, gameState.email, gameState.username);
        gameState.score = 5;
        uiElements.score.textContent = "5 m²";

        if (socket) {
            socket.emit('conquer_cell', { id: cellId, color: gameState.playerColor, emoji: gameState.playerEmoji, isCastle: true });
        }
        
        printConsole(`Başlangıç noktan belirlendi: ${randomLat.toFixed(5)}, ${randomLng.toFixed(5)}`, 'sys');
    }

    function generateTurkeyGrid() {
        conqueredGridGroup = L.layerGroup().addTo(map);
        
        // Tek bir vurgu karesi oluşturuyoruz, boş ızgaraları DOM'a eklemeyerek %100 kasma önleniyor.
        hoverRect = L.rectangle([[0,0], [0,0]], {
            color: 'rgba(255, 255, 255, 0.3)',
            weight: 1,
            fillColor: '#0a84ff',
            fillOpacity: 0.6,
            interactive: false // tıklanmayı engelle, tıklama map üzerinden alınacak
        }).addTo(map);

        // Fare hareketini takip et ve vurgu karesini güncelle
        map.on('mousemove', (e) => {
            if (map.getZoom() < 16) {
                hoverRect.setBounds([[0,0], [0,0]]);
                return;
            }

            const lat = Math.floor(e.latlng.lat / gridSize) * gridSize;
            const lng = Math.floor(e.latlng.lng / gridSize) * gridSize;
            const cellId = `${lat.toFixed(5)}_${lng.toFixed(5)}`;

            // Koordinatları UI'da göster
            if (uiElements.coordDisplay) {
                uiElements.coordDisplay.textContent = `Lat: ${lat.toFixed(5)} | Lng: ${lng.toFixed(5)}`;
            }

            // Eğer hücre fethedilmişse vurguyu gizle
            if (window.gridCells[cellId] && window.gridCells[cellId].isConquered) {
                hoverRect.setBounds([[0,0], [0,0]]);
            } else {
                hoverRect.setBounds([[lat, lng], [lat + gridSize, lng + gridSize]]);
            }
        });

        // Haritaya tıklama (Fetih işlemi)
        map.on('click', (e) => {
            console.log("Haritaya tıklandı:", e.latlng);
            SoundManager.click();
            
            if (map.getZoom() < 16) {
                VFXManager.shake(document.getElementById('map-container'), 3);
                alert("Parçalar çok küçük! Fethetmek için haritaya daha fazla yaklaşmalısın.");
                return; 
            }

            const lat = Math.floor(e.latlng.lat / gridSize) * gridSize;
            const lng = Math.floor(e.latlng.lng / gridSize) * gridSize;
            const cellId = `${lat.toFixed(5)}_${lng.toFixed(5)}`;

            // Sınır kontrolü (Türkiye sınırları içinde mi?)
            if (gameState.turkeyGeoJSON && typeof turf !== 'undefined') {
                const point = turf.point([lng, lat]);
                const isInside = turf.booleanPointInPolygon(point, gameState.turkeyGeoJSON);
                if (!isInside) {
                    console.warn("Tıklanan nokta sınır dışında:", lat, lng);
                    printConsole("Türkiye sınırları dışına çıkamazsın!", "error");
                    return;
                }
            } else if (lat < 35.0 || lat > 43.0 || lng < 25.0 || lng > 45.0) {
                return;
            }

            const cell = window.gridCells[cellId];
            const isOwnCell = cell && cell.isConquered && cell.owner === gameState.email;

            // Eğer kendi hücremiz değilse (boş veya başkasınınsa) fethedebiliriz
            if (!isOwnCell) {
                if (isAdjacent(lat, lng)) {
                    if (gameState.energy > 0) {
                        const randomGame = Math.random();
                        
                        if (randomGame < 0.33) {
                            startMinigame(
                                () => { conquerCell(lat, lng, cellId); },
                                () => { loseEnergy(); }
                            );
                        } else if (randomGame < 0.66) {
                            startReflexGame(
                                () => { conquerCell(lat, lng, cellId); },
                                () => { loseEnergy(); }
                            );
                        } else {
                            startMathGame(
                                () => { conquerCell(lat, lng, cellId); },
                                () => { loseEnergy(); }
                            );
                        }
                    } else {
                        alert("Enerjin tükendi! Enerjinin (5 saniyede bir) dolmasını bekle.");
                    }
                } else {
                    console.log("Bitişiklik başarısız. Hücre:", cellId);
                    printConsole("Sadece kendi bölgene bitişik alanları fethedebilirsin!", "error");
                }
            }
        });

        // İlk yüklemede sunucudan gelen fethedilenleri çiz
        setTimeout(() => {
            if (window.serverMapState) {
                for(const id in window.serverMapState) {
                    const coords = id.split('_');
                    const lat = parseFloat(coords[0]);
                    const lng = parseFloat(coords[1]);
                    drawConqueredCell(lat, lng, id, window.serverMapState[id].color, window.serverMapState[id].emoji, window.serverMapState[id].isCastle, window.serverMapState[id].owner, window.serverMapState[id].ownerName);
                }
            }
        }, 500);
    }

    function conquerCell(lat, lng, cellId) {
        if (gameState.energy > 0) {
            gameState.energy--;
            uiElements.energy.textContent = gameState.energy;

            SoundManager.success();
            VFXManager.flash();

            drawConqueredCell(lat, lng, cellId, gameState.playerColor, gameState.playerEmoji, false, gameState.email, gameState.username);
            
            // Fethettiğimizde hover'ı gizle
            hoverRect.setBounds([[0,0], [0,0]]);

            // Update Score (5m2 per click for realistic roleplay)
            gameState.score += 5;
            
            // Her karede (5m²) 1 altın kazan
            gameState.coins += 1;
            if (uiElements.coins) {
                uiElements.coins.textContent = gameState.coins;
            }
            // Sunucuya kazanılan altını bildir
            if (socket) {
                socket.emit('update_coins', { coins: gameState.coins });
            }
            
            if (gameState.score >= 1000000) {
                const km2 = (gameState.score / 1000000).toLocaleString('tr-TR', { maximumFractionDigits: 3 });
                uiElements.score.textContent = km2 + " km²";
            } else {
                uiElements.score.textContent = gameState.score.toLocaleString('tr-TR') + " m²";
            }

            // Send to server
            if (socket) {
                socket.emit('conquer_cell', { id: cellId, color: gameState.playerColor, emoji: gameState.playerEmoji });
            }
        } else {
            alert("Enerjin tükendi! Enerjinin (5 saniyede bir) dolmasını bekle.");
        }
    }

    function drawConqueredCell(lat, lng, cellId, color, emoji = '🏰', isCastle = false, owner = null, ownerName = null) {
        if (!window.gridCells[cellId]) {
            window.gridCells[cellId] = {};
        }

        const cell = window.gridCells[cellId];

        // 1. Hücreyi (Rectangle) Güncelle veya Oluştur
        if (cell.isConquered) {
            // Mevcut özellikleri güncelle
            cell.color = color;
            cell.isCastle = isCastle;
            cell.owner = owner;
            
            if (cell.rect) {
                cell.rect.setStyle({
                    fillColor: color,
                    fillOpacity: isCastle ? 1.0 : 0.8,
                    stroke: isCastle,
                    color: isCastle ? color : '#fff' // Kale çerçevesi kendi renginde olsun
                });
                
                // Eğer kale durumu değiştiyse class'ı da güncellemek gerekebilir
                const path = cell.rect._path;
                if (path) {
                    if (isCastle) path.classList.add('castle-cell');
                    else path.classList.remove('castle-cell');
                }
            }
        } else {
            cell.isConquered = true;
            cell.color = color;
            cell.isCastle = isCastle;
            cell.owner = owner;
            
            const cellBounds = [[lat, lng], [lat + gridSize, lng + gridSize]];
            
            const rect = L.rectangle(cellBounds, {
                fillColor: color,
                fillOpacity: isCastle ? 1.0 : 0.8,
                stroke: isCastle,
                color: isCastle ? color : '#fff',
                weight: 2,
                interactive: true,
                className: isCastle ? 'grid-cell castle-cell' : 'grid-cell'
            });

            cell.rect = rect;
            conqueredGridGroup.addLayer(rect);
            rect.bringToFront();
        }

        // 2. Kale İkonunu (Marker) Yönet
        const castleIconHtml = `<span style="text-shadow: 0 0 10px ${color}, 0 0 20px ${color}, 0 0 30px ${color}80;">${emoji}</span>`;
        const displayName = ownerName || (owner ? owner.split('@')[0] : 'Oyuncu');
        
        // Alan hesapla (serverMapState üzerinden)
        let ownerArea = 0;
        if (window.serverMapState && owner) {
            for (const cid in window.serverMapState) {
                if (window.serverMapState[cid].owner === owner) ownerArea += 5;
            }
        } else if (owner === gameState.email) {
            ownerArea = gameState.score;
        }

        const areaText = ownerArea >= 1000000 ? 
            (ownerArea / 1000000).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + " km²" : 
            ownerArea.toLocaleString('tr-TR') + " m²";

        const popupContent = `<div style="text-align:center; font-family:var(--font-main);">
                <b style="color:${color}; font-size:1.1rem;">${displayName}</b><br>
                <small style="color:#666;">Bölge Alanı: <b>${areaText}</b></small><br>
                <small style="color:#999;">Oyuncu Kalesi</small>
            </div>`;
        
        if (isCastle) {
            if (cell.marker) {
                // Mevcut marker'ın ikonunu ve tooltip'ini güncelle
                cell.marker.setIcon(L.divIcon({
                    className: 'castle-icon',
                    html: castleIconHtml,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                }));
                if (cell.marker.getTooltip()) {
                    cell.marker.setTooltipContent(popupContent);
                } else {
                    cell.marker.bindTooltip(popupContent, { direction: 'top', offset: [0, -10] });
                }
            } else {
                // Yeni marker oluştur
                const castleMarker = L.marker([lat + gridSize/2, lng + gridSize/2], {
                    icon: L.divIcon({
                        className: 'castle-icon',
                        html: castleIconHtml,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    }),
                    interactive: true
                });
                castleMarker.bindTooltip(popupContent, { direction: 'top', offset: [0, -10] });
                conqueredGridGroup.addLayer(castleMarker);
                cell.marker = castleMarker;
            }
        } else {
            // Eğer artık kale değilse ama marker varsa sil
            if (cell.marker) {
                conqueredGridGroup.removeLayer(cell.marker);
                cell.marker = null;
            }
        }

        // 3. Bölge sınırlarını güncelle
        updateTerritoryOutline(lat, lng, color);
    }

    function updateTerritoryOutline(lat, lng, color) {
        if (typeof turf === 'undefined') return;

        // Create a small polygon for the current cell
        // Note: Turf uses [lng, lat]
        const cellPoly = turf.polygon([[
            [lng, lat],
            [lng + gridSize, lat],
            [lng + gridSize, lat + gridSize],
            [lng, lat + gridSize],
            [lng, lat]
        ]]);

        if (!window.playerTerritories[color]) {
            window.playerTerritories[color] = cellPoly;
        } else {
            try {
                // Union the new cell with existing territory
                const unioned = turf.union(window.playerTerritories[color], cellPoly);
                if (unioned) {
                    window.playerTerritories[color] = unioned;
                }
            } catch (e) {
                console.warn("Turf union issue:", e);
                // In case of complex geometry errors, we skip updating the border for this click
                return;
            }
        }

        // Remove old border layer
        if (window.territoryLayers[color]) {
            map.removeLayer(window.territoryLayers[color]);
        }

        // Create new border layer (GeoJSON)
        window.territoryLayers[color] = L.geoJSON(window.playerTerritories[color], {
            style: {
                color: color,
                weight: 2.5,
                fill: false,
                stroke: true,
                opacity: 1,
                lineJoin: 'round',
                lineCap: 'round',
                // Subtle glow effect
                dashArray: '',
            },
            interactive: false
        }).addTo(map);
        
        // Ensure borders are on top of fills
        window.territoryLayers[color].bringToFront();
    }

    /*
    // --- Admin Console Logic (DEACTIVATED) ---
    const consoleEl = document.getElementById('admin-console');
    const consoleOutput = document.getElementById('console-output');
    const consoleInput = document.getElementById('console-input');
    const closeConsoleBtn = document.getElementById('close-console');
    const storeContainer = document.querySelector('.store-grid');

    // Make gameState globally accessible for the console
    window.gameState = gameState;
    window.uiElements = uiElements;

    function printConsole(msg, type = 'normal') {
        const div = document.createElement('div');
        div.textContent = msg;
        if (type === 'error') div.className = 'console-msg-error';
        if (type === 'sys') div.className = 'console-msg-sys';
        if (type === 'cmd') div.className = 'console-msg-cmd';
        consoleOutput.appendChild(div);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    if (consoleInput) {
        consoleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const cmd = consoleInput.value.trim();
                if (cmd) {
                    printConsole(`> ${cmd}`, 'cmd');
                    executeCommand(cmd);
                    consoleInput.value = '';
                }
            }
        });
    }

    if (closeConsoleBtn) {
        closeConsoleBtn.addEventListener('click', () => {
            consoleEl.style.display = 'none';
        });
    }

    document.addEventListener('keydown', (e) => {
        // " or é or backtick or Ctrl+F12
        if (e.key === '`' || e.key === 'é' || e.key === '"' || e.key === 'F12' && e.ctrlKey) {
            e.preventDefault();
            consoleEl.style.display = consoleEl.style.display === 'none' ? 'flex' : 'none';
            if (consoleEl.style.display === 'flex') {
                consoleInput.focus();
            }
        }
    });

    function executeCommand(cmdStr) {
        const args = cmdStr.split(' ');
        const cmd = args[0].toLowerCase();

        try {
            switch(cmd) {
                case 'help':
                    printConsole('Mevcut Komutlar:', 'sys');
                    printConsole('- set_energy <sayı>', 'sys');
                    printConsole('- set_score <sayı>', 'sys');
                    printConsole('- add_item <isim>', 'sys');
                    printConsole('- clear (Konsolu temizler)', 'sys');
                    printConsole('- eval <js> (Javascript kodu çalıştırır)', 'sys');
                    break;
                case 'set_energy':
                    if(args[1] !== undefined) {
                        gameState.energy = parseInt(args[1]) || 0;
                        uiElements.energy.textContent = gameState.energy;
                        printConsole(`Enerji ${gameState.energy} olarak ayarlandı.`, 'sys');
                    } else {
                        printConsole('Eksik parametre. Kullanım: set_energy <sayı>', 'error');
                    }
                    break;
                case 'set_score':
                    if(args[1] !== undefined) {
                        gameState.score = parseInt(args[1]) || 0;
                        if (gameState.score >= 1000000) {
                            const km2 = (gameState.score / 1000000).toLocaleString('tr-TR', { maximumFractionDigits: 3 });
                            uiElements.score.textContent = km2 + " km²";
                        } else {
                            uiElements.score.textContent = gameState.score.toLocaleString('tr-TR') + " m²";
                        }
                        printConsole(`Skor ${gameState.score} olarak ayarlandı.`, 'sys');
                    } else {
                        printConsole('Eksik parametre. Kullanım: set_score <sayı>', 'error');
                    }
                    break;
                case 'add_item':
                    const itemName = args.slice(1).join(' ') || 'Bilinmeyen Eşya';
                    
                    // Remove empty states if they exist
                    const emptyItems = storeContainer.querySelectorAll('.store-item.empty');
                    emptyItems.forEach(el => el.remove());

                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'store-item';
                    itemDiv.innerHTML = `<div class="item-icon">📦</div><div class="item-name">${itemName}</div><button class="btn btn-sm btn-outline">Al</button>`;
                    storeContainer.appendChild(itemDiv);
                    printConsole(`Mağazaya yeni öğe eklendi: ${itemName}`, 'sys');
                    break;
                case 'clear':
                    consoleOutput.innerHTML = '';
                    break;
                case 'eval':
                    const jsCode = args.slice(1).join(' ');
                    if(!jsCode) {
                        printConsole('Çalıştırılacak kod girilmedi.', 'error');
                        return;
                    }
                    const result = eval(jsCode);
                    printConsole(`Sonuç: ${result}`, 'sys');
                    break;
                default:
                    printConsole(`Bilinmeyen komut: ${cmd}. 'help' yazarak komutları görebilirsiniz.`, 'error');
            }
        } catch (err) {
            printConsole(`Hata: ${err.message}`, 'error');
        }
    }
    */

    // --- Multiplayer Socket Events ---
    if (socket) {
        socket.on('init_map', (mapState) => {
            window.serverMapState = mapState;
            // Clear current map graphics if we are re-syncing
            if (conqueredGridGroup) {
                conqueredGridGroup.clearLayers();
                window.gridCells = {};
                window.playerTerritories = {};
                if (window.territoryLayers) {
                    Object.values(window.territoryLayers).forEach(l => map.removeLayer(l));
                    window.territoryLayers = {};
                }
            }
            
            if (conqueredGridGroup) {
                for(const id in mapState) {
                    const coords = id.split('_');
                    const lat = parseFloat(coords[0]);
                    const lng = parseFloat(coords[1]);
                    drawConqueredCell(lat, lng, id, mapState[id].color, mapState[id].emoji, mapState[id].isCastle, mapState[id].owner, mapState[id].ownerName);
                }
            }
        });

        socket.on('cell_conquered', (data) => {
            if (window.serverMapState) {
                window.serverMapState[data.id] = { color: data.color, isCastle: data.isCastle, owner: data.owner, ownerName: data.ownerName };
            }
            const coords = data.id.split('_');
            const lat = parseFloat(coords[0]);
            const lng = parseFloat(coords[1]);
            drawConqueredCell(lat, lng, data.id, data.color, data.emoji, data.isCastle, data.owner, data.ownerName);
        });

        socket.on('player_wiped', (data) => {
            printConsole(`[!] Bir oyuncu kalesini kaybetti ve tüm toprakları silindi!`, 'error');
            if (data.email === gameState.email) {
                // We lost!
                gameState.score = 0;
                gameState.castleCellId = null;
                uiElements.score.textContent = "0 m²";
                alert("KALENİZ FETHEDİLDİ! Tüm topraklarınızı kaybettiniz.");
                spawnPlayer(); // Spawn again
            }
        });

        socket.on('leaderboard_update', (leaderboard) => {
            const listEl = document.getElementById('leaderboard-list');
            if (!listEl) return;
            listEl.innerHTML = '';
            leaderboard.forEach((player, index) => {
                const item = document.createElement('div');
                item.className = 'lb-item';
                let scoreText = player.score >= 1000000 ? 
                    (player.score / 1000000).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + " km²" : 
                    player.score.toLocaleString('tr-TR') + " m²";
                
                const onlineStatus = player.isOnline ? 
                    '<span style="color: #34c759; margin-right: 5px;">●</span>' : 
                    '<span style="color: #666; margin-right: 5px;">○</span>';

                item.innerHTML = `
                    <span class="lb-rank">${index + 1}</span>
                    <span class="lb-emoji">${player.emoji || '🏰'}</span>
                    <span class="lb-name" style="color: ${player.color}; flex-grow: 1;">${onlineStatus}${player.username}</span>
                    <div style="text-align: right; min-width: 60px;">
                        <span class="lb-score" style="display: block; font-size: 0.85rem;">${scoreText}</span>
                        <small style="color: #ff3b30; font-size: 0.7rem; font-weight: bold;">${player.kills || 0} Leş</small>
                    </div>
                `;
                listEl.appendChild(item);
            });
        });

        socket.on('global_leaderboard_update', (data) => {
            globalLbData = data;
            if (globalLbModal.style.display === 'flex') {
                renderGlobalLeaderboard();
            }
        });

        // --- Chat System Logic ---
        const chatInput = document.getElementById('chat-input');
        const chatMessages = document.getElementById('chat-messages');
        const btnSendChat = document.getElementById('btn-send-chat');

        function sendChatMessage() {
            const message = chatInput.value.trim();
            if (message && socket) {
                socket.emit('chat_message', { message });
                chatInput.value = '';
            }
        }

        if (chatInput) {
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    sendChatMessage();
                }
            });
        }

        if (btnSendChat) {
            btnSendChat.addEventListener('click', sendChatMessage);
        }

        socket.on('chat_message', (data) => {
            if (chatMessages) {
                // XSS koruması (Temel düzeyde)
                const safeMessage = data.message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                
                const msgDiv = document.createElement('div');
                msgDiv.className = 'chat-msg';
                msgDiv.innerHTML = `<span class="chat-msg-emoji">${data.emoji || '🏰'}</span> <span class="chat-msg-user" style="color: ${data.color}">${data.username}:</span> <span class="chat-msg-text">${safeMessage}</span>`;
                chatMessages.appendChild(msgDiv);
                
                // Otomatik aşağı kaydır
                chatMessages.scrollTop = chatMessages.scrollHeight;
                
                // Mesaj sayısı çok artarsa eskileri sil (Performans)
                if (chatMessages.children.length > 50) {
                    chatMessages.removeChild(chatMessages.children[1]); // İlk mesaj hoşgeldin mesajı kalsın
                }
            }
        });
    }

});
