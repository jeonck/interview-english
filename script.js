class InterviewEnglishApp {
    constructor() {
        this.categories = null;
        this.categoryCache = new Map(); // 로드된 카테고리 데이터 캐시
        this.currentCategory = null;
        this.currentSentences = [];
        this.currentIndex = 0;
        this.stats = {
            total: 0,
            easy: 0,
            normal: 0,
            hard: 0
        };
        this.settings = {
            timerDuration: 10,
            autoPlay: true,
            repeatCount: 2
        };
        this.timer = null;
        this.currentTimeLeft = 0;
        this.speechSynth = window.speechSynthesis;
        this.isPlaying = false;
        
        this.init();
    }

    async init() {
        try {
            await this.loadCategories();
            this.setupEventListeners();
            this.loadSettings();
            this.showMainMenu();
        } catch (error) {
            console.error('초기화 실패:', error);
            alert('앱을 불러오는 중 오류가 발생했습니다.');
        }
    }

    async loadCategories() {
        try {
            const response = await fetch('./data/categories.json');
            const data = await response.json();
            this.categories = data.categories;
            console.log(`카테고리 로드 완료: ${this.categories.length}개`);
        } catch (error) {
            console.error('카테고리 로딩 실패:', error);
            throw error;
        }
    }

    async loadCategoryData(categoryId) {
        // 캐시에서 먼저 확인
        if (this.categoryCache.has(categoryId)) {
            console.log(`캐시에서 로드: ${categoryId}`);
            return this.categoryCache.get(categoryId);
        }

        try {
            const category = this.categories.find(cat => cat.id === categoryId);
            if (!category) {
                throw new Error(`카테고리를 찾을 수 없습니다: ${categoryId}`);
            }

            const response = await fetch(`./data/${category.file}`);
            const data = await response.json();
            
            // 캐시에 저장
            this.categoryCache.set(categoryId, data);
            console.log(`카테고리 데이터 로드: ${categoryId} (${data.sentences.length}개 문장)`);
            
            return data;
        } catch (error) {
            console.error(`카테고리 데이터 로딩 실패: ${categoryId}`, error);
            throw error;
        }
    }

    async loadAllCategories() {
        const allSentences = [];
        const loadPromises = this.categories.map(async (category) => {
            try {
                const data = await this.loadCategoryData(category.id);
                data.sentences.forEach(sentence => {
                    allSentences.push({
                        ...sentence,
                        categoryName: category.name,
                        categoryEmoji: category.emoji
                    });
                });
            } catch (error) {
                console.warn(`카테고리 로딩 실패: ${category.id}`, error);
            }
        });

        await Promise.all(loadPromises);
        console.log(`전체 데이터 로드 완료: ${allSentences.length}개 문장`);
        return allSentences;
    }

    setupEventListeners() {
        // 메인 메뉴 버튼들
        document.getElementById('random-mode-btn').addEventListener('click', () => {
            this.startRandomMode();
        });

        document.getElementById('all-mode-btn').addEventListener('click', () => {
            this.startAllMode();
        });

        document.getElementById('infinite-mode-btn').addEventListener('click', () => {
            window.location.href = './infinite-repeat.html';
        });

        // 학습 화면 버튼들
        document.getElementById('show-answer-btn').addEventListener('click', () => {
            this.showAnswer();
        });

        document.getElementById('next-btn').addEventListener('click', () => {
            this.nextSentence();
        });

        document.getElementById('play-again-btn').addEventListener('click', () => {
            this.playEnglishSentence();
        });

        // 평가 버튼들
        document.querySelectorAll('.rating-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.rateSentence(e.target.dataset.rating);
            });
        });

        // 완료 화면 버튼들
        document.getElementById('restart-btn').addEventListener('click', () => {
            this.restartStudy();
        });

        document.getElementById('home-btn').addEventListener('click', () => {
            this.showMainMenu();
        });

        // 컨트롤 버튼들
        document.getElementById('back-btn').addEventListener('click', () => {
            this.showMainMenu();
        });

        document.getElementById('pause-btn').addEventListener('click', () => {
            this.togglePause();
        });

        // 설정 관련
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.showSettings();
        });

        document.getElementById('settings-back-btn').addEventListener('click', () => {
            this.hideSettings();
        });

        // 설정 값 변경
        document.getElementById('timer-duration').addEventListener('input', (e) => {
            this.settings.timerDuration = parseInt(e.target.value);
            document.getElementById('timer-value').textContent = e.target.value + '초';
            this.saveSettings();
        });

        document.getElementById('auto-play').addEventListener('change', (e) => {
            this.settings.autoPlay = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('repeat-count').addEventListener('change', (e) => {
            this.settings.repeatCount = parseInt(e.target.value);
            this.saveSettings();
        });
    }

    showMainMenu() {
        this.hideAllScreens();
        document.getElementById('main-menu').classList.add('active');
        this.renderCategories();
        this.resetTimer();
    }

    renderCategories() {
        const categoryList = document.getElementById('category-list');
        categoryList.innerHTML = '';

        this.categories.forEach((category, index) => {
            const btn = document.createElement('button');
            btn.className = 'category-btn';
            btn.innerHTML = `
                <span class="emoji">${category.emoji}</span>
                <h3>${category.name}</h3>
                <p><span>📝 ${category.count}개 문장</span></p>
            `;
            btn.addEventListener('click', () => {
                this.startCategoryStudy(category.id);
            });
            categoryList.appendChild(btn);
        });
    }

    async startCategoryStudy(categoryId) {
        try {
            // 로딩 상태 표시
            this.showLoading();
            
            const categoryData = await this.loadCategoryData(categoryId);
            this.currentCategory = categoryData.category;
            this.currentSentences = [...categoryData.sentences];
            
            this.hideLoading();
            this.startStudy();
        } catch (error) {
            this.hideLoading();
            console.error('카테고리 학습 시작 실패:', error);
            alert('카테고리 데이터를 불러오는 중 오류가 발생했습니다.');
        }
    }

    async startRandomMode() {
        try {
            this.showLoading();
            
            const allSentences = await this.loadAllCategories();
            this.currentSentences = this.shuffleArray(allSentences);
            this.currentCategory = { name: '랜덤 모드', emoji: '🔀' };
            
            this.hideLoading();
            this.startStudy();
        } catch (error) {
            this.hideLoading();
            console.error('랜덤 모드 시작 실패:', error);
            alert('데이터를 불러오는 중 오류가 발생했습니다.');
        }
    }

    async startAllMode() {
        try {
            this.showLoading();
            
            const allSentences = await this.loadAllCategories();
            this.currentSentences = allSentences;
            this.currentCategory = { name: '전체 학습', emoji: '📚' };
            
            this.hideLoading();
            this.startStudy();
        } catch (error) {
            this.hideLoading();
            console.error('전체 모드 시작 실패:', error);
            alert('데이터를 불러오는 중 오류가 발생했습니다.');
        }
    }

    showLoading() {
        // 간단한 로딩 표시
        const welcomeCard = document.querySelector('.welcome-card');
        if (welcomeCard) {
            welcomeCard.innerHTML = `
                <h2>⏳ 데이터 로딩 중...</h2>
                <p>잠시만 기다려주세요</p>
            `;
        }
    }

    hideLoading() {
        // 원래 welcome 카드 복원
        const welcomeCard = document.querySelector('.welcome-card');
        if (welcomeCard) {
            welcomeCard.innerHTML = `
                <h2>✨ 학습을 시작해보세요</h2>
                <p>59개의 핵심 면접 표현으로<br>완벽한 영어 면접을 준비하세요</p>
            `;
        }
    }

    startStudy() {
        this.currentIndex = 0;
        this.resetStats();
        this.hideAllScreens();
        document.getElementById('study-screen').classList.add('active');
        document.getElementById('current-category').textContent = this.currentCategory.name;
        this.showKoreanSentence();
    }

    showKoreanSentence() {
        if (this.currentIndex >= this.currentSentences.length) {
            this.showComplete();
            return;
        }

        this.hideAllPhases();
        document.getElementById('korean-phase').classList.add('active');
        
        const sentence = this.currentSentences[this.currentIndex];
        document.getElementById('korean-sentence').textContent = sentence.korean;
        
        this.updateProgress();
        this.startTimer();
    }

    startTimer() {
        this.currentTimeLeft = this.settings.timerDuration;
        this.updateTimerDisplay();
        
        this.timer = setInterval(() => {
            this.currentTimeLeft--;
            this.updateTimerDisplay();
            
            if (this.currentTimeLeft <= 0) {
                this.resetTimer();
                if (this.settings.autoPlay) {
                    this.showAnswer();
                }
            }
        }, 1000);
    }

    updateTimerDisplay() {
        const timerText = document.getElementById('timer-text');
        const timerCircle = document.getElementById('timer-circle');
        
        timerText.textContent = this.currentTimeLeft;
        
        timerCircle.classList.remove('warning', 'danger');
        if (this.currentTimeLeft <= 3) {
            timerCircle.classList.add('danger');
        } else if (this.currentTimeLeft <= 5) {
            timerCircle.classList.add('warning');
        }
    }

    resetTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.currentTimeLeft = 0;
    }

    showAnswer() {
        this.resetTimer();
        this.hideAllPhases();
        document.getElementById('answer-phase').classList.add('active');
        
        const sentence = this.currentSentences[this.currentIndex];
        document.getElementById('english-sentence').textContent = sentence.english;
        
        const pronunciation = this.generatePronunciation(sentence.english);
        document.getElementById('pronunciation-guide').textContent = pronunciation;
        
        document.querySelectorAll('.rating-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        if (this.settings.autoPlay) {
            setTimeout(() => {
                this.playEnglishSentence();
            }, 500);
        }
    }

    playEnglishSentence() {
        if (this.isPlaying) return;
        
        const sentence = this.currentSentences[this.currentIndex];
        this.isPlaying = true;
        
        let playCount = 0;
        const playNext = () => {
            if (playCount < this.settings.repeatCount) {
                this.speakText(sentence.english, () => {
                    playCount++;
                    if (playCount < this.settings.repeatCount) {
                        setTimeout(playNext, 500);
                    } else {
                        this.isPlaying = false;
                    }
                });
            }
        };
        
        playNext();
    }

    speakText(text, callback) {
        if (this.speechSynth.speaking) {
            this.speechSynth.cancel();
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.8;
        utterance.pitch = 1.0;
        
        utterance.onend = () => {
            if (callback) callback();
        };
        
        this.speechSynth.speak(utterance);
    }

    rateSentence(rating) {
        document.querySelectorAll('.rating-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        document.querySelector(`[data-rating="${rating}"]`).classList.add('selected');
        
        this.stats.total++;
        this.stats[rating]++;
        
        setTimeout(() => {
            this.nextSentence();
        }, 1000);
    }

    nextSentence() {
        this.currentIndex++;
        this.showKoreanSentence();
    }

    showComplete() {
        this.hideAllPhases();
        document.getElementById('complete-phase').classList.add('active');
        
        document.getElementById('total-count').textContent = this.stats.total;
        document.getElementById('easy-count').textContent = this.stats.easy;
        document.getElementById('hard-count').textContent = this.stats.hard;
    }

    updateProgress() {
        const progress = ((this.currentIndex + 1) / this.currentSentences.length) * 100;
        document.getElementById('progress-fill').style.width = progress + '%';
        document.getElementById('progress-text').textContent = 
            `${this.currentIndex + 1}/${this.currentSentences.length}`;
    }

    restartStudy() {
        this.currentIndex = 0;
        this.resetStats();
        this.showKoreanSentence();
    }

    resetStats() {
        this.stats = {
            total: 0,
            easy: 0,
            normal: 0,
            hard: 0
        };
    }

    hideAllScreens() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
    }

    hideAllPhases() {
        document.querySelectorAll('.phase').forEach(phase => {
            phase.classList.remove('active');
        });
    }

    showSettings() {
        document.getElementById('settings-screen').classList.add('active');
        document.getElementById('main-menu').classList.remove('active');
    }

    hideSettings() {
        document.getElementById('settings-screen').classList.remove('active');
        document.getElementById('main-menu').classList.add('active');
    }

    togglePause() {
        const pauseBtn = document.getElementById('pause-btn');
        if (this.timer) {
            this.resetTimer();
            pauseBtn.innerHTML = '<span>▶️</span><span>계속</span>';
        } else {
            this.startTimer();
            pauseBtn.innerHTML = '<span>⏸️</span><span>일시정지</span>';
        }
    }

    generatePronunciation(text) {
        return `[${text.toLowerCase().replace(/[.,!?]/g, '')}]`;
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    loadSettings() {
        const saved = localStorage.getItem('interview-english-settings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
        
        document.getElementById('timer-duration').value = this.settings.timerDuration;
        document.getElementById('timer-value').textContent = this.settings.timerDuration + '초';
        document.getElementById('auto-play').checked = this.settings.autoPlay;
        document.getElementById('repeat-count').value = this.settings.repeatCount;
    }

    saveSettings() {
        localStorage.setItem('interview-english-settings', JSON.stringify(this.settings));
    }

    // 캐시 관리 메서드들
    clearCache() {
        this.categoryCache.clear();
        console.log('캐시 클리어 완료');
    }

    getCacheInfo() {
        return {
            size: this.categoryCache.size,
            categories: Array.from(this.categoryCache.keys())
        };
    }
}

// 앱 시작
document.addEventListener('DOMContentLoaded', () => {
    new InterviewEnglishApp();
});

// 서비스 워커 등록 (PWA 지원)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}