class TicTacToe {
    constructor() {
        this.cells = Array.from(document.querySelectorAll(".cell"));
        this.status = document.getElementById("status");
        this.resultOverlay = document.getElementById("result-overlay");
        this.overlayTitle = document.getElementById("overlay-title");
        this.overlayText = document.getElementById("overlay-text");
        this.overlayPromo = document.getElementById("overlay-promo");
        this.playAgainBtn = document.getElementById("play-again");
        this.resetBtn = document.getElementById("reset");
        this.tgLink = document.getElementById("tg-link-btn");
        this.registrationText = document.getElementById("registration-text");
        this.telegramSentText = document.getElementById("telegram-sent-text");
        this.promoContainer = document.getElementById("promo-container");
        this.copyTooltip = document.getElementById("copy-tooltip");
        this.board = Array(9).fill(null);
        this.player = "X";
        this.bot = "O";
        this.playerMark = "✨";
        this.botMark = "💖";
        this.gameOver = false;
        this.sessionId = null;
        this.gamesPlayed = 0;
        this.botTimeout = null;
        this.pendingGameState = null;
        this.pendingPromo = null;
        this.registrationCheckInterval = null;
        this.registrationUpdateTimeout = null;
        this.winningLines = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6],
        ];
        this.init();
    }

    async init() {
        const page = document.querySelector(".page");
        
        await this.prepareSession();
        this.attachHandlers();
        
        // Игра начинается сразу без проверки регистрации
        if (!page.classList.contains("loaded")) {
            page.classList.add("loaded");
        }
        this.resetBoard();
    }

    async prepareSession() {
        const stored = localStorage.getItem("session_id");
        if (stored) {
            this.sessionId = stored;
        } else {
            const res = await fetch("/api/session");
            const data = await res.json();
            this.sessionId = data.session_id;
            localStorage.setItem("session_id", this.sessionId);
        }
        const link = `https://t.me/tic_tac_toe_new_bot?start=${this.sessionId}`;
        if (this.tgLink) {
            this.tgLink.href = link;
        }
    }

    async checkRegistrationOnInit() {
        try {
            const res = await fetch(`/api/check-registration?session_id=${this.sessionId}`);
            const data = await res.json();
            return data.registered;
        } catch (err) {
            console.error("Ошибка проверки регистрации", err);
            return false;
        }
    }

    startRegistrationCheck() {
        // Очищаем предыдущий интервал, если есть
        if (this.registrationCheckInterval) {
            clearInterval(this.registrationCheckInterval);
        }
        
        // Проверяем регистрацию каждые 3 секунды
        this.registrationCheckInterval = setInterval(async () => {
            // Проверяем только если окно результата открыто и показывается кнопка Telegram
            if (this.resultOverlay.classList.contains("open") && 
                this.tgLink.style.display !== "none") {
                const isRegistered = await this.checkRegistrationOnInit();
                
                if (isRegistered && this.pendingGameState) {
                    // Пользователь зарегистрировался - обновляем окно
                    this.updateResultAfterRegistration();
                }
            }
        }, 3000);
    }

    updateResultAfterRegistration() {
        // Очищаем интервал проверки
        if (this.registrationCheckInterval) {
            clearInterval(this.registrationCheckInterval);
            this.registrationCheckInterval = null;
        }

        // Очищаем предыдущий таймер обновления, если есть
        if (this.registrationUpdateTimeout) {
            clearTimeout(this.registrationUpdateTimeout);
            this.registrationUpdateTimeout = null;
        }

        const state = this.pendingGameState;
        const promo = this.pendingPromo;

        // Обновляем окно в зависимости от состояния игры
        if (state === "win") {
            // После регистрации показываем "Ваш промокод:" + кнопка "Сыграть ещё" (без текста о телеграмме)
            this.showResultOverlay("Вы выиграли ✨", "Ваш промокод:", promo, true, null, false);
            
            // Очищаем состояние
            this.pendingGameState = null;
            this.pendingPromo = null;
        } else if (state === "lose") {
            // Очищаем состояние
            this.pendingGameState = null;
            this.pendingPromo = null;
            this.showResultOverlay("Компьютер выиграл 💖", "Сыграем ещё раз?", null, true);
        } else if (state === "draw") {
            // Очищаем состояние
            this.pendingGameState = null;
            this.pendingPromo = null;
            this.showResultOverlay("Ничья", "Ничья. Ещё одна партия?", null, true);
        }
    }

    attachHandlers() {
        this.cells.forEach((cell) => {
            cell.addEventListener("click", () => {
                const index = Number(cell.dataset.index);
                this.handlePlayerTurn(index);
            });
        });

        this.playAgainBtn.addEventListener("click", () => {
            // Закрываем окно
            this.hideResultOverlay();
            // Небольшая задержка для завершения анимации закрытия перед сбросом доски
            setTimeout(() => {
                // Проверяем, что окно действительно закрыто
                if (!this.resultOverlay.classList.contains("open")) {
                    this.resetBoard();
                }
            }, 350);
        });

        this.resetBtn.addEventListener("click", () => {
            this.resetBoard();
        });

        // Периодическая проверка регистрации когда показывается окно с кнопкой Telegram
        this.startRegistrationCheck();
    }

    resetBoard() {
        // Отменяем таймер бота, если он был установлен
        if (this.botTimeout) {
            clearTimeout(this.botTimeout);
            this.botTimeout = null;
        }

        // Очищаем состояние ожидания регистрации
        this.pendingGameState = null;
        this.pendingPromo = null;

        this.board = Array(9).fill(null);
        this.gameOver = false;
        this.status.textContent = `Ваш ход — ${this.playerMark}`;
        this.cells.forEach((cell) => {
            cell.textContent = "";
            cell.classList.remove("bot", "win");
            cell.disabled = false;
        });
    }

    handlePlayerTurn(index) {
        if (this.gameOver || this.board[index]) return;
        this.placeMark(index, this.player);
        if (this.checkOutcome(this.player)) return;
        
        // Задержка перед ходом бота для эффекта "думания"
        this.cells.forEach(cell => cell.disabled = true);
        this.status.textContent = "Компьютер думает...";
        
        this.botTimeout = setTimeout(() => {
            this.botTurn();
            this.cells.forEach((cell, idx) => {
                if (!this.board[idx]) cell.disabled = false;
            });
            this.botTimeout = null;
        }, 800);
    }

    botTurn() {
        if (this.gameOver) return;
        const choice = this.pickBotMove();
        this.placeMark(choice, this.bot, true);
        this.checkOutcome(this.bot);
    }

    placeMark(index, mark, isBot = false) {
        this.board[index] = mark;
        const cell = this.cells[index];
        const displayMark = mark === this.player ? this.playerMark : this.botMark;
        cell.textContent = displayMark;
        if (isBot) cell.classList.add("bot");
        cell.disabled = true;
        this.status.textContent = isBot ? `Ваш ход — ${this.playerMark}` : "Ход компьютера…";
    }

    checkOutcome(mark) {
        const line = this.winningLines.find((combo) =>
            combo.every((i) => this.board[i] === mark)
        );

        if (line) {
            this.finishGame(mark === this.player ? "win" : "lose", line);
            return true;
        }

        if (this.board.every(Boolean)) {
            this.finishGame("draw");
            return true;
        }

        return false;
    }

    pickBotMove() {
        const empty = this.board
            .map((val, idx) => (val ? null : idx))
            .filter((v) => v !== null);

        // Упрощённый ИИ: только иногда блокирует игрока (40% вероятность)
        if (Math.random() < 0.4) {
            for (const i of empty) {
                const next = [...this.board];
                next[i] = this.player;
                if (this.isWinning(next, this.player)) return i;
            }
        }

        // В остальных случаях - случайный ход
        return empty[Math.floor(Math.random() * empty.length)];
    }

    isWinning(board, mark) {
        return this.winningLines.some((combo) => combo.every((i) => board[i] === mark));
    }

    async finishGame(state, line = []) {
        // Отменяем таймер бота, если он был установлен
        if (this.botTimeout) {
            clearTimeout(this.botTimeout);
            this.botTimeout = null;
        }

        this.gameOver = true;
        this.cells.forEach((cell) => (cell.disabled = true));
        this.gamesPlayed += 1;

        if (state === "win") {
            line.forEach((i) => this.cells[i].classList.add("win"));
            const promo = this.generatePromo();
            
            // Проверяем регистрацию после победы
            const isRegistered = await this.checkRegistrationOnInit();
            
            if (!isRegistered) {
                // Сохраняем состояние для обновления после регистрации
                this.pendingGameState = "win";
                this.pendingPromo = promo;
                // Если не зарегистрирован - показываем окно победы с промокодом и текстом о регистрации
                const text = "Ваш промокод:";
                this.showResultOverlay("Вы выиграли ✨", text, promo, false, null, false);
            } else {
                // Если зарегистрирован - показываем "Ваш промокод:" + "Промокод отправлен в телеграмм" + кнопка "Сыграть ещё"
                const text = "Ваш промокод:";
                this.showResultOverlay("Вы выиграли ✨", text, promo, true, null, true);
            }
            
            this.notifyBackend("win", promo);
        } else if (state === "lose") {
            line.forEach((i) => this.cells[i].classList.add("win"));
            
            // Проверяем регистрацию после проигрыша
            const isRegistered = await this.checkRegistrationOnInit();
            
            if (!isRegistered) {
                // Сохраняем состояние для обновления после регистрации
                this.pendingGameState = "lose";
                this.showResultOverlay("Компьютер выиграл 💖", "Сыграем ещё раз?", null, false, "Чтобы сыграть еще раз, пройдите быструю регистрацию через бота");
            } else {
                this.showResultOverlay("Компьютер выиграл 💖", "Сыграем ещё раз?", null, true);
            }
            
            this.notifyBackend("lose");
        } else {
            // Проверяем регистрацию после ничьей
            const isRegistered = await this.checkRegistrationOnInit();
            
            if (!isRegistered) {
                // Сохраняем состояние для обновления после регистрации
                this.pendingGameState = "draw";
                this.showResultOverlay("Ничья", "Ничья. Ещё одна партия?", null, false);
            } else {
                this.showResultOverlay("Ничья", "Ничья. Ещё одна партия?", null, true);
            }
        }
    }

    generatePromo() {
        const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const numbers = "23456789";
        let promo = "";
        
        // Генерируем 5-значный промокод: 2 буквы + 3 цифры
        for (let i = 0; i < 2; i++) {
            promo += letters[Math.floor(Math.random() * letters.length)];
        }
        for (let i = 0; i < 3; i++) {
            promo += numbers[Math.floor(Math.random() * numbers.length)];
        }
        
        return promo;
    }

    async notifyBackend(outcome, promo) {
        try {
            await fetch("/api/result", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    outcome,
                    promo_code: promo,
                }),
            });
        } catch (err) {
            console.error("Не удалось отправить результат", err);
        }
    }

    showResultOverlay(title, text, promo, showPlayAgain = true, registrationText = null, showTelegramSent = false) {
        this.overlayTitle.textContent = title;
        
        if (text) {
            this.overlayText.textContent = text;
            this.overlayText.style.display = "block";
            this.overlayText.style.whiteSpace = "pre-line";
        } else {
            this.overlayText.style.display = "none";
        }
        
        if (promo) {
            this.overlayPromo.textContent = promo;
            this.promoContainer.style.display = "block";
            this.overlayPromo.style.cursor = "pointer";
            
            // Удаляем старый обработчик, если есть
            const oldHandler = this.overlayPromo._copyHandler;
            if (oldHandler) {
                this.overlayPromo.removeEventListener("click", oldHandler);
            }
            
            // Создаём новый обработчик
            const copyHandler = () => this.copyPromo(promo);
            this.overlayPromo._copyHandler = copyHandler;
            this.overlayPromo.addEventListener("click", copyHandler);
        } else {
            this.promoContainer.style.display = "none";
        }
        
        // Показываем/скрываем текст о регистрации и кнопки в зависимости от параметра
        if (!showPlayAgain) {
            // Показываем текст о регистрации и кнопку Telegram, скрываем "Сыграть ещё"
            if (registrationText) {
                this.registrationText.textContent = registrationText;
            } else {
                this.registrationText.textContent = "Чтобы сохранять промокоды и результаты игры, пройдите регистрацию через бота";
            }
            this.registrationText.style.display = "block";
            this.telegramSentText.style.display = "none";
            this.playAgainBtn.style.display = "none";
            this.tgLink.style.display = "inline-block";
        } else {
            // Скрываем текст о регистрации и кнопку Telegram, показываем "Сыграть ещё"
            this.registrationText.style.display = "none";
            
            // Показываем текст о телеграмме только если пользователь был зарегистрирован до победы
            if (showTelegramSent) {
                this.telegramSentText.style.display = "block";
            } else {
                this.telegramSentText.style.display = "none";
            }
            
            this.playAgainBtn.style.display = "inline-block";
            this.tgLink.style.display = "none";
        }
        
        this.resultOverlay.classList.add("open");
    }

    async copyPromo(promo) {
        try {
            await navigator.clipboard.writeText(promo);
            this.copyTooltip.style.opacity = "1";
            this.copyTooltip.style.transform = "translateX(-50%) translateY(0)";
            setTimeout(() => {
                this.copyTooltip.style.opacity = "0";
                this.copyTooltip.style.transform = "translateX(-50%) translateY(-10px)";
            }, 2000);
        } catch (err) {
            console.error("Не удалось скопировать промокод", err);
        }
    }

    hideResultOverlay() {
        // Проверяем, что окно действительно открыто перед закрытием
        if (!this.resultOverlay.classList.contains("open")) {
            return;
        }
        
        // Останавливаем проверку регистрации
        if (this.registrationCheckInterval) {
            clearInterval(this.registrationCheckInterval);
            this.registrationCheckInterval = null;
        }
        
        // Очищаем таймер обновления окна
        if (this.registrationUpdateTimeout) {
            clearTimeout(this.registrationUpdateTimeout);
            this.registrationUpdateTimeout = null;
        }
        
        // Сначала удаляем класс "open" для начала анимации закрытия
        this.resultOverlay.classList.remove("open");
        
        // Очищаем содержимое после завершения анимации закрытия (300ms - время анимации)
        setTimeout(() => {
            this.overlayPromo.textContent = "";
            this.promoContainer.style.display = "none";
            
            // Сбрасываем состояние кнопок и текста
            this.registrationText.style.display = "none";
            this.telegramSentText.style.display = "none";
            this.playAgainBtn.style.display = "inline-block";
            this.tgLink.style.display = "none";
            
            // Очищаем состояние ожидания регистрации
            this.pendingGameState = null;
            this.pendingPromo = null;
            
            // Удаляем обработчик
            const oldHandler = this.overlayPromo._copyHandler;
            if (oldHandler) {
                this.overlayPromo.removeEventListener("click", oldHandler);
                this.overlayPromo._copyHandler = null;
            }
        }, 300);
    }
}

window.addEventListener("DOMContentLoaded", () => {
    const loader = document.getElementById("loader");
    const page = document.querySelector(".page");
    const glow = document.querySelector(".glow");
    
    // Скрываем loader после полной загрузки страницы и показываем контент
    window.addEventListener("load", () => {
        // Минимальное время показа загрузки - 1.5 секунды для плавности
        setTimeout(() => {
            if (loader) {
                loader.classList.add("hidden");
            }
            // Показываем контент одновременно с исчезновением загрузки
            if (page) {
                page.classList.add("loaded");
            }
            if (glow) {
                glow.classList.add("loaded");
            }
            // Удаляем loader из DOM после завершения анимации
            setTimeout(() => {
                if (loader) {
                    loader.remove();
                }
            }, 500);
        }, 1500);
    });
    
    new TicTacToe();
});