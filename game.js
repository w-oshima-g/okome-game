class SoundEffectManager {
    constructor() {
        this.audioContext = null;
        this.soundEnabled = true;
        this.volume = 0.3; // デフォルト音量（30%）
        this.soundFiles = {
            drop: null,    // ドロップ音ファイル（後で設定可能）
            merge: null    // 合体音ファイル（後で設定可能）
        };
        
        // 保存された設定を読み込み
        this.loadSettings();
        
        this.initAudioContext();
    }
    
    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
            this.soundEnabled = false;
        }
    }
    
    // 音声ファイルを設定（後で音声ファイルに切り替える時用）
    setSoundFile(soundType, audioFilePath) {
        if (soundType in this.soundFiles) {
            const audio = new Audio(audioFilePath);
            audio.volume = this.volume;
            this.soundFiles[soundType] = audio;
            console.log(`Sound file set for ${soundType}:`, audioFilePath);
        }
    }
    
    // Web Audio APIで生成する効果音
    playDropSound() {
        if (!this.soundEnabled) return;
        
        // 音声ファイルが設定されている場合はそちらを再生
        if (this.soundFiles.drop) {
            this.playAudioFile('drop');
            return;
        }
        
        // Web Audio APIで生成するドロップ音（ポップな音）
        this.playGeneratedSound({
            type: 'drop',
            frequency: 400,      // 基本周波数
            frequency2: 600,     // 二番目の周波数
            duration: 0.15,      // 音の長さ
            attack: 0.01,        // アタック時間
            decay: 0.05,         // ディケイ時間
            sustain: 0.3,        // サスティンレベル
            release: 0.1         // リリース時間
        });
    }
    
    playMergeSound() {
        if (!this.soundEnabled) return;
        
        // 音声ファイルが設定されている場合はそちらを再生
        if (this.soundFiles.merge) {
            this.playAudioFile('merge');
            return;
        }
        
        // Web Audio APIで生成する合体音（上昇する音）
        this.playGeneratedSound({
            type: 'merge',
            frequency: 300,      // 開始周波数
            frequency2: 800,     // 終了周波数
            duration: 0.3,       // 音の長さ
            attack: 0.02,        // アタック時間
            decay: 0.1,          // ディケイ時間
            sustain: 0.5,        // サスティンレベル
            release: 0.15        // リリース時間
        });
    }
    
    playAudioFile(soundType) {
        try {
            const audio = this.soundFiles[soundType].cloneNode();
            audio.volume = this.volume;
            audio.play().catch(error => {
                console.warn(`Failed to play ${soundType} sound:`, error);
            });
        } catch (error) {
            console.warn(`Error playing ${soundType} audio file:`, error);
        }
    }
    
    playGeneratedSound(params) {
        if (!this.audioContext) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const oscillator2 = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const masterGain = this.audioContext.createGain();
            
            // メインオシレーター
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(params.frequency, this.audioContext.currentTime);
            
            // セカンドオシレーター（ハーモニー用）
            oscillator2.type = 'sine';
            oscillator2.frequency.setValueAtTime(params.frequency2 || params.frequency * 1.5, this.audioContext.currentTime);
            
            // 合体音の場合は周波数を上昇
            if (params.type === 'merge') {
                oscillator.frequency.exponentialRampToValueAtTime(
                    params.frequency2, 
                    this.audioContext.currentTime + params.duration * 0.7
                );
                oscillator2.frequency.exponentialRampToValueAtTime(
                    params.frequency2 * 1.5, 
                    this.audioContext.currentTime + params.duration * 0.7
                );
            }
            
            // エンベロープ設定
            const now = this.audioContext.currentTime;
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(1, now + params.attack);
            gainNode.gain.exponentialRampToValueAtTime(params.sustain, now + params.attack + params.decay);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + params.duration);
            
            // マスター音量
            masterGain.gain.setValueAtTime(this.volume, now);
            
            // 接続
            oscillator.connect(gainNode);
            oscillator2.connect(gainNode);
            gainNode.connect(masterGain);
            masterGain.connect(this.audioContext.destination);
            
            // 再生
            oscillator.start(now);
            oscillator2.start(now);
            oscillator.stop(now + params.duration);
            oscillator2.stop(now + params.duration);
            
        } catch (error) {
            console.warn('Error generating sound:', error);
        }
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        console.log('SE setVolume called:', volume, 'normalized:', this.volume, 'enabled:', this.soundEnabled);
        
        // 音声ファイルの音量も更新
        Object.values(this.soundFiles).forEach(audio => {
            if (audio) {
                audio.volume = this.volume;
            }
        });
        
        this.saveSettings();
    }
    
    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        this.saveSettings();
        return this.soundEnabled;
    }
    
    loadSettings() {
        const savedVolume = localStorage.getItem('okome-se-volume');
        const savedEnabled = localStorage.getItem('okome-se-enabled');
        
        if (savedVolume !== null) {
            this.volume = parseFloat(savedVolume);
        }
        if (savedEnabled !== null) {
            this.soundEnabled = savedEnabled === 'true';
        }
    }
    
    saveSettings() {
        localStorage.setItem('okome-se-volume', this.volume.toString());
        localStorage.setItem('okome-se-enabled', this.soundEnabled.toString());
    }
    
    // ユーザーインタラクション後にAudioContextを開始
    enableAfterUserGesture() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            const resumeContext = () => {
                this.audioContext.resume().then(() => {
                    console.log('Sound Effects AudioContext resumed');
                }).catch(error => {
                    console.warn('Failed to resume AudioContext:', error);
                });
            };
            
            // スマホ対応: 複数のイベントタイプに対応
            document.addEventListener('click', resumeContext, { once: true });
            document.addEventListener('touchstart', resumeContext, { once: true, passive: true });
            document.addEventListener('touchend', resumeContext, { once: true, passive: true });
        }
    }
}

class BGMManager {
    constructor(basePath = '') {
        this.basePath = basePath;
        this.bgmTracks = [
            'sound/okomebgm.mp3',
            'sound/okomebgm2.mp3',
            'sound/okomebgm3.mp3'
        ];
        this.currentTrackIndex = 0;
        this.currentAudio = null;
        this.volume = 0.25;
        this.isMuted = false;
        this.isPlaying = false;
        this.currentBGMIndex = 1;
        
        // 保存された設定を読み込み
        this.loadSettings();
        
        this.loadTrack();
    }
    
    loadTrack() {
        if (this.currentAudio) {
            this.currentAudio.pause();
        }
        
        // 再生状態をリセット
        this.isPlaying = false;
        
        const trackPath = this.basePath + '/' + this.bgmTracks[this.currentTrackIndex];
        console.log('Loading BGM track:', trackPath);
        
        this.currentAudio = new Audio(trackPath);
        this.currentAudio.loop = true;
        const initialVolume = this.isMuted ? 0 : this.volume;
        this.currentAudio.volume = initialVolume;
        console.log('Audio created with volume:', initialVolume, 'muted:', this.isMuted, 'base volume:', this.volume);
        
        this.currentAudio.addEventListener('canplaythrough', () => {
            console.log('BGM loaded:', this.bgmTracks[this.currentTrackIndex]);
            // デバッグ用alert
            if (window.location.search.includes('debug')) {
                alert('BGM loaded: ' + this.bgmTracks[this.currentTrackIndex]);
            }
        });
        
        this.currentAudio.addEventListener('error', (e) => {
            console.error('BGM load error:', e);
            // デバッグ用alert
            if (window.location.search.includes('debug')) {
                alert('BGM load error: ' + trackPath);
            }
        });
        
        this.currentAudio.addEventListener('loadstart', () => {
            console.log('BGM load started:', trackPath);
        });
    }
    
    play() {
        if (this.currentAudio) {
            console.log('Play method called, isPlaying:', this.isPlaying, 'volume:', this.currentAudio.volume);
            
            // デバッグ用alert
            if (window.location.search.includes('debug')) {
                alert('BGM play called - volume: ' + this.currentAudio.volume + ', muted: ' + this.isMuted);
            }
            
            const playPromise = this.currentAudio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    this.isPlaying = true;
                    this.updatePlayButton();
                    console.log('Playback started successfully');
                    
                    // デバッグ用alert
                    if (window.location.search.includes('debug')) {
                        alert('BGM started successfully');
                    }
                }).catch(error => {
                    console.log('Auto-play was prevented:', error);
                    
                    // デバッグ用alert
                    if (window.location.search.includes('debug')) {
                        alert('BGM play error: ' + error.message);
                    }
                });
            }
        } else {
            console.log('No currentAudio to play');
            
            // デバッグ用alert
            if (window.location.search.includes('debug')) {
                alert('No BGM audio loaded');
            }
        }
    }
    
    pause() {
        if (this.currentAudio && this.isPlaying) {
            this.currentAudio.pause();
            this.isPlaying = false;
            this.updatePlayButton();
        }
    }
    
    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }
    
    setVolume(volume) {
        this.volume = volume / 100;
        console.log('BGM setVolume called:', volume, 'normalized:', this.volume, 'muted:', this.isMuted);
        
        if (this.currentAudio) {
            const actualVolume = this.isMuted ? 0 : this.volume;
            this.currentAudio.volume = actualVolume;
            
            // 強制的に音量を再設定（ブラウザの制約対応）
            setTimeout(() => {
                if (this.currentAudio) {
                    this.currentAudio.volume = actualVolume;
                    console.log('Volume re-applied:', this.currentAudio.volume);
                    
                    // 音量設定が反映されたかチェック
                    if (Math.abs(this.currentAudio.volume - actualVolume) > 0.01) {
                        console.warn('Volume setting may be restricted by browser/device');
                        console.warn('Expected:', actualVolume, 'Actual:', this.currentAudio.volume);
                        
                        if (window.location.search.includes('debug')) {
                            alert('⚠️ Volume restriction detected!\nExpected: ' + actualVolume + '\nActual: ' + this.currentAudio.volume);
                        }
                    }
                }
            }, 100);
            
            console.log('BGM volume set to:', actualVolume, 'audio.volume:', this.currentAudio.volume);
            
            // 音声ファイルの詳細状態を確認
            console.log('Audio state:', {
                paused: this.currentAudio.paused,
                readyState: this.currentAudio.readyState,
                networkState: this.currentAudio.networkState,
                currentTime: this.currentAudio.currentTime,
                duration: this.currentAudio.duration,
                volume: this.currentAudio.volume
            });
            
            // デバッグ用alert
            if (window.location.search.includes('debug')) {
                alert('BGM volume: ' + volume + '% -> ' + actualVolume + 
                      ' (muted: ' + this.isMuted + 
                      ', paused: ' + this.currentAudio.paused +
                      ', readyState: ' + this.currentAudio.readyState + 
                      ', currentTime: ' + Math.round(this.currentAudio.currentTime) + 's)');
            }
        } else {
            console.warn('No currentAudio available for volume change');
            
            // デバッグ用alert
            if (window.location.search.includes('debug')) {
                alert('No BGM audio loaded for volume change');
            }
        }
        
        this.saveSettings();
    }
    
    toggleMute() {
        this.isMuted = !this.isMuted;
        console.log('BGM toggleMute called, now muted:', this.isMuted);
        
        if (this.currentAudio) {
            const newVolume = this.isMuted ? 0 : this.volume;
            this.currentAudio.volume = newVolume;
            
            // 強制的に音量を再設定（ブラウザの制約対応）
            setTimeout(() => {
                if (this.currentAudio) {
                    this.currentAudio.volume = newVolume;
                    console.log('Mute volume re-applied:', this.currentAudio.volume);
                }
            }, 100);
            
            console.log('BGM mute - volume set to:', newVolume, 'audio.volume:', this.currentAudio.volume);
            
            // デバッグ用alert
            if (window.location.search.includes('debug')) {
                alert('BGM mute toggled - muted: ' + this.isMuted + 
                      ', volume: ' + newVolume + 
                      ', audio.volume: ' + this.currentAudio.volume +
                      ', playing: ' + !this.currentAudio.paused);
            }
        } else {
            console.warn('No currentAudio available for mute toggle');
            
            // デバッグ用alert
            if (window.location.search.includes('debug')) {
                alert('No BGM audio loaded for mute toggle');
            }
        }
        
        this.updateMuteButton();
        this.saveSettings();
    }
    
    changeTrack(trackIndex) {
        const wasPlaying = this.isPlaying;
        console.log(`Changing track to index ${trackIndex}, was playing:`, wasPlaying);
        this.currentTrackIndex = trackIndex;
        this.loadTrack();
        if (wasPlaying) {
            console.log('Attempting to resume playback...');
            // 音声ファイルが読み込まれるまで待つ
            const attemptPlay = () => {
                console.log('Checking audio ready state:', this.currentAudio?.readyState);
                if (this.currentAudio && this.currentAudio.readyState >= 2) {
                    console.log('Audio ready, calling play()');
                    this.play();
                } else {
                    console.log('Audio not ready, retrying in 50ms');
                    setTimeout(attemptPlay, 50);
                }
            };
            attemptPlay();
        }
    }
    
    selectBGM(bgmNumber) {
        console.log(`BGM ${bgmNumber} selected, currently playing:`, this.isPlaying);
        this.changeTrack(bgmNumber - 1);
        this.currentBGMIndex = bgmNumber;
        this.updatePlayButton();
        this.saveSettings();
    }
    
    loadSettings() {
        const savedVolume = localStorage.getItem('okome-bgm-volume');
        const savedMuted = localStorage.getItem('okome-bgm-muted');
        const savedBGM = localStorage.getItem('okome-bgm-selection');
        
        if (savedVolume !== null) {
            this.volume = parseFloat(savedVolume);
        }
        if (savedMuted !== null) {
            this.isMuted = savedMuted === 'true';
        }
        if (savedBGM !== null) {
            this.currentBGMIndex = parseInt(savedBGM);
            this.currentTrackIndex = this.currentBGMIndex - 1;
        }
    }
    
    saveSettings() {
        localStorage.setItem('okome-bgm-volume', this.volume.toString());
        localStorage.setItem('okome-bgm-muted', this.isMuted.toString());
        localStorage.setItem('okome-bgm-selection', this.currentBGMIndex.toString());
    }
    
    setupControls(soundManager = null) {
        // 設定画面の要素
        const musicIcon = document.getElementById('musicIcon');
        const musicPopup = document.getElementById('musicPopup');
        const musicClose = document.getElementById('musicClose');
        
        // BGM関連の要素
        const bgmSelect = document.getElementById('bgmSelect');
        const volumeSlider = document.getElementById('volumeSlider');
        const playPauseBtn = document.getElementById('playPauseBtn');
        const muteBtn = document.getElementById('muteBtn');
        
        // 効果音関連の要素
        const sfxVolumeSlider = document.getElementById('sfxVolumeSlider');
        const sfxTestBtn = document.getElementById('sfxTestBtn');
        const sfxToggleBtn = document.getElementById('sfxToggleBtn');
        
        // 効果音マネージャーの参照を保存
        this.soundManager = soundManager;
        
        if (musicIcon) {
            musicIcon.addEventListener('click', () => {
                musicPopup.style.display = 'flex';
                
                // 設定画面を開いたときにBGMが再生されていなければ自動再生
                if (!this.isPlaying && this.currentAudio) {
                    console.log('Auto-starting BGM from music icon click');
                    this.play();
                }
            });
        }
        
        if (musicClose) {
            musicClose.addEventListener('click', () => {
                musicPopup.style.display = 'none';
            });
        }
        
        if (musicPopup) {
            musicPopup.addEventListener('click', (e) => {
                if (e.target === musicPopup) {
                    musicPopup.style.display = 'none';
                }
            });
        }
        
        if (bgmSelect) {
            bgmSelect.addEventListener('change', (e) => {
                this.changeTrack(parseInt(e.target.value));
            });
        }
        
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                const volume = parseInt(e.target.value);
                this.setVolume(volume); // setVolumeメソッド内で100で割る処理をする
                
                const percent = volume / 100;
                e.target.style.background = `linear-gradient(to right, #667eea 0%, #667eea ${percent * 100}%, #e0e0e0 ${percent * 100}%, #e0e0e0 100%)`;
            });
        }
        
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('Play/Pause button clicked, current state:', this.isPlaying);
                
                // デバッグ用alert
                if (window.location.search.includes('debug')) {
                    alert('Play/Pause clicked - currently playing: ' + this.isPlaying);
                }
                
                this.togglePlayPause();
            });
        }
        
        if (muteBtn) {
            muteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMute();
            });
        }
        
        // 効果音コントロール
        if (sfxVolumeSlider && this.soundManager) {
            sfxVolumeSlider.addEventListener('input', (e) => {
                const volume = parseInt(e.target.value);
                
                // スマホでAudioContextを再開
                if (this.soundManager.audioContext && this.soundManager.audioContext.state === 'suspended') {
                    this.soundManager.audioContext.resume().then(() => {
                        console.log('SE AudioContext resumed by slider');
                    });
                }
                
                this.soundManager.setVolume(volume / 100);
                
                // スライダーの視覚的更新
                const percent = volume / 100;
                e.target.style.background = `linear-gradient(to right, #f093fb 0%, #f093fb ${percent * 100}%, #e0e0e0 ${percent * 100}%, #e0e0e0 100%)`;
            });
        }

        // BGM選択機能
        const bgmOptions = document.querySelectorAll('.bgm-option');
        bgmOptions.forEach((option, index) => {
            option.addEventListener('click', () => {
                // 全てのオプションからactiveクラスを削除
                bgmOptions.forEach(opt => opt.classList.remove('active'));
                // クリックされたオプションにactiveクラスを追加
                option.classList.add('active');
                
                // BGMを変更して自動再生
                const bgmNumber = parseInt(option.dataset.bgm);
                console.log('BGM selected:', bgmNumber);
                
                // デバッグ用alert
                if (window.location.search.includes('debug')) {
                    alert('BGM selected: ' + bgmNumber);
                }
                
                this.selectBGM(bgmNumber);
                
                // 選択後に自動再生
                if (!this.isPlaying) {
                    setTimeout(() => {
                        console.log('Auto-starting selected BGM');
                        this.play();
                    }, 500);
                }
            });
        });

        // 初期選択状態を設定（現在のBGMに基づいて）
        if (bgmOptions.length > 0) {
            const currentBgmIndex = this.currentBGMIndex || 1;
            bgmOptions[currentBgmIndex - 1].classList.add('active');
        }

        // ミュートボタンのイベントハンドラー
        const bgmMuteBtn = document.getElementById('bgmMuteBtn');
        const seMuteBtn = document.getElementById('seMuteBtn');
        
        if (bgmMuteBtn) {
            bgmMuteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('BGM mute button clicked');
                
                // デバッグ用alert
                if (window.location.search.includes('debug')) {
                    alert('BGM mute button clicked - current muted: ' + this.isMuted);
                }
                
                this.toggleMute();
                this.updateBgmMuteButton();
            });
        } else {
            console.warn('BGM mute button not found');
        }
        
        if (seMuteBtn && this.soundManager) {
            seMuteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.soundManager.toggleSound();
                this.updateSeMuteButton();
            });
        }

        // UIを保存された設定で初期化
        this.initializeUI();
        
        if (sfxTestBtn && this.soundManager) {
            sfxTestBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.soundManager.playDropSound();
            });
        }
        
        if (sfxToggleBtn && this.soundManager) {
            sfxToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const enabled = this.soundManager.toggleSound();
                sfxToggleBtn.textContent = enabled ? '🔊 効果音OFF' : '🔇 効果音ON';
            });
        }
        
        this.updatePlayButton();
        this.updateMuteButton();
        this.updateSfxButton();
    }
    
    updatePlayButton() {
        const playPauseBtn = document.getElementById('playPauseBtn');
        if (playPauseBtn) {
            playPauseBtn.textContent = this.isPlaying ? '⏸ 停止' : '▶ 再生';
        }
    }
    
    updateMuteButton() {
        const muteBtn = document.getElementById('muteBtn');
        if (muteBtn) {
            muteBtn.textContent = this.isMuted ? '🔇 ミュート解除' : '🔊 ミュート';
        }
    }
    
    updateSfxButton() {
        const sfxToggleBtn = document.getElementById('sfxToggleBtn');
        if (sfxToggleBtn && this.soundManager) {
            sfxToggleBtn.textContent = this.soundManager.soundEnabled ? '🔊 効果音OFF' : '🔇 効果音ON';
        }
    }
    
    updateBgmMuteButton() {
        const bgmMuteBtn = document.getElementById('bgmMuteBtn');
        if (bgmMuteBtn) {
            bgmMuteBtn.textContent = this.isMuted ? '🔇' : '🔊';
            bgmMuteBtn.classList.toggle('muted', this.isMuted);
        }
    }
    
    updateSeMuteButton() {
        const seMuteBtn = document.getElementById('seMuteBtn');
        if (seMuteBtn && this.soundManager) {
            seMuteBtn.textContent = this.soundManager.soundEnabled ? '🔊' : '🔇';
            seMuteBtn.classList.toggle('muted', !this.soundManager.soundEnabled);
        }
    }
    
    initializeUI() {
        // 保存された設定でスライダーとボタンを初期化
        const volumeSlider = document.getElementById('volumeSlider');
        const sfxVolumeSlider = document.getElementById('sfxVolumeSlider');
        
        if (volumeSlider) {
            const volume = Math.round(this.volume * 100);
            volumeSlider.value = volume;
            const percent = volume / 100;
            volumeSlider.style.background = `linear-gradient(to right, #667eea 0%, #667eea ${percent * 100}%, #e0e0e0 ${percent * 100}%, #e0e0e0 100%)`;
        }
        
        if (sfxVolumeSlider && this.soundManager) {
            const volume = Math.round(this.soundManager.volume * 100);
            sfxVolumeSlider.value = volume;
            const percent = volume / 100;
            sfxVolumeSlider.style.background = `linear-gradient(to right, #f093fb 0%, #f093fb ${percent * 100}%, #e0e0e0 ${percent * 100}%, #e0e0e0 100%)`;
        }
        
        this.updateBgmMuteButton();
        this.updateSeMuteButton();
        this.updatePlayButton();
        
        console.log('UI initialized - BGM volume:', this.volume, 'muted:', this.isMuted, 'playing:', this.isPlaying);
    }
    
    enableUserInteraction() {
        // BGM自動再生のためのイベントリスナーを設定
        // 音量調整要素も含める
        const targetElements = [
            'musicIcon', 'playPauseBtn', 'pauseIcon', 'resetIcon', 'helpIcon',
            'volumeSlider', 'bgmMuteBtn', 'sfxVolumeSlider', 'seMuteBtn'
        ];
        
        const handleFirstInteraction = (event) => {
            // 対象となるUI要素かチェック
            const isTargetElement = targetElements.some(id => {
                const element = document.getElementById(id);
                return element && (event.target === element || element.contains(event.target));
            }) || event.target.classList.contains('volume-slider') || event.target.classList.contains('volume-mute-btn');
            
            if (isTargetElement) {
                console.log('User interaction detected for audio context');
                
                // Sound Effects AudioContext を初期化
                if (this.soundManager && this.soundManager.audioContext && this.soundManager.audioContext.state === 'suspended') {
                    this.soundManager.audioContext.resume().then(() => {
                        console.log('AudioContext resumed for sound effects');
                    });
                }
                
                // リスナーを削除（一度だけ実行）
                document.removeEventListener('click', handleFirstInteraction);
                document.removeEventListener('touchstart', handleFirstInteraction);
                document.removeEventListener('input', handleFirstInteraction);
            }
        };
        
        // モバイル対応のイベントリスナー
        document.addEventListener('click', handleFirstInteraction);
        document.addEventListener('touchstart', handleFirstInteraction, { passive: true });
        document.addEventListener('input', handleFirstInteraction, { passive: true });
    }
}

class OkomeGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.score = 0;
        this.bestScore = localStorage.getItem('okome-best-score') || 0;
        this.gameRunning = true;
        this.nextDogType = 1;
        this.canDrop = true;
        this.gameLoopRunning = false;
        this.droppedDogs = new Set(); // 落下中の犬を追跡
        this.mouseX = 200; // マウスX座標を保存
        this.isPaused = false;
        
        // GitHub Pages対応: ベースパスを設定
        this.basePath = location.hostname.includes('github.io') && location.pathname.includes('/okome-game/') 
            ? '/okome-game' : '';
        console.log('Base path set to:', this.basePath, 'hostname:', location.hostname, 'pathname:', location.pathname);
        
        // 効果音マネージャー初期化
        this.soundManager = new SoundEffectManager();
        
        // BGMマネージャー初期化（効果音マネージャーの参照を渡す）
        this.bgmManager = new BGMManager(this.basePath);
        this.bgmManager.setupControls(this.soundManager);
        
        // スイカゲームと同じスコア体系
        this.dogTypes = [
            { type: 1, width: 20, height: 24, image: null, score: 1 },     // チェリー相当
            { type: 2, width: 26, height: 31, image: null, score: 3 },     // いちご相当
            { type: 3, width: 34, height: 41, image: null, score: 6 },     // みかん相当
            { type: 4, width: 44, height: 53, image: null, score: 10 },    // レモン相当
            { type: 5, width: 57, height: 68, image: null, score: 15 },    // キウイ相当
            { type: 6, width: 74, height: 89, image: null, score: 21 },    // トマト相当
            { type: 7, width: 96, height: 115, image: null, score: 28 },   // 桃相当
            { type: 8, width: 125, height: 150, image: null, score: 36 },  // パイン相当
            { type: 9, width: 162, height: 194, image: null, score: 45 },  // メロン相当
            { type: 10, width: 211, height: 253, image: null, score: 55 }, // スイカ相当
            { type: 11, width: 274, height: 329, image: null, score: 66 }  // 特大スイカ
        ];
        
        this.previewImage = new Image();
        
        this.init();
    }
    
    async init() {
        console.log('Initializing game...');
        await this.loadImages();
        this.setupPhysics();
        this.setupEvents();
        // 初期の犬を作成
        this.createNextDog(this.mouseX);
        this.gameLoop();
        // BGM自動再生のための準備
        this.bgmManager.enableUserInteraction();
        // 効果音の準備
        this.soundManager.enableAfterUserGesture();
        
        // 音声ファイルを使用する場合の設定例（コメントアウト）
        // this.soundManager.setSoundFile('drop', `${this.basePath}/sound/drop.wav`);
        // this.soundManager.setSoundFile('merge', `${this.basePath}/sound/merge.wav`);
        
        console.log('Game initialization complete');
    }
    
    async loadImages() {
        // 全ての画像を同期的に読み込み（UI表示のため）
        const loadPromises = this.dogTypes.map((dogType, index) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    dogType.image = img;
                    console.log(`Loaded image: okome${dogType.type}.png`);
                    resolve();
                };
                img.onerror = () => {
                    console.error(`Failed to load image: okome${dogType.type}.png`);
                    resolve();
                };
                img.src = `${this.basePath}/image/okome${dogType.type}.png`;
            });
        });
        
        await Promise.all(loadPromises);
        console.log('All images loaded successfully');
        
        // 読み込み完了後にUIを更新
        this.updateNextPreview();
        this.updateScore(); // ベストスコアを初期表示
    }
    
    loadSingleImage(dogType) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                dogType.image = img;
                console.log(`Single image loaded: okome${dogType.type}.png`);
                resolve();
            };
            img.onerror = () => {
                console.error(`Failed to load single image: okome${dogType.type}.png`);
                resolve();
            };
            img.src = `${this.basePath}/image/okome${dogType.type}.png`;
        });
    }
    
    setupPhysics() {
        const Engine = Matter.Engine;
        const Render = Matter.Render;
        const World = Matter.World;
        const Bodies = Matter.Bodies;
        const Events = Matter.Events;
        
        this.engine = Engine.create();
        this.world = this.engine.world;
        
        // コリジョンカテゴリを定義
        this.collisionCategories = {
            WALL: 0x0001,           // 壁
            DROPPED_DOG: 0x0002,    // ドロップ済みの犬
            PREVIEW_DOG: 0x0004     // ドロップ前の犬（プレビュー）
        };
        
        // 物理エンジンの設定を最適化（落下確実性優先）
        this.engine.world.gravity.y = 0.8; // 重力をややマイルドに
        this.engine.constraintIterations = 4; // 制約の反復を増加
        this.engine.positionIterations = 8;   // 位置の反復を増加
        this.engine.velocityIterations = 6;   // 速度の反復を増加
        this.engine.enableSleeping = false;   // スリープを無効化して物理計算を確実に
        
        // 壁の位置を調整（犬が止まらないように）
        const walls = [
            Bodies.rectangle(200, 610, 400, 20, { 
                isStatic: true,
                friction: 0.3,     // 地面の摩擦を適度に
                restitution: 0.05, // 地面での跳ね返りを大幅に減らす
                collisionFilter: {
                    category: this.collisionCategories.WALL,
                    mask: this.collisionCategories.DROPPED_DOG | this.collisionCategories.PREVIEW_DOG
                }
            }),
            Bodies.rectangle(-10, 300, 20, 600, { 
                isStatic: true,
                friction: 0.2,     // 壁の摩擦を減らして転がりやすく
                restitution: 0.1,  // 壁での跳ね返りを大幅に減らす
                collisionFilter: {
                    category: this.collisionCategories.WALL,
                    mask: this.collisionCategories.DROPPED_DOG | this.collisionCategories.PREVIEW_DOG
                }
            }),
            Bodies.rectangle(410, 300, 20, 600, { 
                isStatic: true,
                friction: 0.2,     // 壁の摩擦を減らして転がりやすく
                restitution: 0.1,  // 壁での跳ね返りを大幅に減らす
                collisionFilter: {
                    category: this.collisionCategories.WALL,
                    mask: this.collisionCategories.DROPPED_DOG | this.collisionCategories.PREVIEW_DOG
                }
            })
        ];
        
        World.add(this.world, walls);
        
        this.dropLine = 50;
        this.currentDog = null;
        this.dogs = [];
        
        // コリジョンフィルターで不要な計算を削減
        Events.on(this.engine, 'collisionStart', (event) => {
            // コリジョンペアをフィルタリングして無駄な処理を減らす
            const validPairs = event.pairs.filter(pair => {
                const bodyA = pair.bodyA;
                const bodyB = pair.bodyB;
                const dogA = this.dogs.find(d => d.body === bodyA);
                const dogB = this.dogs.find(d => d.body === bodyB);
                return dogA && dogB && dogA.type === dogB.type && dogA.type < 11;
            });
            
            if (validPairs.length > 0) {
                this.handleCollisions(validPairs);
            }
        });
        
        this.runner = Matter.Runner.create();
        // タイミング最適化
        this.runner.delta = 1000 / 60; // 60FPS固定
        Matter.Runner.run(this.runner, this.engine);
        
        console.log('Physics engine setup complete - gravity:', this.engine.world.gravity.y, 'sleeping:', this.engine.enableSleeping);
    }
    
    setupEvents() {
        // マウスイベント
        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.gameRunning) return;
            
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = Math.max(30, Math.min(370, e.clientX - rect.left));
            
            if (this.currentDog) {
                const dogHeight = this.currentDog.height || 50; // フォールバック値
                const safeY = this.calculateSafeDropPosition(this.mouseX, dogHeight);
                Matter.Body.setPosition(this.currentDog.body, { x: this.mouseX, y: safeY });
            }
        });
        
        // タッチイベント
        this.canvas.addEventListener('touchmove', (e) => {
            if (!this.gameRunning) return;
            e.preventDefault(); // スクロール防止
            
            const rect = this.canvas.getBoundingClientRect();
            const touch = e.touches[0];
            this.mouseX = Math.max(30, Math.min(370, touch.clientX - rect.left));
            
            if (this.currentDog) {
                const dogHeight = this.currentDog.height || 50; // フォールバック値
                const safeY = this.calculateSafeDropPosition(this.mouseX, dogHeight);
                Matter.Body.setPosition(this.currentDog.body, { x: this.mouseX, y: safeY });
            }
        }, { passive: false });
        
        // クリックイベント（PC用）
        this.canvas.addEventListener('click', (e) => {
            if (!this.gameRunning || this.isPaused) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const clickX = Math.max(30, Math.min(370, e.clientX - rect.left));
            
            // クリック位置に犬を移動してからドロップ
            if (this.currentDog) {
                this.mouseX = clickX;
                const dogHeight = this.currentDog.height || 50; // フォールバック値
                const safeY = this.calculateSafeDropPosition(this.mouseX, dogHeight);
                Matter.Body.setPosition(this.currentDog.body, { x: this.mouseX, y: safeY });
                console.log('Click drop at position:', this.mouseX, 'safeY:', safeY);
            }
            this.dropDogWithFeedback();
        });
        
        // タッチイベント（スマホ用）
        let touchStarted = false;
        
        this.canvas.addEventListener('touchstart', (e) => {
            if (!this.gameRunning || this.isPaused) return;
            e.preventDefault();
            touchStarted = true;
            
            const rect = this.canvas.getBoundingClientRect();
            const touch = e.touches[0];
            const touchX = Math.max(30, Math.min(370, touch.clientX - rect.left));
            
            console.log('Touch start at:', touchX, 'current mouseX:', this.mouseX);
            
            // タッチ位置に犬を移動
            if (this.currentDog) {
                this.mouseX = touchX;
                const dogHeight = this.currentDog.height || 50; // フォールバック値
                const safeY = this.calculateSafeDropPosition(this.mouseX, dogHeight);
                Matter.Body.setPosition(this.currentDog.body, { x: this.mouseX, y: safeY });
                console.log('Dog moved to touch position:', this.mouseX, 'safeY:', safeY);
            }
        }, { passive: false });
        
        this.canvas.addEventListener('touchend', (e) => {
            if (!this.gameRunning || this.isPaused || !touchStarted) return;
            e.preventDefault();
            touchStarted = false;
            
            console.log('Touch end - dropping at position:', this.mouseX);
            this.dropDogWithFeedback();
        }, { passive: false });
        
        // 新しい円形アイコンのイベントリスナー
        document.getElementById('resetIcon').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Reset icon clicked');
            this.restart();
        });
        
        document.getElementById('pauseIcon').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Pause icon clicked');
            this.togglePause();
        });
        
        document.getElementById('helpIcon').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Help icon clicked');
            this.showHelp();
        });
        
        document.getElementById('helpClose').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.hideHelp();
        });
        
        // ヘルプポップアップの背景クリックで閉じる
        document.getElementById('helpPopup').addEventListener('click', (e) => {
            if (e.target.id === 'helpPopup') {
                this.hideHelp();
            }
        });
        
        // 旧ボタンとの互換性
        const dropBtn = document.getElementById('dropButton');
        const restartBtn = document.getElementById('restartButton');
        if (dropBtn) dropBtn.addEventListener('click', () => this.dropDogWithFeedback());
        if (restartBtn) restartBtn.addEventListener('click', () => this.restart());
        
        document.getElementById('playAgainButton').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Play again button clicked');
            this.restart();
        });
        
        this.createNextDog(this.mouseX);
    }
    
    // 触覚フィードバック
    vibrate(pattern) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    }
    
    // フィードバック付きドロップ
    dropDogWithFeedback() {
        if (this.isPaused) {
            console.log('Game is paused, dropping disabled');
            return;
        }
        console.log('dropDogWithFeedback called at position:', this.mouseX);
        this.vibrate(50); // 50ms振動
        this.dropDog();
    }
    
    createNextDog(x = 200) {
        if (this.currentDog) {
            console.log('Current dog already exists, removing old one');
            if (this.currentDog.body && this.world) {
                Matter.World.remove(this.world, this.currentDog.body);
            }
        }
        
        const dogConfig = this.dogTypes.find(d => d.type === this.nextDogType);
        if (!dogConfig) {
            console.log('Dog config not found for type:', this.nextDogType);
            return;
        }
        
        console.log(`Creating dog type ${this.nextDogType} at x: ${x}`);
        
        // 大きい犬ほど重く、摩擦が大きくなるように調整
        const sizeRatio = dogConfig.width / 20; // 最小サイズ（20px）との比率
        // 積まれた犬の最高点を計算して安全な位置を決定
        const safeDropY = this.calculateSafeDropPosition(x, dogConfig.height);
        
        const body = Matter.Bodies.rectangle(x, safeDropY, dogConfig.width, dogConfig.height, {
            isStatic: true, // 初期は静的状態
            restitution: 0.15, // 反発係数を大幅に減らして跳ね上がりを抑制
            friction: 0.4,     // 摩擦を減らして転がりやすく
            frictionAir: 0.01, // 空気摩擦を減らして必ず落下させる
            density: 0.001 + sizeRatio * 0.0005, // 密度を適切に設定
            chamfer: { radius: dogConfig.width * 0.25 },
            // 落下を確実にするための追加設定
            sleepThreshold: Infinity, // スリープしない
            inertia: Infinity, // 慣性を防ぐ
            // プレビュー犬は他の犬との衝突判定を無効化
            collisionFilter: {
                category: this.collisionCategories.PREVIEW_DOG,
                mask: this.collisionCategories.WALL // 壁とのみ衝突
            }
        });
        
        const dog = {
            body: body,
            type: this.nextDogType,
            width: dogConfig.width,
            height: dogConfig.height,
            image: dogConfig.image,
            score: dogConfig.score,
            config: dogConfig
        };
        
        Matter.World.add(this.world, body);
        this.currentDog = dog;
        console.log('Created new dog:', dog.type, 'at position:', body.position, 'isStatic:', body.isStatic);
        
        this.nextDogType = Math.min(5, Math.floor(Math.random() * 5) + 1);
        this.updateNextPreview();
    }
    
    calculateSafeDropPosition(x, dogHeight) {
        // 指定されたX位置周辺の犬の最高点を計算
        const searchRadius = 80; // 検索範囲（ピクセル）
        let highestPoint = this.canvas.height; // キャンバスの底から開始
        
        // 積まれた犬たちの中で、X位置周辺にある犬の最高点を探す
        this.dogs.forEach(dog => {
            if (!dog.body) return;
            
            const dogX = dog.body.position.x;
            const dogY = dog.body.position.y;
            const currentDogHeight = dog.height || 50;
            
            // X位置が検索範囲内にある犬を対象とする
            if (Math.abs(dogX - x) <= searchRadius) {
                const dogTop = dogY - currentDogHeight / 2;
                if (dogTop < highestPoint) {
                    highestPoint = dogTop;
                }
            }
        });
        
        // 安全マージンを設けてcurrentDogの位置を決定
        const safetyMargin = dogHeight + 40; // 犬の高さ + 40px の余裕
        const safeY = Math.min(this.dropLine, highestPoint - safetyMargin);
        
        // 最低でも画面上端から10px、最高でもdropLineの位置
        const finalY = Math.max(10, Math.min(this.dropLine, safeY));
        
        console.log(`Safe drop position: x=${x}, finalY=${finalY}, highestPoint=${highestPoint}, margin=${safetyMargin}`);
        return finalY;
    }
    
    dropDog() {
        console.log('dropDog called with state:', {
            currentDog: !!this.currentDog,
            gameRunning: this.gameRunning,
            canDrop: this.canDrop,
            currentDogStatic: this.currentDog ? this.currentDog.body.isStatic : 'no dog',
            mouseX: this.mouseX
        });
        
        if (!this.currentDog || !this.gameRunning || !this.canDrop) {
            console.log('Cannot drop - conditions not met');
            return;
        }
        
        // ドロップ前に最新の位置に移動してから落とす
        if (this.currentDog.body.position.x !== this.mouseX) {
            const dogHeight = this.currentDog.height || 50; // フォールバック値
            const safeY = this.calculateSafeDropPosition(this.mouseX, dogHeight);
            Matter.Body.setPosition(this.currentDog.body, { x: this.mouseX, y: safeY });
            console.log('Updated dog position before drop to:', this.mouseX, 'safeY:', safeY);
        }
        
        console.log('Dropping dog at final position:', this.currentDog.body.position);
        
        // 連打防止
        this.canDrop = false;
        
        // 物理ボディを動的に変更（落下させる）
        Matter.Body.setStatic(this.currentDog.body, false);
        
        // ドロップ効果音を再生
        this.soundManager.playDropSound();
        
        // ドロップ時にコリジョンカテゴリを変更（他の犬と衝突可能に）
        this.currentDog.body.collisionFilter.category = this.collisionCategories.DROPPED_DOG;
        this.currentDog.body.collisionFilter.mask = this.collisionCategories.WALL | this.collisionCategories.DROPPED_DOG;
        
        // 落下を確実にするための追加処理
        Matter.Body.setVelocity(this.currentDog.body, { x: 0, y: 0.1 }); // 小さな初速度を与えて落下を開始
        Matter.Body.setAngularVelocity(this.currentDog.body, 0); // 回転をリセット
        
        // スリープを無効化して物理計算を継続
        Matter.Sleeping.set(this.currentDog.body, false);
        
        console.log('Dog set to dynamic with initial velocity, should start falling');
        
        // 落下中の犬として記録（一定時間後に削除）
        const droppedDogId = this.currentDog.body.id;
        this.droppedDogs.add(droppedDogId);
        setTimeout(() => {
            this.droppedDogs.delete(droppedDogId);
        }, 2000); // 2秒間は落下中として扱う
        
        this.dogs.push(this.currentDog);
        this.currentDog = null;
        
        setTimeout(() => {
            if (this.gameRunning) {
                // 次の犬はドロップした位置で作成
                this.createNextDog(this.mouseX);
                this.canDrop = true;
                console.log('Next dog created at position:', this.mouseX);
            }
        }, 800);
        
        setTimeout(() => {
            this.checkGameOver();
        }, 3000);
    }
    
    handleCollisions(pairs) {
        // 重複したマージを防ぐためのセット
        const processedPairs = new Set();
        
        pairs.forEach(pair => {
            const bodyA = pair.bodyA;
            const bodyB = pair.bodyB;
            
            // 既に処理されたペアをスキップ
            const pairKey = `${Math.min(bodyA.id, bodyB.id)}-${Math.max(bodyA.id, bodyB.id)}`;
            if (processedPairs.has(pairKey)) return;
            processedPairs.add(pairKey);
            
            const dogA = this.dogs.find(d => d.body === bodyA);
            const dogB = this.dogs.find(d => d.body === bodyB);
            
            if (dogA && dogB && dogA.type === dogB.type && dogA.type < 11) {
                // マージ処理を次のフレームに遅延してパフォーマンス向上
                requestAnimationFrame(() => {
                    if (this.dogs.includes(dogA) && this.dogs.includes(dogB)) {
                        this.mergeDogs(dogA, dogB);
                    }
                });
            }
        });
    }
    
    mergeDogs(dogA, dogB) {
        const newType = dogA.type + 1;
        const newConfig = this.dogTypes.find(d => d.type === newType);
        if (!newConfig) return;
        
        // 合体効果音を再生
        this.soundManager.playMergeSound();
        
        const centerX = (dogA.body.position.x + dogB.body.position.x) / 2;
        const centerY = Math.min(dogA.body.position.y, dogB.body.position.y);
        
        Matter.World.remove(this.world, [dogA.body, dogB.body]);
        
        this.dogs = this.dogs.filter(d => d !== dogA && d !== dogB);
        
        // 合体後の犬も同様にサイズ比率に応じた物理特性
        const newSizeRatio = newConfig.width / 20;
        const newBody = Matter.Bodies.rectangle(centerX, centerY, newConfig.width, newConfig.height, {
            restitution: Math.max(0.1, 0.2 - newSizeRatio * 0.01), // 反発を大幅に減らす
            friction: Math.max(0.3, 0.5 - newSizeRatio * 0.02),   // 摩擦も減らして転がりやすく
            frictionAir: 0.005 + newSizeRatio * 0.002,
            density: 0.0008 + newSizeRatio * 0.0002,
            chamfer: { radius: newConfig.width * 0.25 },
            // マージで作成された犬も他の犬と衝突可能
            collisionFilter: {
                category: this.collisionCategories.DROPPED_DOG,
                mask: this.collisionCategories.WALL | this.collisionCategories.DROPPED_DOG
            }
        });
        
        const newDog = {
            body: newBody,
            type: newType,
            width: newConfig.width,
            height: newConfig.height,
            image: newConfig.image,
            score: newConfig.score
        };
        
        // 合体で生成された犬も一時的に落下中として扱う
        this.droppedDogs.add(newBody.id);
        setTimeout(() => {
            this.droppedDogs.delete(newBody.id);
        }, 1500);
        
        Matter.World.add(this.world, newBody);
        this.dogs.push(newDog);
        
        // スイカゲームと同じスコア計算：合体した犬のレベルに応じた固定スコア
        const mergeScore = this.calculateMergeScore(newType);
        this.score += mergeScore;
        this.updateScore();
        
        console.log(`Merged to level ${newType}, score added: ${mergeScore}`);
        
        // 合体の触覚フィードバック
        this.vibrate([100, 50, 100]);
        
        // 最高レベル達成時の特別処理
        if (newType === 11) {
            // 特大スイカ達成ボーナス
            this.score += 5000;
            this.updateScore();
            console.log('Maximum level achieved! Bonus: 5000 points');
            // 最終合体の特別な触覚フィードバック
            this.vibrate([200, 100, 200, 100, 200]);
        }
    }
    
    // スイカゲームと同じスコア計算ロジック
    calculateMergeScore(level) {
        // スイカゲームの標準的なスコアテーブル
        const scoreTable = {
            1: 1,      // チェリー相当 -> いちご
            2: 3,      // いちご相当 -> みかん
            3: 6,      // みかん相当 -> レモン
            4: 10,     // レモン相当 -> キウイ
            5: 15,     // キウイ相当 -> トマト
            6: 21,     // トマト相当 -> 桃
            7: 28,     // 桃相当 -> パイン
            8: 36,     // パイン相当 -> メロン
            9: 45,     // メロン相当 -> スイカ
            10: 55,    // スイカ相当 -> 特大スイカ
            11: 66     // 特大スイカ（最高レベル）
        };
        
        return scoreTable[level] || 0;
    }
    
    checkGameOver() {
        if (!this.gameRunning) return;
        
        // パフォーマンス最適化: 間引き処理であまり頻繁にチェックしない
        if (this.lastGameOverCheck && performance.now() - this.lastGameOverCheck < 500) {
            return; // 500ms間隔でチェック
        }
        this.lastGameOverCheck = performance.now();
        
        const safetyMargin = 30;
        
        // 落下中ではない犬をチェック（スリープ無効化で速度で判定）
        const stationaryDogs = this.dogs.filter(dog => {
            if (this.droppedDogs.has(dog.body.id)) return false;
            
            // 速度で静止状態を判定（スリープ機能の代わり）
            const velocity = Matter.Vector.magnitude(dog.body.velocity);
            const angularVelocity = Math.abs(dog.body.angularVelocity);
            return velocity < 0.5 && angularVelocity < 0.1;
        });
        
        for (let dog of stationaryDogs) {
            if (dog.body.position.y < this.dropLine + safetyMargin) {
                console.log('Game over - dog at position:', dog.body.position.y, 'velocity:', Matter.Vector.magnitude(dog.body.velocity));
                this.gameOver();
                return;
            }
        }
    }
    
    gameOver() {
        console.log('Game over triggered');
        this.gameRunning = false;
        
        // ゲームオーバーの触覚フィードバック
        this.vibrate([300, 200, 300]);
        
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOver').style.display = 'flex';
    }
    
    togglePause() {
        this.isPaused = !this.isPaused;
        console.log('Game paused:', this.isPaused);
        
        const pauseIcon = document.getElementById('pauseIcon').querySelector('.icon-symbol');
        pauseIcon.textContent = this.isPaused ? '▶' : '⏸';
        
        if (this.isPaused) {
            if (this.runner) {
                Matter.Runner.stop(this.runner);
            }
        } else {
            if (this.runner) {
                Matter.Runner.run(this.runner, this.engine);
            }
        }
    }
    
    restart() {
        console.log('Restarting game...');
        
        // ゲーム状態をリセット
        this.gameRunning = false;
        this.isPaused = false;
        const pauseIcon = document.getElementById('pauseIcon').querySelector('.icon-symbol');
        pauseIcon.textContent = '⏸';
        
        this.score = 0;
        this.updateScore();
        document.getElementById('gameOver').style.display = 'none';
        
        // メモリリーク防止: イベントリスナーをクリア
        if (this.engine && this.engine.events) {
            Matter.Events.off(this.engine, 'collisionStart');
        }
        
        // 物理エンジンを停止・クリア
        if (this.runner) {
            Matter.Runner.stop(this.runner);
        }
        
        // 全てのボディを正しく削除
        const allBodies = [...this.dogs.map(d => d.body)];
        if (this.currentDog) {
            allBodies.push(this.currentDog.body);
        }
        
        allBodies.forEach(body => {
            if (body && this.world) {
                Matter.World.remove(this.world, body, true); // 強制削除
            }
        });
        
        // メモリリーク防止: 参照をクリア
        this.dogs.length = 0; // 配列をクリアしつつメモリを解放
        this.currentDog = null;
        this.droppedDogs.clear();
        
        // キャッシュをクリア
        this.cachedColors = null;
        this.responsiveCache = null;
        this.redLineDrawn = false;
        this.lastFrameTime = null;
        this.lastGameOverCheck = null;
        
        Matter.World.clear(this.world, true);
        Matter.Engine.clear(this.engine);
        
        // 物理エンジンを再初期化
        this.setupPhysics();
        
        // ゲーム再開
        this.gameRunning = true;
        this.canDrop = true;
        
        // 少し遅らせて犬を作成（物理エンジンの初期化を待つ）
        setTimeout(() => {
            this.createNextDog(this.mouseX);
        }, 100);
        
        // ゲームループを再開
        if (!this.gameLoopRunning) {
            this.gameLoop();
        }
        
        console.log('Game restarted successfully');
    }
    
    updateScore() {
        document.getElementById('score').textContent = this.score;
        
        // ベストスコア更新チェック
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('okome-best-score', this.bestScore);
        }
        document.getElementById('bestScoreValue').textContent = this.bestScore;
    }
    
    updateNextPreview() {
        const nextConfig = this.dogTypes.find(d => d.type === this.nextDogType);
        const nextImageEl = document.getElementById('nextImage');
        
        console.log(`Updating next preview for type: ${this.nextDogType}`);
        console.log(`Next config image exists: ${nextConfig && nextConfig.image ? 'yes' : 'no'}`);
        
        if (nextConfig && nextConfig.image) {
            nextImageEl.src = nextConfig.image.src;
            nextImageEl.style.display = 'block';
            console.log('Next preview updated with actual image');
        } else {
            // メモリ最適化: canvasをキャッシュして再利用
            if (!this.previewCanvas) {
                this.previewCanvas = document.createElement('canvas');
                this.previewCanvas.width = 50;
                this.previewCanvas.height = 50;
                this.previewCtx = this.previewCanvas.getContext('2d');
            }
            
            const ctx = this.previewCtx;
            ctx.clearRect(0, 0, 50, 50);
            
            if (!this.cachedColors) {
                this.cachedColors = [
                    '#ffb3ba', '#ffdfba', '#ffffba', '#baffc9',
                    '#bae1ff', '#c9baff', '#ffbac9', '#ffd4ba',
                    '#d4ffba', '#baffdf', '#bac9ff'
                ];
            }
            
            const scaleW = 40 / nextConfig.width;
            const scaleH = 40 / nextConfig.height;
            const scale = Math.min(scaleW, scaleH);
            const displayW = nextConfig.width * scale;
            const displayH = nextConfig.height * scale;
            
            ctx.fillStyle = this.cachedColors[this.nextDogType - 1] || '#ffb3ba';
            ctx.beginPath();
            ctx.ellipse(25, 25, displayW / 2, displayH / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.fillStyle = '#333';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.nextDogType.toString(), 25, 25);
            
            nextImageEl.src = this.previewCanvas.toDataURL();
            nextImageEl.style.display = 'block';
            console.log('Next preview updated with placeholder');
        }
    }
    
    gameLoop() {
        this.gameLoopRunning = true;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 赤いラインを毎フレーム描画（視認性向上）
        this.ctx.strokeStyle = '#ff6b6b';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([8, 4]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.dropLine + 30);
        this.ctx.lineTo(this.canvas.width, this.dropLine + 30);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // 犬の描画
        this.dogs.forEach(dog => {
            this.drawDog(dog);
        });
        
        if (this.currentDog) {
            this.drawDog(this.currentDog);
        }
        
        if (this.gameRunning) {
            requestAnimationFrame(() => this.gameLoop());
        } else {
            this.gameLoopRunning = false;
        }
    }
    
    drawDog(dog) {
        const pos = dog.body.position;
        const width = dog.width;
        const height = dog.height;
        const angle = dog.body.angle;
        
        // 回転が小さい場合はスキップ（パフォーマンス向上）
        const shouldRotate = Math.abs(angle) > 0.01;
        
        this.ctx.save();
        this.ctx.translate(pos.x, pos.y);
        if (shouldRotate) {
            this.ctx.rotate(angle);
        }
        
        if (dog.image) {
            // イメージスムージングを制御（必要な場合のみ有効）
            if (width > dog.image.width || height > dog.image.height) {
                this.ctx.imageSmoothingEnabled = true;
                this.ctx.imageSmoothingQuality = 'medium';
            } else {
                this.ctx.imageSmoothingEnabled = false;
            }
            
            this.ctx.drawImage(
                dog.image,
                -width / 2,
                -height / 2,
                width,
                height
            );
        } else {
            // 画像がない場合のプレースホルダー（キャッシュされた色配列使用）
            if (!this.cachedColors) {
                this.cachedColors = [
                    '#ffb3ba', '#ffdfba', '#ffffba', '#baffc9',
                    '#bae1ff', '#c9baff', '#ffbac9', '#ffd4ba',
                    '#d4ffba', '#baffdf', '#bac9ff'
                ];
            }
            
            this.ctx.fillStyle = this.cachedColors[dog.type - 1] || '#ffb3ba';
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.strokeStyle = '#333';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            if (shouldRotate) {
                this.ctx.rotate(-angle);
            }
            this.ctx.fillStyle = '#333';
            this.ctx.font = `${Math.min(width, height) / 3}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(dog.type.toString(), 0, 0);
        }
        
        this.ctx.restore();
    }
    
    // ヘルプ用の成長の輪を作成
    createGrowthCircle(containerId = 'helpGrowthCircle') {
        const container = document.getElementById(containerId);
        if (!container) {
            console.log('Growth circle container not found:', containerId);
            return;
        }
        
        container.innerHTML = ''; // クリアして再生成
        
        console.log('Creating growth circle for help...');
        
        // キャッシュされた色配列を作成して再利用
        if (!this.cachedColors) {
            this.cachedColors = [
                '#ffb3ba', '#ffdfba', '#ffffba', '#baffc9',
                '#bae1ff', '#c9baff', '#ffbac9', '#ffd4ba',
                '#d4ffba', '#baffdf', '#bac9ff'
            ];
        }
        
        // ヘルプ用のサイズ設定
        const isMobile = window.innerWidth <= 480;
        const helpCircleConfig = {
            baseRadius: isMobile ? 60 : 100,
            centerX: isMobile ? 125 : 150,
            centerY: isMobile ? 125 : 150,
            scale: isMobile ? 0.15 : 0.2
        };
        
        const { baseRadius, centerX, centerY, scale } = helpCircleConfig;
        
        // DocumentFragmentでDOM操作を最適化
        const fragment = document.createDocumentFragment();
        
        this.dogTypes.forEach((dogType, index) => {
            console.log(`Creating help growth item for type: ${dogType.type}, image exists: ${dogType.image ? 'yes' : 'no'}`);
            
            const angle = (index / this.dogTypes.length) * 2 * Math.PI - Math.PI / 2;
            
            const itemWidth = Math.max(dogType.width * scale, 16);
            const itemHeight = Math.max(dogType.height * scale, 16);
            const maxSize = Math.max(itemWidth, itemHeight);
            
            const radiusOffset = Math.max(0, (maxSize - 16) * 0.2);
            const currentRadius = baseRadius + radiusOffset;
            
            const x = centerX + currentRadius * Math.cos(angle) - itemWidth / 2;
            const y = centerY + currentRadius * Math.sin(angle) - itemHeight / 2;
            
            const item = document.createElement('div');
            item.className = 'growth-item';
            item.style.cssText = `left: ${x}px; top: ${y}px; width: ${itemWidth}px; height: ${itemHeight}px;`;
            
            const img = document.createElement('img');
            img.alt = `okome${dogType.type}`;
            img.style.cssText = `width: ${itemWidth}px; height: ${itemHeight}px;`;
            
            const placeholder = document.createElement('div');
            placeholder.className = 'growth-placeholder';
            placeholder.style.cssText = `background: ${this.cachedColors[index]}; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #333; font-weight: bold; width: ${itemWidth}px; height: ${itemHeight}px; font-size: ${Math.max(8, itemWidth / 3)}px;`;
            placeholder.textContent = dogType.type;
            
            const tooltip = document.createElement('div');
            tooltip.className = 'growth-tooltip';
            tooltip.textContent = `Lv.${dogType.type} (${dogType.width}×${dogType.height})`;
            
            // 画像が既に読み込み済みの場合
            if (dogType.image) {
                img.src = dogType.image.src;
                img.style.display = 'block';
                placeholder.style.display = 'none';
                console.log(`Using loaded image for help type ${dogType.type}`);
            } else {
                // 画像がない場合はプレースホルダーを表示
                img.style.display = 'none';
                img.src = `${this.basePath}/image/okome${dogType.type}.png`;
                console.log(`Using placeholder for help type ${dogType.type}`);
                
                // 画像読み込み成功時の処理
                img.onload = () => {
                    console.log(`Help growth circle image loaded for type ${dogType.type}`);
                    img.style.display = 'block';
                    placeholder.style.display = 'none';
                };
                
                img.onerror = () => {
                    console.error(`Help growth circle image failed to load for type ${dogType.type}`);
                    img.style.display = 'none';
                    placeholder.style.display = 'flex';
                };
            }
            
            item.appendChild(img);
            item.appendChild(placeholder);
            item.appendChild(tooltip);
            fragment.appendChild(item);
        });
        
        container.appendChild(fragment);
        console.log('Help growth circle created');
    }
    
    showHelp() {
        console.log('Showing help popup');
        document.getElementById('helpPopup').style.display = 'flex';
        this.createGrowthCircle('helpGrowthCircle');
    }
    
    hideHelp() {
        console.log('Hiding help popup');
        document.getElementById('helpPopup').style.display = 'none';
    }
}

window.addEventListener('load', () => {
    new OkomeGame();
});