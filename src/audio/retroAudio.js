export class RetroAudio {
    constructor() {
        this.ctx = null;
        this.pinSources = ['pin1.mp3', 'pin2.mp3', 'pin3.mp3', 'pin4.mp3', 'pin5.mp3', 'pin6.mp3'];
        this.environment = new Audio('environment.mp3');
        this.ballRoll = new Audio('ball.mp3');
        this.musicTracks = [new Audio('music1.mp3'), new Audio('music2.mp3')];
        this.musicIndex = 0;
        this.musicStarted = false;
        this.masterVolume = 0.8;
        this.musicVolume = 0.18;
        this.alleyVolume = 0.3;
        this.effectsVolume = 0.85;
        this.backgroundMuted = false;
        this.backgroundResumeState = null;
        this.environment.loop = true;
        this.ballRoll.loop = true;
        this.musicTracks.forEach((track, index) => {
            track.loop = false;
            track.addEventListener('ended', () => this.playMusicTrack(index + 1));
        });
        this.activePinSounds = 0;
        this.lastPinSoundAt = 0;
        this.pinWindowStartedAt = 0;
        this.pinSoundsThisWindow = 0;
        this.applyVolumes();
    }

    init() {
        if (this.backgroundMuted) return;
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        this.startEnvironment();
        this.startMusic();
    }

    scaledVolume(kind) {
        const source = kind === 'music' ? this.musicVolume : kind === 'alley' ? this.alleyVolume : this.effectsVolume;
        return THREE.MathUtils.clamp(this.masterVolume * source, 0, 1);
    }

    applyVolumes() {
        this.environment.volume = this.scaledVolume('alley');
        this.ballRoll.volume = this.ballRoll.paused ? 0 : this.scaledVolume('effects') * 0.58;
        this.musicTracks.forEach(track => {
            track.volume = this.scaledVolume('music');
        });
    }

    setVolume(kind, value) {
        const normalized = THREE.MathUtils.clamp(value, 0, 1);
        if (kind === 'master') this.masterVolume = normalized;
        if (kind === 'music') this.musicVolume = normalized;
        if (kind === 'alley') this.alleyVolume = normalized;
        if (kind === 'effects') this.effectsVolume = normalized;
        this.applyVolumes();
    }

    muteForBackground() {
        if (this.backgroundMuted) return;
        this.backgroundResumeState = {
            environmentPlaying: !this.environment.paused,
            ballRolling: !this.ballRoll.paused,
            musicPlaying: this.musicTracks.map(track => !track.paused)
        };
        this.backgroundMuted = true;
        this.environment.pause();
        this.ballRoll.pause();
        this.musicTracks.forEach(track => track.pause());
        this.ctx?.suspend?.().catch(() => {});
    }

    resumeFromBackground() {
        if (!this.backgroundMuted) return;
        const resumeState = this.backgroundResumeState;
        this.backgroundMuted = false;
        this.backgroundResumeState = null;
        this.ctx?.resume?.().catch(() => {});
        if (resumeState?.environmentPlaying) {
            this.environment.play().catch(() => {});
        }
        if (resumeState?.ballRolling) {
            this.ballRoll.play().catch(() => {});
        }
        const musicTrackIndex = resumeState?.musicPlaying?.findIndex(Boolean) ?? -1;
        if (musicTrackIndex >= 0) {
            this.musicIndex = musicTrackIndex;
            this.musicTracks[musicTrackIndex].play().catch(() => {});
        }
        this.applyVolumes();
    }

    startEnvironment() {
        if (this.backgroundMuted) return;
        if (!this.environment.paused) return;
        this.environment.play().catch(() => {});
    }

    startMusic() {
        if (this.backgroundMuted) return;
        if (this.musicStarted) return;
        this.musicStarted = true;
        this.playMusicTrack(this.musicIndex);
    }

    playMusicTrack(index) {
        if (this.backgroundMuted) return;
        this.musicIndex = index % this.musicTracks.length;
        this.musicTracks.forEach((track, trackIndex) => {
            if (trackIndex !== this.musicIndex) {
                track.pause();
                track.currentTime = 0;
            }
        });
        const track = this.musicTracks[this.musicIndex];
        track.volume = this.scaledVolume('music');
        track.play().catch(() => {});
    }

    startBallRoll() {
        if (this.backgroundMuted) return;
        this.init();
        this.ballRoll.currentTime = 0;
        this.ballRoll.volume = this.scaledVolume('effects') * 0.58;
        this.ballRoll.play().catch(() => {});
    }

    stopBallRoll() {
        this.ballRoll.pause();
        this.ballRoll.currentTime = 0;
        this.ballRoll.volume = 0;
    }

    playPinStrike(speed = 2) {
        if (this.backgroundMuted) return;
        this.init();
        const now = performance.now();
        if (now - this.lastPinSoundAt < 95) return;
        if (now - this.pinWindowStartedAt > 520) {
            this.pinWindowStartedAt = now;
            this.pinSoundsThisWindow = 0;
        }
        if (this.activePinSounds >= 2 || this.pinSoundsThisWindow >= 4) return;

        const src = this.pinSources[Math.floor(Math.random() * this.pinSources.length)];
        const sound = new Audio(src);
        sound.volume = THREE.MathUtils.clamp(0.14 + speed * 0.035, 0.16, 0.42) * this.scaledVolume('effects') * 0.94;
        sound.playbackRate = THREE.MathUtils.clamp(0.92 + Math.random() * 0.18 + speed * 0.012, 0.9, 1.18);
        this.activePinSounds++;
        this.pinSoundsThisWindow++;
        this.lastPinSoundAt = now;
        sound.addEventListener('ended', () => {
            this.activePinSounds = Math.max(0, this.activePinSounds - 1);
        }, { once: true });
        sound.play().catch(() => {
            this.activePinSounds = Math.max(0, this.activePinSounds - 1);
        });
    }

    playCoin() {
        if (this.backgroundMuted) return;
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880.00, now + 0.08); // A5

        gain.gain.setValueAtTime(0.04 * this.scaledVolume('effects'), now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
    }

    playHit() {
        if (this.backgroundMuted) return;
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.12);

        gain.gain.setValueAtTime(0.12 * this.scaledVolume('effects'), now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
    }

    playExplosion() {
        if (this.backgroundMuted) return;
        this.init();
        const now = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 0.35;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noiseNode = this.ctx.createBufferSource();
        noiseNode.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(700, now);
        filter.frequency.linearRampToValueAtTime(40, now + 0.3);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.25 * this.scaledVolume('effects'), now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        noiseNode.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noiseNode.start(now);
        noiseNode.stop(now + 0.4);
    }

    playImplosion() {
        if (this.backgroundMuted) return;
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(60, now);
        osc.frequency.linearRampToValueAtTime(380, now + 0.25);

        gain.gain.setValueAtTime(0.12 * this.scaledVolume('effects'), now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
    }

    playTick() {
        if (this.backgroundMuted) return;
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, now);

        gain.gain.setValueAtTime(0.03 * this.scaledVolume('effects'), now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.04);
    }

    playStrike() {
        if (this.backgroundMuted) return;
        this.init();
        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'square';
        osc2.type = 'triangle';

        osc1.frequency.setValueAtTime(261.63, now); // C4
        osc1.frequency.setValueAtTime(329.63, now + 0.08); // E4
        osc1.frequency.setValueAtTime(392.00, now + 0.16); // G4
        osc1.frequency.setValueAtTime(523.25, now + 0.24); // C5

        osc2.frequency.setValueAtTime(130.81, now);
        osc2.frequency.setValueAtTime(164.81, now + 0.08);
        osc2.frequency.setValueAtTime(196.00, now + 0.16);

        gain.gain.setValueAtTime(0.12 * this.scaledVolume('effects'), now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.5);
        osc2.stop(now + 0.5);
    }
}
