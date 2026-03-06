class StockCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
    }

    connectedCallback() {
        const ticker = this.getAttribute("ticker") || "";
        this.shadowRoot.innerHTML = `
            <style>
                .card {
                    display: grid;
                    gap: 8px;
                    border: 1px solid #dbe6f1;
                    border-radius: 12px;
                    padding: 14px;
                    background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
                    box-shadow: 0 4px 12px rgba(17, 58, 98, 0.08);
                }
                .label {
                    font-size: 0.78rem;
                    color: #56657a;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                }
                .ticker {
                    font-size: 1.35rem;
                    font-weight: 700;
                    color: #103b6b;
                }
                .remove-btn {
                    justify-self: start;
                    padding: 7px 10px;
                    border: 1px solid #c9d8e8;
                    background: #fff;
                    border-radius: 8px;
                    color: #36495f;
                    cursor: pointer;
                    font-size: 0.86rem;
                }
            </style>
            <article class="card">
                <div class="label">Ticker</div>
                <div class="ticker">${ticker}</div>
                <button class="remove-btn" type="button">Remove</button>
            </article>
        `;

        const removeBtn = this.shadowRoot.querySelector(".remove-btn");
        removeBtn.addEventListener("click", () => {
            this.dispatchEvent(
                new CustomEvent("remove-stock", {
                    bubbles: true,
                    composed: true,
                    detail: { ticker }
                })
            );
        });
    }
}

if (!customElements.get("stock-card")) {
    customElements.define("stock-card", StockCard);
}

const form = document.getElementById("add-stock-form");
const stockList = document.getElementById("stock-list");
const tickerInput = document.getElementById("stock-ticker-input");
const formMessage = document.getElementById("form-message");
const stocks = new Set();

const showMessage = (text = "") => {
    formMessage.textContent = text;
};

const isValidTicker = (value) => /^[A-Z]{1,8}$/.test(value);

const add = (event) => {
    event.preventDefault();
    const ticker = tickerInput.value.trim().toUpperCase();

    if (!ticker) {
        showMessage("Please enter a ticker symbol.");
        return;
    }

    if (!isValidTicker(ticker)) {
        showMessage("Use only letters, up to 8 characters.");
        return;
    }

    if (stocks.has(ticker)) {
        showMessage(`"${ticker}" is already in your list.`);
        return;
    }

    const newStockCard = document.createElement("stock-card");
    newStockCard.setAttribute("ticker", ticker);
    stockList.appendChild(newStockCard);
    stocks.add(ticker);
    tickerInput.value = "";
    showMessage("");
    tickerInput.focus();
};

stockList.addEventListener("remove-stock", (event) => {
    const ticker = event.detail?.ticker;
    const card = event.target;
    if (ticker) {
        stocks.delete(ticker);
    }
    if (card && card.tagName === "STOCK-CARD") {
        card.remove();
    }
});

form.addEventListener("submit", add);
