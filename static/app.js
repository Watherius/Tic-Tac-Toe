class TicTacToe {
    constructor() {
        this.cells = Array.from(document.querySelectorAll(".cell"));
        this.status = document.getElementById("status");
        this.registrationOverlay = document.getElementById("registration-overlay");
        this.resultOverlay = document.getElementById("result-overlay");
        this.overlayTitle = document.getElementById("overlay-title");
        this.overlayText = document.getElementById("overlay-text");
        this.overlayPromo = document.getElementById("overlay-promo");
        this.playAgainBtn = document.getElementById("play-again");
        this.resetBtn = document.getElementById("reset");
        this.tgLink = document.getElementById("tg-link");
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
        
        // Проверяем регистрацию перед показом модального окна
        const isRegistered = await this.checkRegistrationOnInit();
        
        if (!isRegistered) {
            // Показываем модальное окно сразу, страница остается скрытой
            this.showRegistrationModal();
        } else {
            // Показываем страницу только если зарегистрирован
            // Используем класс вместо прямого изменения стиля
            if (!page.classList.contains("loaded")) {
                page.classList.add("loaded");
            }
            this.resetBoard();
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
        this.tgLink.href = link;
    }

    showRegistrationModal() {
        this.registrationOverlay.classList.add("open");
    }

    async checkRegistration() {
        if (!this.registrationOverlay.classList.contains("open")) return;
        
        try {
            const res = await fetch(`/api/check-registration?session_id=${this.sessionId}`);
            const data = await res.json();
            if (data.registered) {
                this.hideRegistrationModal();
            }
        } catch (err) {
            console.error("Ошибка проверки регистрации", err);
        }
    }

    hideRegistrationModal() {
        this.registrationOverlay.classList.remove("open");
        const page = document.querySelector(".page");
        // Используем класс вместо прямого изменения стиля
        if (!page.classList.contains("loaded")) {
            page.classList.add("loaded");
        }
        this.resetBoard();
    }

    attachHandlers() {
        this.cells.forEach((cell) => {
            cell.addEventListener("click", () => {
                const index = Number(cell.dataset.index);
                this.handlePlayerTurn(index);
            });
        });

        this.playAgainBtn.addEventListener("click", () => {
            this.hideResultOverlay();
            this.resetBoard();
        });

        this.resetBtn.addEventListener("click", () => {
            this.resetBoard();
        });

        // Проверка регистрации при загрузке и периодически
        this.checkRegistration();
        setInterval(() => this.checkRegistration(), 3000);
    }

    resetBoard() {
        // Отменяем таймер бота, если он был установлен
        if (this.botTimeout) {
            clearTimeout(this.botTimeout);
            this.botTimeout = null;
        }

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

    finishGame(state, line = []) {
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
            const text = "Победа!<br>Промокод уже ждёт вас в боте.";
            this.showResultOverlay("Вы выиграли ✨", text, promo);
            this.notifyBackend("win", promo);
        } else if (state === "lose") {
            line.forEach((i) => this.cells[i].classList.add("win"));
            this.showResultOverlay("Компьютер выиграл 💖", "Сыграем ещё раз?");
            this.notifyBackend("lose");
        } else {
            this.showResultOverlay("Ничья", "Ничья. Ещё одна партия?");
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

    showResultOverlay(title, text, promo) {
        this.overlayTitle.textContent = title;
        
        if (text) {
            this.overlayText.innerHTML = text;
            this.overlayText.style.display = "block";
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
        this.resultOverlay.classList.remove("open");
        this.overlayPromo.textContent = "";
        this.promoContainer.style.display = "none";
        
        // Удаляем обработчик
        const oldHandler = this.overlayPromo._copyHandler;
        if (oldHandler) {
            this.overlayPromo.removeEventListener("click", oldHandler);
            this.overlayPromo._copyHandler = null;
        }
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
            loader.classList.add("hidden");
            // Показываем контент одновременно с исчезновением загрузки
            if (page) {
                page.classList.add("loaded");
            }
            if (glow) {
                glow.classList.add("loaded");
            }
            // Удаляем loader из DOM после завершения анимации
            setTimeout(() => {
                loader.remove();
            }, 500);
        }, 1500);
    });
    
    new TicTacToe();
});
