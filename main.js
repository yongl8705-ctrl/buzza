const knownStocks = {
    AAPL: "Apple Inc.",
    TSLA: "Tesla Inc.",
    QQQ: "Invesco QQQ Trust",
    SPY: "SPDR S&P 500 ETF Trust",
    MSFT: "Microsoft Corp."
};

const defaultTickers = ["AAPL", "TSLA", "QQQ", "SPY", "MSFT"];

const indicatorMeta = [
    { label: "VIX", threshold: 30, unit: "", riskOnHigh: true, min: 10, max: 60 },
    { label: "장단기 금리차", threshold: 0, unit: "%", riskOnHigh: false, min: -2, max: 3 },
    { label: "GDP 성장률", threshold: 0, unit: "%", riskOnHigh: false, min: -4, max: 6 },
    { label: "실업률", threshold: 5, unit: "%", riskOnHigh: true, min: 2, max: 11 },
    { label: "신용 스프레드", threshold: 4, unit: "%", riskOnHigh: true, min: 1, max: 8 },
    { label: "Fear & Greed", threshold: 25, unit: "", riskOnHigh: false, min: 0, max: 100 },
    { label: "WTI 유가", threshold: 100, unit: "$", riskOnHigh: true, min: 30, max: 140 },
    { label: "USD/JPY", threshold: 150, unit: "", riskOnHigh: true, min: 80, max: 170 },
    { label: "실질금리", threshold: 2, unit: "%", riskOnHigh: true, min: -2, max: 4 },
    { label: "구리", threshold: 3, unit: "$/lb", riskOnHigh: false, min: 1.5, max: 5.5 },
    { label: "일드갭", threshold: 0, unit: "%", riskOnHigh: false, min: -3, max: 3 }
];

const subtitleText = document.getElementById("subtitle-text");
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const tickerInput = document.getElementById("ticker-input");
const addTickerBtn = document.getElementById("add-ticker-btn");
const addMessage = document.getElementById("add-message");
const tableSearch = document.getElementById("table-search");
const entryOnly = document.getElementById("entry-only");
const googleLoginBtn = document.getElementById("google-login-btn");
const appleLoginBtn = document.getElementById("apple-login-btn");
const logoutBtn = document.getElementById("logout-btn");
const authStatus = document.getElementById("auth-status");
const screeningBody = document.getElementById("screening-body");
const rowCount = document.getElementById("row-count");
const riskGrid = document.getElementById("risk-grid");
const riskSummary = document.getElementById("risk-summary");
const chartModal = document.getElementById("chart-modal");
const chartModalClose = document.getElementById("chart-modal-close");
const chartModalTitle = document.getElementById("chart-modal-title");
const chartModalSubtitle = document.getElementById("chart-modal-subtitle");
const dailyChartSvg = document.getElementById("daily-chart-svg");

let screeningRows = [];
let authApi = null;
let currentUser = null;
let loadingTickers = new Set();
let latestBaseDate = null;

const hashString = (text) => {
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = (hash << 5) - hash + text.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

const pseudoRandom = (seed) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
};

const formatPercent = (value) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
const formatPrice = (value) => `$${value.toFixed(2)}`;
const signClass = (value) => (value >= 0 ? "pos" : "neg");

const settingsKey = () => `screening-settings:${currentUser?.uid || "guest"}`;

const saveSettings = () => {
    const settings = {
        theme: document.documentElement.dataset.theme || "dark",
        entryOnly: entryOnly.checked,
        tickers: screeningRows.map((row) => row.ticker)
    };
    localStorage.setItem(settingsKey(), JSON.stringify(settings));
};

const loadSettings = () => {
    const raw = localStorage.getItem(settingsKey());
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

const updateSubtitle = () => {
    const dateText = latestBaseDate || new Date().toISOString().slice(0, 10);
    subtitleText.textContent = `기준일: ${dateText} (전날 종가 기준)`;
};

const applyTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    themeToggleBtn.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
    saveSettings();
};

const setAddMessage = (text, isError = false) => {
    addMessage.style.color = isError ? "#ff9e9e" : "";
    addMessage.textContent = text;
};

const createHistory = (meta) => {
    const points = 120;
    const seed = hashString(meta.label);
    let current = meta.min + pseudoRandom(seed) * (meta.max - meta.min);
    const values = [];

    for (let i = 0; i < points; i += 1) {
        const drift = (pseudoRandom(seed + i + 100) - 0.5) * (meta.max - meta.min) * 0.08;
        current += drift;
        if (current < meta.min) current = meta.min + (meta.min - current) * 0.2;
        if (current > meta.max) current = meta.max - (current - meta.max) * 0.2;
        values.push(Number(current.toFixed(2)));
    }
    return values;
};

const economicIndicators = indicatorMeta.map((meta) => {
    const history = createHistory(meta);
    return {
        ...meta,
        history,
        value: history[history.length - 1]
    };
});

const isRiskTriggered = (indicator) =>
    indicator.riskOnHigh ? indicator.value >= indicator.threshold : indicator.value <= indicator.threshold;

const createSparkPath = (values, width, height, padding) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = (width - padding * 2) / (values.length - 1);

    return values
        .map((value, index) => {
            const x = padding + step * index;
            const y = height - padding - ((value - min) / range) * (height - padding * 2);
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(" ");
};

const renderRiskIndicators = () => {
    let triggered = 0;
    riskGrid.innerHTML = economicIndicators
        .map((indicator) => {
            const hit = isRiskTriggered(indicator);
            if (hit) triggered += 1;
            return `
                <article class="risk-card">
                    <div class="risk-title">${indicator.label}</div>
                    <div class="risk-value">${indicator.value}${indicator.unit}</div>
                    <div class="risk-threshold">임계값: ${indicator.threshold}${indicator.unit} | 최근 10년(월별)</div>
                    <svg class="risk-chart" viewBox="0 0 240 70" preserveAspectRatio="none">
                        <line x1="0" y1="64" x2="240" y2="64" class="axis"></line>
                        <polyline points="${createSparkPath(indicator.history, 240, 70, 6)}" class="line"></polyline>
                    </svg>
                    <span class="badge ${hit ? "danger" : "good"}">${hit ? "위험 신호" : "정상"}</span>
                </article>
            `;
        })
        .join("");

    const ratio = `${triggered}/${economicIndicators.length}`;
    if (triggered >= 6) {
        riskSummary.className = "badge danger";
        riskSummary.textContent = `위험 높음 (${ratio})`;
    } else if (triggered >= 3) {
        riskSummary.className = "badge warn";
        riskSummary.textContent = `주의 (${ratio})`;
    } else {
        riskSummary.className = "badge good";
        riskSummary.textContent = `안정 (${ratio})`;
    }
};

const parseCsvHistory = (raw) => {
    const lines = raw
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => /^\d{4}-\d{2}-\d{2},/.test(line));

    return lines.map((line) => {
        const [date, open, high, low, close, volume] = line.split(",");
        return {
            date,
            open: Number(open),
            high: Number(high),
            low: Number(low),
            close: Number(close),
            volume: Number(volume)
        };
    });
};

const computeRsi14 = (closes) => {
    if (closes.length < 15) return null;
    let gain = 0;
    let loss = 0;
    for (let i = closes.length - 14; i < closes.length; i += 1) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gain += diff;
        else loss -= diff;
    }
    const avgGain = gain / 14;
    const avgLoss = loss / 14;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
};

const pctFrom = (latest, prev) => (prev ? ((latest - prev) / prev) * 100 : null);

const mapTickerForStooq = (ticker) => `${ticker.toLowerCase()}.us`;

const fetchCsvByTicker = async (ticker) => {
    const symbol = mapTickerForStooq(ticker);
    const urls = [
        `https://r.jina.ai/http://stooq.com/q/d/l/?s=${symbol}&i=d`,
        `https://stooq.com/q/d/l/?s=${symbol}&i=d`
    ];

    for (const url of urls) {
        try {
            const res = await fetch(url);
            if (res.ok) {
                return res.text();
            }
        } catch {
            // Try next source.
        }
    }

    throw new Error("데이터 조회 실패");
};

const buildRowFromHistory = (ticker, history) => {
    if (history.length < 220) {
        throw new Error("히스토리 데이터 부족");
    }

    const latest = history[history.length - 1];
    const d1 = history[history.length - 2];
    const d20 = history[history.length - 21];
    const d50 = history[history.length - 51];
    const d200 = history[history.length - 201];
    const closes = history.map((item) => item.close);
    const rsi = computeRsi14(closes);
    const recommendedRsi = 30;
    const entrySignal = rsi !== null && rsi <= recommendedRsi;

    latestBaseDate = latestBaseDate && latestBaseDate > latest.date ? latestBaseDate : latest.date;

    return {
        ticker,
        name: knownStocks[ticker] || `${ticker} Corp.`,
        currentPrice: latest.close, // 기준값: 전날 종가
        volume: latest.volume,
        rsi: rsi ?? 50,
        recommendedRsi,
        entryDays: entrySignal ? 1 : null,
        day1: pctFrom(latest.close, d1.close) ?? 0,
        day20: pctFrom(latest.close, d20.close) ?? 0,
        day50: pctFrom(latest.close, d50.close) ?? 0,
        day200: pctFrom(latest.close, d200.close) ?? 0,
        history3m: history.slice(-63)
    };
};

const fetchRealStockRow = async (ticker) => {
    const upper = ticker.toUpperCase();
    const raw = await fetchCsvByTicker(upper);
    const history = parseCsvHistory(raw);
    return buildRowFromHistory(upper, history);
};

const filterRows = () => {
    const q = tableSearch.value.trim().toUpperCase();
    const onlyEntry = entryOnly.checked;
    return screeningRows.filter((row) => {
        const matches = row.ticker.includes(q) || row.name.toUpperCase().includes(q);
        const entryMatches = onlyEntry ? row.rsi <= row.recommendedRsi : true;
        return matches && entryMatches;
    });
};

const renderRows = () => {
    const rows = filterRows();
    rowCount.textContent = `${rows.length} 종목`;

    screeningBody.innerHTML = rows
        .map((row) => {
            const isEntry = row.rsi <= row.recommendedRsi;
            const removing = loadingTickers.has(row.ticker);
            return `
                <tr data-ticker-row="${row.ticker}">
                    <td data-label="티커">${row.ticker}</td>
                    <td data-label="이름">${row.name}</td>
                    <td data-label="현재가">${formatPrice(row.currentPrice)}</td>
                    <td data-label="거래량">${row.volume.toLocaleString("en-US")}</td>
                    <td data-label="RSI" class="${isEntry ? "entry" : ""}">${row.rsi.toFixed(1)}</td>
                    <td data-label="추천 RSI">${row.recommendedRsi.toFixed(0)}</td>
                    <td data-label="진입경과" class="${isEntry ? "entry" : ""}">${isEntry ? `${row.entryDays ?? 1}일차` : "-"}</td>
                    <td data-label="1D%" class="${signClass(row.day1)}">${formatPercent(row.day1)}</td>
                    <td data-label="20D%" class="${signClass(row.day20)}">${formatPercent(row.day20)}</td>
                    <td data-label="50D%" class="${signClass(row.day50)}">${formatPercent(row.day50)}</td>
                    <td data-label="200D%" class="${signClass(row.day200)}">${formatPercent(row.day200)}</td>
                    <td data-label="관리">
                        <button class="table-remove-btn" data-remove="${row.ticker}" ${removing ? "disabled" : ""}>삭제</button>
                    </td>
                </tr>
            `;
        })
        .join("");

    updateSubtitle();
};

const removeTicker = (ticker) => {
    screeningRows = screeningRows.filter((row) => row.ticker !== ticker);
    renderRows();
    saveSettings();
};

const clearChartSvg = () => {
    while (dailyChartSvg.firstChild) {
        dailyChartSvg.removeChild(dailyChartSvg.firstChild);
    }
};

const drawDailyChart = (row) => {
    clearChartSvg();
    const candles = row.history3m || [];
    if (!candles.length) {
        chartModalSubtitle.textContent = "차트 데이터 없음";
        return;
    }

    const width = 860;
    const height = 360;
    const padX = 40;
    const padY = 24;
    const lows = candles.map((c) => c.low);
    const highs = candles.map((c) => c.high);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const range = max - min || 1;
    const step = (width - padX * 2) / candles.length;

    const yScale = (price) => height - padY - ((price - min) / range) * (height - padY * 2);

    for (let i = 0; i < 4; i += 1) {
        const y = padY + ((height - padY * 2) / 3) * i;
        const grid = document.createElementNS("http://www.w3.org/2000/svg", "line");
        grid.setAttribute("x1", String(padX));
        grid.setAttribute("x2", String(width - padX));
        grid.setAttribute("y1", String(y));
        grid.setAttribute("y2", String(y));
        grid.setAttribute("class", "grid");
        dailyChartSvg.appendChild(grid);
    }

    candles.forEach((candle, idx) => {
        const x = padX + step * idx + step * 0.5;
        const up = candle.close >= candle.open;
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", String(x));
        line.setAttribute("x2", String(x));
        line.setAttribute("y1", String(yScale(candle.high)));
        line.setAttribute("y2", String(yScale(candle.low)));
        line.setAttribute("class", up ? "candle-up" : "candle-down");
        line.setAttribute("stroke-opacity", "0.55");
        dailyChartSvg.appendChild(line);

        const body = document.createElementNS("http://www.w3.org/2000/svg", "line");
        body.setAttribute("x1", String(x));
        body.setAttribute("x2", String(x));
        body.setAttribute("y1", String(yScale(candle.open)));
        body.setAttribute("y2", String(yScale(candle.close)));
        body.setAttribute("class", up ? "candle-up" : "candle-down");
        body.setAttribute("stroke-width", "4");
        dailyChartSvg.appendChild(body);
    });

    chartModalSubtitle.textContent = `${candles[0].date} ~ ${candles[candles.length - 1].date} | 최근 3개월 일봉`;
};

const openChartModal = (ticker) => {
    const row = screeningRows.find((item) => item.ticker === ticker);
    if (!row) return;
    chartModalTitle.textContent = `${ticker} 최근 3개월 일봉 차트`;
    drawDailyChart(row);
    chartModal.classList.remove("hidden");
};

const closeChartModal = () => {
    chartModal.classList.add("hidden");
};

const addTicker = async () => {
    const symbol = tickerInput.value.trim().toUpperCase();
    if (!/^[A-Z]{1,6}$/.test(symbol)) {
        setAddMessage("티커는 영문 1~6자로 입력하세요.", true);
        return;
    }
    if (screeningRows.some((row) => row.ticker === symbol)) {
        setAddMessage(`${symbol}은 이미 추가되어 있습니다.`, true);
        return;
    }
    if (loadingTickers.has(symbol)) return;

    loadingTickers.add(symbol);
    setAddMessage(`${symbol} 실데이터 조회 중...`);
    renderRows();
    try {
        const row = await fetchRealStockRow(symbol);
        screeningRows.push(row);
        tickerInput.value = "";
        setAddMessage(`${symbol} 추가 완료 (기준: 전날 종가).`);
        saveSettings();
    } catch (error) {
        setAddMessage(`${symbol} 조회 실패: 티커 확인 또는 데이터 소스 제한`, true);
    } finally {
        loadingTickers.delete(symbol);
        renderRows();
    }
};

const initializeDefaultStocks = async (tickers) => {
    loadingTickers = new Set(tickers);
    renderRows();

    const results = await Promise.all(
        tickers.map(async (ticker) => {
            try {
                return await fetchRealStockRow(ticker);
            } catch {
                return null;
            }
        })
    );

    screeningRows = results.filter(Boolean);
    loadingTickers = new Set();
    renderRows();
};

const loadUserContext = async () => {
    const settings = loadSettings();
    if (settings?.theme) {
        applyTheme(settings.theme);
    }
    if (settings?.entryOnly) {
        entryOnly.checked = true;
    }

    const tickers = settings?.tickers?.length ? settings.tickers : defaultTickers;
    await initializeDefaultStocks(tickers);
};

const setupAuth = async () => {
    const config = window.FIREBASE_CONFIG;
    if (!config) {
        authStatus.textContent = "로그인 미설정 (window.FIREBASE_CONFIG 필요) - 게스트 저장 사용 중";
        await loadUserContext();
        return;
    }

    try {
        const [{ initializeApp }, { getAuth, GoogleAuthProvider, OAuthProvider, signInWithPopup, signOut, onAuthStateChanged }] =
            await Promise.all([
                import("https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js"),
                import("https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js")
            ]);

        const app = initializeApp(config);
        const auth = getAuth(app);
        authApi = { auth, GoogleAuthProvider, OAuthProvider, signInWithPopup, signOut };

        onAuthStateChanged(auth, async (user) => {
            currentUser = user || null;
            if (currentUser) {
                authStatus.textContent = `로그인됨: ${currentUser.email || currentUser.uid}`;
            } else {
                authStatus.textContent = "로그인 안됨 (게스트 모드)";
            }
            await loadUserContext();
        });
    } catch {
        authStatus.textContent = "로그인 모듈 로드 실패 - 게스트 저장 사용 중";
        await loadUserContext();
    }
};

screeningBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove]");
    if (button) {
        const ticker = button.getAttribute("data-remove");
        removeTicker(ticker);
        return;
    }

    const rowElement = event.target.closest("[data-ticker-row]");
    if (!rowElement) return;
    const ticker = rowElement.getAttribute("data-ticker-row");
    openChartModal(ticker);
});

addTickerBtn.addEventListener("click", addTicker);
tickerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        addTicker();
    }
});

entryOnly.addEventListener("change", () => {
    renderRows();
    saveSettings();
});
tableSearch.addEventListener("input", renderRows);

themeToggleBtn.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
});

googleLoginBtn.addEventListener("click", async () => {
    if (!authApi) {
        authStatus.textContent = "Firebase 설정이 없어 Google 로그인 불가";
        return;
    }
    try {
        await authApi.signInWithPopup(authApi.auth, new authApi.GoogleAuthProvider());
    } catch {
        authStatus.textContent = "Google 로그인 실패";
    }
});

appleLoginBtn.addEventListener("click", async () => {
    if (!authApi) {
        authStatus.textContent = "Firebase 설정이 없어 Apple 로그인 불가";
        return;
    }
    try {
        const provider = new authApi.OAuthProvider("apple.com");
        await authApi.signInWithPopup(authApi.auth, provider);
    } catch {
        authStatus.textContent = "Apple 로그인 실패 (Firebase Apple 설정 필요)";
    }
});

logoutBtn.addEventListener("click", async () => {
    if (!authApi) return;
    await authApi.signOut(authApi.auth);
});

chartModalClose.addEventListener("click", closeChartModal);
chartModal.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-modal='true']")) {
        closeChartModal();
    }
});

applyTheme("dark");
renderRiskIndicators();
setupAuth();
