const screeningRows = [
    {
        ticker: "SOXL",
        name: "Direxion Daily Semiconductor Bull 3X",
        currentPrice: 49.24,
        volume: 35312210,
        rsi: 28.4,
        recommendedRsi: 30,
        entryDays: 3,
        day1: -1.82,
        day20: -8.14,
        day50: 12.45,
        day200: 38.21,
        v22Capital: 182000,
        v30Capital: 245000
    },
    {
        ticker: "TQQQ",
        name: "ProShares UltraPro QQQ",
        currentPrice: 64.91,
        volume: 54120823,
        rsi: 31.1,
        recommendedRsi: 30,
        entryDays: null,
        day1: 0.44,
        day20: -2.74,
        day50: 8.22,
        day200: 42.92,
        v22Capital: 210000,
        v30Capital: 283000
    },
    {
        ticker: "UPRO",
        name: "ProShares UltraPro S&P500",
        currentPrice: 82.53,
        volume: 4277004,
        rsi: 29.7,
        recommendedRsi: 30,
        entryDays: 1,
        day1: -0.65,
        day20: -4.21,
        day50: 6.07,
        day200: 31.11,
        v22Capital: 196000,
        v30Capital: 269000
    },
    {
        ticker: "TECL",
        name: "Direxion Daily Technology Bull 3X",
        currentPrice: 71.88,
        volume: 2165433,
        rsi: 26.2,
        recommendedRsi: 28,
        entryDays: 5,
        day1: -2.37,
        day20: -10.84,
        day50: 10.03,
        day200: 36.59,
        v22Capital: 224000,
        v30Capital: 304000
    },
    {
        ticker: "SPXL",
        name: "Direxion Daily S&P 500 Bull 3X",
        currentPrice: 147.31,
        volume: 6880221,
        rsi: 33.9,
        recommendedRsi: 30,
        entryDays: null,
        day1: 0.81,
        day20: -1.2,
        day50: 7.11,
        day200: 28.09,
        v22Capital: 190000,
        v30Capital: 260000
    }
];

const economicIndicators = [
    { label: "VIX", value: 31.2, threshold: 30, unit: "", riskOnHigh: true },
    { label: "장단기 금리차", value: -0.2, threshold: 0, unit: "%", riskOnHigh: false },
    { label: "GDP 성장률", value: 1.8, threshold: 0, unit: "%", riskOnHigh: false },
    { label: "실업률", value: 4.3, threshold: 5, unit: "%", riskOnHigh: true },
    { label: "신용 스프레드", value: 4.6, threshold: 4, unit: "%", riskOnHigh: true },
    { label: "Fear & Greed", value: 21, threshold: 25, unit: "", riskOnHigh: false },
    { label: "WTI 유가", value: 102.4, threshold: 100, unit: "$", riskOnHigh: true },
    { label: "USD/JPY", value: 151.2, threshold: 150, unit: "", riskOnHigh: true },
    { label: "실질금리", value: 2.1, threshold: 2, unit: "%", riskOnHigh: true },
    { label: "구리", value: 2.7, threshold: 3, unit: "$/lb", riskOnHigh: false },
    { label: "일드갭", value: -0.4, threshold: 0, unit: "%", riskOnHigh: false }
];

const tickerSearch = document.getElementById("ticker-search");
const entryOnly = document.getElementById("entry-only");
const screeningBody = document.getElementById("screening-body");
const rowCount = document.getElementById("row-count");
const riskGrid = document.getElementById("risk-grid");
const riskSummary = document.getElementById("risk-summary");

const formatDollar = (value) => `$${value.toLocaleString("en-US")}`;
const formatPercent = (value) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
const formatPrice = (value) => `$${value.toFixed(2)}`;

const isRiskTriggered = (indicator) =>
    indicator.riskOnHigh ? indicator.value >= indicator.threshold : indicator.value <= indicator.threshold;

const riskBadgeClass = (triggered) => (triggered ? "danger" : "good");
const signClass = (value) => (value >= 0 ? "pos" : "neg");

const renderRiskIndicators = () => {
    let triggeredCount = 0;
    riskGrid.innerHTML = economicIndicators
        .map((indicator) => {
            const triggered = isRiskTriggered(indicator);
            if (triggered) {
                triggeredCount += 1;
            }
            return `
                <article class="risk-card">
                    <div class="risk-title">${indicator.label}</div>
                    <div class="risk-value">${indicator.value}${indicator.unit}</div>
                    <div class="risk-threshold">임계값: ${indicator.threshold}${indicator.unit}</div>
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
    const q = tickerSearch.value.trim().toUpperCase();
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
                    <td>${row.ticker}</td>
                    <td>${row.name}</td>
                    <td>${formatPrice(row.currentPrice)}</td>
                    <td>${row.volume.toLocaleString("en-US")}</td>
                    <td class="${isEntry ? "entry" : ""}">${row.rsi.toFixed(1)}</td>
                    <td>${row.recommendedRsi.toFixed(0)}</td>
                    <td class="${isEntry ? "entry" : ""}">${entryText}</td>
                    <td class="${signClass(row.day1)}">${formatPercent(row.day1)}</td>
                    <td class="${signClass(row.day20)}">${formatPercent(row.day20)}</td>
                    <td class="${signClass(row.day50)}">${formatPercent(row.day50)}</td>
                    <td class="${signClass(row.day200)}">${formatPercent(row.day200)}</td>
                    <td>${formatDollar(row.v22Capital)}</td>
                    <td>${formatDollar(row.v30Capital)}</td>
                </tr>
            `;
        })
        .join("");
};

tickerSearch.addEventListener("input", renderRows);
entryOnly.addEventListener("change", renderRows);

renderRiskIndicators();
renderRows();
