const knownStocks = {
    AAPL: "Apple Inc.",
    TSLA: "Tesla Inc.",
    QQQ: "Invesco QQQ Trust",
    SPY: "SPDR S&P 500 ETF Trust",
    MSFT: "Microsoft Corp."
};

const defaultTickers = ["AAPL", "TSLA", "QQQ", "SPY", "MSFT"];

const indicatorDefs = [
    { label: "VIX", mode: "single", ticker: "VXX", unit: "", threshold: 30, riskOnHigh: true },
    { label: "장단기 금리차", mode: "spread", a: "TLT", b: "SHY", unit: "%", threshold: 0, riskOnHigh: false },
    { label: "GDP 성장률", mode: "yoy", ticker: "SPY", unit: "%", threshold: 0, riskOnHigh: false },
    { label: "실업률", mode: "single", ticker: "IWM", unit: "", threshold: 200, riskOnHigh: true },
    { label: "신용 스프레드", mode: "spread", a: "HYG", b: "IEF", unit: "%", threshold: 4, riskOnHigh: true },
    { label: "Fear & Greed", mode: "single", ticker: "QQQ", unit: "", threshold: 25, riskOnHigh: false },
    { label: "WTI 유가", mode: "single", ticker: "USO", unit: "$", threshold: 100, riskOnHigh: true },
    { label: "USD/JPY", mode: "single", ticker: "FXY", unit: "", threshold: 150, riskOnHigh: true },
    { label: "실질금리", mode: "single", ticker: "TIP", unit: "", threshold: 120, riskOnHigh: true },
    { label: "구리", mode: "single", ticker: "CPER", unit: "$", threshold: 3, riskOnHigh: false },
    { label: "일드갭", mode: "spread", a: "SPY", b: "IEF", unit: "%", threshold: 0, riskOnHigh: false }
];

const subtitleText = document.getElementById("subtitle-text");
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const menuToggleBtn = document.getElementById("menu-toggle-btn");
const sideMenu = document.getElementById("side-menu");
const loginOpenBtn = document.getElementById("login-open-btn");
const tickerInput = document.getElementById("ticker-input");
const addTickerBtn = document.getElementById("add-ticker-btn");
const addMessage = document.getElementById("add-message");
const tableSearch = document.getElementById("table-search");
const entryOnly = document.getElementById("entry-only");
const screeningBody = document.getElementById("screening-body");
const rowCount = document.getElementById("row-count");
const riskGrid = document.getElementById("risk-grid");
const riskSummary = document.getElementById("risk-summary");
const chartModal = document.getElementById("chart-modal");
const chartModalClose = document.getElementById("chart-modal-close");
const chartModalTitle = document.getElementById("chart-modal-title");
const chartModalSubtitle = document.getElementById("chart-modal-subtitle");
const dailyChartSvg = document.getElementById("daily-chart-svg");
const dailyChartTip = document.getElementById("daily-chart-tip");
const loginModal = document.getElementById("login-modal");
const loginModalClose = document.getElementById("login-modal-close");
const googleLoginBtn = document.getElementById("google-login-btn");
const logoutBtn = document.getElementById("logout-btn");
const authStatus = document.getElementById("auth-status");

let stockRows = [];
let indicatorRows = [];
let currentUser = null;
let authApi = null;
let latestBaseDate = null;
let loadingTickers = new Set();
const historyCache = new Map();

const settingsKey = () => `dashboard-settings:${currentUser?.uid || "guest"}`;

const saveSettings = () => {
    const settings = {
        theme: document.documentElement.dataset.theme || "dark",
        entryOnly: entryOnly.checked,
        tickers: stockRows.map((row) => row.ticker)
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
    subtitleText.textContent = `기준일: ${dateText} (전일 종가 기준)`;
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

const formatPercent = (value) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
const formatPrice = (value) => `$${value.toFixed(2)}`;
const signClass = (value) => (value >= 0 ? "pos" : "neg");
const pctFrom = (latest, prev) => (prev ? ((latest - prev) / prev) * 100 : null);
const toStooqSymbol = (ticker) => `${ticker.toLowerCase()}.us`;

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

const fetchCsvByTicker = async (ticker) => {
    const symbol = toStooqSymbol(ticker);
    const urls = [
        `https://r.jina.ai/http://stooq.com/q/d/l/?s=${symbol}&i=d`,
        `https://stooq.com/q/d/l/?s=${symbol}&i=d`
    ];

    for (const url of urls) {
        try {
            const res = await fetch(url);
            if (res.ok) return res.text();
        } catch {
            // try next
        }
    }
    throw new Error("데이터 조회 실패");
};

const getTickerHistory = async (ticker) => {
    const key = ticker.toUpperCase();
    if (historyCache.has(key)) return historyCache.get(key);
    const raw = await fetchCsvByTicker(key);
    const parsed = parseCsvHistory(raw);
    historyCache.set(key, parsed);
    return parsed;
};

const monthlySeries = (history) => {
    const out = [];
    let lastMonth = "";
    history.forEach((row) => {
        const month = row.date.slice(0, 7);
        if (month !== lastMonth) {
            out.push({ date: row.date, value: row.close });
            lastMonth = month;
        } else {
            out[out.length - 1] = { date: row.date, value: row.close };
        }
    });
    return out.slice(-120);
};

const mergeSpreadSeries = (aSeries, bSeries) => {
    const len = Math.min(aSeries.length, bSeries.length);
    const out = [];
    for (let i = 0; i < len; i += 1) {
        const a = aSeries[aSeries.length - len + i];
        const b = bSeries[bSeries.length - len + i];
        out.push({
            date: a.date,
            value: ((a.value / b.value) - 1) * 100
        });
    }
    return out;
};

const yoySeries = (series) => {
    const out = [];
    for (let i = 12; i < series.length; i += 1) {
        const current = series[i];
        const prev = series[i - 12];
        out.push({
            date: current.date,
            value: ((current.value / prev.value) - 1) * 100
        });
    }
    return out;
};

const buildStockRow = (ticker, history) => {
    if (history.length < 220) throw new Error("히스토리 부족");

    const latest = history[history.length - 1];
    const d1 = history[history.length - 2];
    const d20 = history[history.length - 21];
    const d50 = history[history.length - 51];
    const d200 = history[history.length - 201];
    const closes = history.map((item) => item.close);
    const rsi = computeRsi14(closes) ?? 50;
    const recommendedRsi = 30;

    latestBaseDate = latestBaseDate && latestBaseDate > latest.date ? latestBaseDate : latest.date;

    return {
        ticker,
        name: knownStocks[ticker] || `${ticker} Corp.`,
        currentPrice: latest.close,
        volume: latest.volume,
        rsi,
        recommendedRsi,
        entryDays: rsi <= recommendedRsi ? 1 : null,
        day1: pctFrom(latest.close, d1.close) ?? 0,
        day20: pctFrom(latest.close, d20.close) ?? 0,
        day50: pctFrom(latest.close, d50.close) ?? 0,
        day200: pctFrom(latest.close, d200.close) ?? 0,
        history3m: history.slice(-63).map((d) => ({ date: d.date, value: d.close }))
    };
};

const buildIndicatorRows = async () => {
    const rows = [];
    for (const def of indicatorDefs) {
        if (def.mode === "single") {
            const history = await getTickerHistory(def.ticker);
            const series = monthlySeries(history);
            const latest = series[series.length - 1];
            rows.push({ ...def, series, value: latest.value, date: latest.date });
            latestBaseDate = latestBaseDate && latestBaseDate > latest.date ? latestBaseDate : latest.date;
        } else if (def.mode === "spread") {
            const a = monthlySeries(await getTickerHistory(def.a));
            const b = monthlySeries(await getTickerHistory(def.b));
            const series = mergeSpreadSeries(a, b);
            const latest = series[series.length - 1];
            rows.push({ ...def, series, value: latest.value, date: latest.date });
            latestBaseDate = latestBaseDate && latestBaseDate > latest.date ? latestBaseDate : latest.date;
        } else if (def.mode === "yoy") {
            const base = monthlySeries(await getTickerHistory(def.ticker));
            const series = yoySeries(base);
            const latest = series[series.length - 1];
            rows.push({ ...def, series, value: latest.value, date: latest.date });
            latestBaseDate = latestBaseDate && latestBaseDate > latest.date ? latestBaseDate : latest.date;
        }
    }
    return rows;
};

const isRiskTriggered = (indicator) =>
    indicator.riskOnHigh ? indicator.value >= indicator.threshold : indicator.value <= indicator.threshold;

const renderLineChart = (svg, tipEl, points, formatY) => {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (!points || points.length < 2) return;

    const width = Number(svg.getAttribute("viewBox").split(" ")[2]);
    const height = Number(svg.getAttribute("viewBox").split(" ")[3]);
    const padLeft = 56;
    const padRight = 14;
    const padTop = 16;
    const padBottom = 28;
    const min = Math.min(...points.map((p) => p.value));
    const max = Math.max(...points.map((p) => p.value));
    const range = max - min || 1;
    const innerW = width - padLeft - padRight;
    const innerH = height - padTop - padBottom;

    const xAt = (idx) => padLeft + (innerW * idx) / (points.length - 1);
    const yAt = (val) => padTop + innerH - ((val - min) / range) * innerH;

    const addLine = (x1, y1, x2, y2, cls) => {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", String(x1));
        line.setAttribute("y1", String(y1));
        line.setAttribute("x2", String(x2));
        line.setAttribute("y2", String(y2));
        line.setAttribute("class", cls);
        svg.appendChild(line);
        return line;
    };

    const addText = (x, y, text, anchor = "middle") => {
        const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
        t.setAttribute("x", String(x));
        t.setAttribute("y", String(y));
        t.setAttribute("class", "axis-text");
        t.setAttribute("text-anchor", anchor);
        t.textContent = text;
        svg.appendChild(t);
    };

    addLine(padLeft, padTop, padLeft, height - padBottom, "axis-line");
    addLine(padLeft, height - padBottom, width - padRight, height - padBottom, "axis-line");
    addText(padLeft, padTop - 4, formatY(max), "start");
    addText(padLeft, height - padBottom + 14, formatY(min), "start");
    addText(padLeft, height - 8, points[0].date, "start");
    addText(width - padRight, height - 8, points[points.length - 1].date, "end");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const d = points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(2)} ${yAt(p.value).toFixed(2)}`)
        .join(" ");
    path.setAttribute("d", d);
    path.setAttribute("class", "line-path");
    svg.appendChild(path);

    const cross = addLine(padLeft, padTop, padLeft, height - padBottom, "crosshair");

    const updateTip = (clientX) => {
        const rect = svg.getBoundingClientRect();
        const x = Math.min(Math.max(clientX - rect.left, padLeft), width - padRight);
        const ratio = (x - padLeft) / innerW;
        const idx = Math.round(ratio * (points.length - 1));
        const point = points[idx];
        const px = xAt(idx);
        cross.setAttribute("x1", String(px));
        cross.setAttribute("x2", String(px));
        cross.style.opacity = "1";
        tipEl.classList.remove("hidden");
        tipEl.textContent = `${point.date} | ${formatY(point.value)}`;
    };

    const hideTip = () => {
        cross.style.opacity = "0";
        tipEl.classList.add("hidden");
    };

    svg.onmousemove = (e) => updateTip(e.clientX);
    svg.onmouseleave = hideTip;
    svg.ontouchstart = (e) => {
        if (e.touches[0]) updateTip(e.touches[0].clientX);
    };
    svg.ontouchmove = (e) => {
        if (e.touches[0]) updateTip(e.touches[0].clientX);
    };
    svg.ontouchend = hideTip;
};

const renderIndicators = () => {
    let triggered = 0;
    riskGrid.innerHTML = "";

    indicatorRows.forEach((item, idx) => {
        const hit = isRiskTriggered(item);
        if (hit) triggered += 1;

        const card = document.createElement("article");
        card.className = "risk-card";
        card.innerHTML = `
            <div class="risk-title">${item.label}</div>
            <div class="risk-value">${item.value.toFixed(2)}${item.unit}</div>
            <div class="risk-threshold">임계값: ${item.threshold}${item.unit}</div>
            <div class="chart-wrap">
                <svg class="risk-chart" viewBox="0 0 440 160" preserveAspectRatio="none"></svg>
                <div class="chart-tip hidden"></div>
            </div>
            <span class="badge ${hit ? "danger" : "good"}">${hit ? "위험 신호" : "정상"}</span>
        `;
        riskGrid.appendChild(card);
        const svg = card.querySelector(".risk-chart");
        const tip = card.querySelector(".chart-tip");
        renderLineChart(svg, tip, item.series, (v) => `${v.toFixed(2)}${item.unit}`);
    });

    const ratio = `${triggered}/${indicatorRows.length}`;
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

const filterStockRows = () => {
    const q = tableSearch.value.trim().toUpperCase();
    const onlyEntry = entryOnly.checked;
    return stockRows.filter((row) => {
        const matches = row.ticker.includes(q) || row.name.toUpperCase().includes(q);
        const entryMatches = onlyEntry ? row.rsi <= row.recommendedRsi : true;
        return matches && entryMatches;
    });
};

const renderStocks = () => {
    const rows = filterStockRows();
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
                    <td data-label="관리"><button class="table-remove-btn" data-remove="${row.ticker}" ${removing ? "disabled" : ""}>삭제</button></td>
                </tr>
            `;
        })
        .join("");
    updateSubtitle();
};

const openStockChartModal = (ticker) => {
    const row = stockRows.find((item) => item.ticker === ticker);
    if (!row) return;
    chartModalTitle.textContent = `${ticker} 최근 3개월 일봉`;
    chartModalSubtitle.textContent = "마우스 오버(PC) / 터치(모바일)로 날짜별 값을 확인하세요.";
    dailyChartTip.classList.add("hidden");
    renderLineChart(dailyChartSvg, dailyChartTip, row.history3m, (v) => `$${v.toFixed(2)}`);
    chartModal.classList.remove("hidden");
};

const closeStockChartModal = () => chartModal.classList.add("hidden");
const openLoginModal = () => loginModal.classList.remove("hidden");
const closeLoginModal = () => loginModal.classList.add("hidden");

const removeTicker = (ticker) => {
    stockRows = stockRows.filter((row) => row.ticker !== ticker);
    renderStocks();
    saveSettings();
};

const addTicker = async () => {
    const symbol = tickerInput.value.trim().toUpperCase();
    if (!/^[A-Z]{1,6}$/.test(symbol)) {
        setAddMessage("티커는 영문 1~6자로 입력하세요.", true);
        return;
    }
    if (stockRows.some((row) => row.ticker === symbol)) {
        setAddMessage(`${symbol}은 이미 추가되어 있습니다.`, true);
        return;
    }

    loadingTickers.add(symbol);
    setAddMessage(`${symbol} 전일 종가 데이터 조회 중...`);
    renderStocks();

    try {
        const history = await getTickerHistory(symbol);
        stockRows.push(buildStockRow(symbol, history));
        tickerInput.value = "";
        setAddMessage(`${symbol} 추가 완료`);
        saveSettings();
    } catch {
        setAddMessage(`${symbol} 조회 실패`, true);
    } finally {
        loadingTickers.delete(symbol);
        renderStocks();
    }
};

const loadStocksByTickers = async (tickers) => {
    loadingTickers = new Set(tickers);
    renderStocks();

    const results = await Promise.all(
        tickers.map(async (ticker) => {
            try {
                return buildStockRow(ticker, await getTickerHistory(ticker));
            } catch {
                return null;
            }
        })
    );
    stockRows = results.filter(Boolean);
    loadingTickers = new Set();
    renderStocks();
};

const loadUserContext = async () => {
    const settings = loadSettings();
    if (settings?.theme) applyTheme(settings.theme);
    if (settings?.entryOnly) entryOnly.checked = true;

    latestBaseDate = null;
    indicatorRows = await buildIndicatorRows();
    renderIndicators();

    const tickers = settings?.tickers?.length ? settings.tickers : defaultTickers;
    await loadStocksByTickers(tickers);
};

const setupAuth = async () => {
    const config = window.FIREBASE_CONFIG;
    if (!config) {
        authStatus.textContent = "로그인 미설정 (window.FIREBASE_CONFIG 필요) - 게스트 저장 사용 중";
        await loadUserContext();
        return;
    }

    try {
        const [{ initializeApp }, { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }] = await Promise.all([
            import("https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js"),
            import("https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js")
        ]);
        const app = initializeApp(config);
        const auth = getAuth(app);
        authApi = { auth, GoogleAuthProvider, signInWithPopup, signOut };

        onAuthStateChanged(auth, async (user) => {
            currentUser = user || null;
            authStatus.textContent = currentUser ? `로그인됨: ${currentUser.email || currentUser.uid}` : "로그인 안됨 (게스트 모드)";
            await loadUserContext();
        });
    } catch {
        authStatus.textContent = "로그인 모듈 로드 실패 - 게스트 저장 사용 중";
        await loadUserContext();
    }
};

menuToggleBtn.addEventListener("click", () => sideMenu.classList.toggle("hidden"));
document.addEventListener("click", (event) => {
    if (!sideMenu.classList.contains("hidden")) {
        if (!event.target.closest("#side-menu") && !event.target.closest("#menu-toggle-btn")) {
            sideMenu.classList.add("hidden");
        }
    }
});

themeToggleBtn.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
});

addTickerBtn.addEventListener("click", addTicker);
tickerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        addTicker();
    }
});
entryOnly.addEventListener("change", () => {
    renderStocks();
    saveSettings();
});
tableSearch.addEventListener("input", renderStocks);

screeningBody.addEventListener("click", (event) => {
    const removeBtn = event.target.closest("[data-remove]");
    if (removeBtn) {
        removeTicker(removeBtn.getAttribute("data-remove"));
        return;
    }
    const rowEl = event.target.closest("[data-ticker-row]");
    if (rowEl) {
        openStockChartModal(rowEl.getAttribute("data-ticker-row"));
    }
});

chartModalClose.addEventListener("click", closeStockChartModal);
chartModal.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-modal='true']")) closeStockChartModal();
});

loginOpenBtn.addEventListener("click", openLoginModal);
loginModalClose.addEventListener("click", closeLoginModal);
loginModal.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-login='true']")) closeLoginModal();
});

googleLoginBtn.addEventListener("click", async () => {
    if (!authApi) {
        authStatus.textContent = "Firebase 설정이 없어 Google 로그인 불가";
        return;
    }
    try {
        await authApi.signInWithPopup(authApi.auth, new authApi.GoogleAuthProvider());
        closeLoginModal();
    } catch {
        authStatus.textContent = "Google 로그인 실패";
    }
});

logoutBtn.addEventListener("click", async () => {
    if (!authApi) return;
    await authApi.signOut(authApi.auth);
});

applyTheme("dark");
setupAuth();
