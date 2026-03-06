const knownStocks = {
    AAPL: "Apple Inc.",
    TSLA: "Tesla Inc.",
    QQQ: "Invesco QQQ Trust",
    SPY: "SPDR S&P 500 ETF Trust",
    MSFT: "Microsoft Corp."
};

const initialTickers = ["AAPL", "TSLA", "QQQ", "SPY", "MSFT"];

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

const tickerInput = document.getElementById("ticker-input");
const addTickerBtn = document.getElementById("add-ticker-btn");
const addMessage = document.getElementById("add-message");
const tableSearch = document.getElementById("table-search");
const entryOnly = document.getElementById("entry-only");
const screeningBody = document.getElementById("screening-body");
const rowCount = document.getElementById("row-count");
const riskGrid = document.getElementById("risk-grid");
const riskSummary = document.getElementById("risk-summary");

let screeningRows = [];

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

const createStockRow = (ticker) => {
    const symbol = ticker.toUpperCase();
    const seed = hashString(symbol);
    const base = 40 + pseudoRandom(seed) * 360;
    const rsi = 20 + pseudoRandom(seed + 1) * 30;
    const recommendedRsi = 28 + Math.floor(pseudoRandom(seed + 2) * 6);
    const inEntry = rsi <= recommendedRsi;

    return {
        ticker: symbol,
        name: knownStocks[symbol] || `${symbol} Corp.`,
        currentPrice: Number(base.toFixed(2)),
        volume: Math.round(1_500_000 + pseudoRandom(seed + 3) * 95_000_000),
        rsi: Number(rsi.toFixed(1)),
        recommendedRsi,
        entryDays: inEntry ? Math.floor(pseudoRandom(seed + 4) * 10) + 1 : null,
        day1: Number((-3 + pseudoRandom(seed + 5) * 6).toFixed(2)),
        day20: Number((-12 + pseudoRandom(seed + 6) * 24).toFixed(2)),
        day50: Number((-18 + pseudoRandom(seed + 7) * 38).toFixed(2)),
        day200: Number((-30 + pseudoRandom(seed + 8) * 85).toFixed(2))
    };
};

const createHistory = (meta) => {
    const points = 120; // 10 years monthly
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

const riskBadgeClass = (triggered) => (triggered ? "danger" : "good");

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
    let triggeredCount = 0;
    riskGrid.innerHTML = economicIndicators
        .map((indicator) => {
            const triggered = isRiskTriggered(indicator);
            if (triggered) triggeredCount += 1;

            const points = createSparkPath(indicator.history, 240, 70, 6);
            return `
                <article class="risk-card">
                    <div class="risk-title">${indicator.label}</div>
                    <div class="risk-value">${indicator.value}${indicator.unit}</div>
                    <div class="risk-threshold">임계값: ${indicator.threshold}${indicator.unit} | 최근 10년(월별)</div>
                    <svg class="risk-chart" viewBox="0 0 240 70" preserveAspectRatio="none" aria-label="${indicator.label} 10-year chart">
                        <line x1="0" y1="64" x2="240" y2="64" class="axis"></line>
                        <polyline points="${points}" class="line"></polyline>
                    </svg>
                    <span class="badge ${riskBadgeClass(triggered)}">${triggered ? "위험 신호" : "정상"}</span>
                </article>
            `;
        })
        .join("");

    const ratio = `${triggeredCount}/${economicIndicators.length}`;
    if (triggeredCount >= 6) {
        riskSummary.className = "badge danger";
        riskSummary.textContent = `위험 높음 (${ratio})`;
    } else if (triggeredCount >= 3) {
        riskSummary.className = "badge warn";
        riskSummary.textContent = `주의 (${ratio})`;
    } else {
        riskSummary.className = "badge good";
        riskSummary.textContent = `안정 (${ratio})`;
    }
};

const filterRows = () => {
    const q = tableSearch.value.trim().toUpperCase();
    const mustBeEntry = entryOnly.checked;
    return screeningRows.filter((row) => {
        const matchesSearch = row.ticker.includes(q) || row.name.toUpperCase().includes(q);
        const matchesEntry = mustBeEntry ? row.rsi <= row.recommendedRsi : true;
        return matchesSearch && matchesEntry;
    });
};

const renderRows = () => {
    const rows = filterRows();
    rowCount.textContent = `${rows.length} 종목`;

    screeningBody.innerHTML = rows
        .map((row) => {
            const isEntry = row.rsi <= row.recommendedRsi;
            const entryText = isEntry ? `${row.entryDays ?? 0}일차` : "-";
            return `
                <tr>
                    <td data-label="티커">${row.ticker}</td>
                    <td data-label="이름">${row.name}</td>
                    <td data-label="현재가">${formatPrice(row.currentPrice)}</td>
                    <td data-label="거래량">${row.volume.toLocaleString("en-US")}</td>
                    <td data-label="RSI" class="${isEntry ? "entry" : ""}">${row.rsi.toFixed(1)}</td>
                    <td data-label="추천 RSI">${row.recommendedRsi.toFixed(0)}</td>
                    <td data-label="진입경과" class="${isEntry ? "entry" : ""}">${entryText}</td>
                    <td data-label="1D%" class="${signClass(row.day1)}">${formatPercent(row.day1)}</td>
                    <td data-label="20D%" class="${signClass(row.day20)}">${formatPercent(row.day20)}</td>
                    <td data-label="50D%" class="${signClass(row.day50)}">${formatPercent(row.day50)}</td>
                    <td data-label="200D%" class="${signClass(row.day200)}">${formatPercent(row.day200)}</td>
                </tr>
            `;
        })
        .join("");
};

const showAddMessage = (text, isError = false) => {
    addMessage.style.color = isError ? "#ff9e9e" : "#9caecc";
    addMessage.textContent = text;
};

const addTicker = () => {
    const symbol = tickerInput.value.trim().toUpperCase();
    if (!/^[A-Z]{1,6}$/.test(symbol)) {
        showAddMessage("티커는 영문 1~6자로 입력하세요.", true);
        return;
    }
    if (screeningRows.some((row) => row.ticker === symbol)) {
        showAddMessage(`${symbol}은 이미 추가되어 있습니다.`, true);
        return;
    }

    screeningRows.push(createStockRow(symbol));
    tickerInput.value = "";
    showAddMessage(`${symbol} 종목이 추가되었습니다.`);
    renderRows();
};

addTickerBtn.addEventListener("click", addTicker);
tickerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        addTicker();
    }
});
tableSearch.addEventListener("input", renderRows);
entryOnly.addEventListener("change", renderRows);

screeningRows = initialTickers.map(createStockRow);
renderRiskIndicators();
renderRows();
