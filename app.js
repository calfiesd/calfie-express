const quoteForm = document.getElementById("quoteForm");
const rateCards = document.getElementById("rateCards");
const selectedSummary = document.getElementById("selectedSummary");
const purchaseButton = document.getElementById("purchaseButton");
const purchaseDialog = document.getElementById("purchaseDialog");
const dialogText = document.getElementById("dialogText");
const closeDialog = document.getElementById("closeDialog");
const resetButton = document.getElementById("resetButton");
const heroMargin = document.getElementById("heroMargin");
const heroSavings = document.getElementById("heroSavings");

let selectedRate = null;

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function readFormData() {
  const formData = new FormData(quoteForm);
  return {
    fromZip: String(formData.get("fromZip") || "").trim(),
    toZip: String(formData.get("toZip") || "").trim(),
    weight: Number(formData.get("weight") || 0),
    declaredValue: Number(formData.get("declaredValue") || 0),
    length: Number(formData.get("length") || 0),
    width: Number(formData.get("width") || 0),
    height: Number(formData.get("height") || 0),
    speed: String(formData.get("speed") || "standard"),
    packageType: String(formData.get("packageType") || "custom"),
    signature: formData.get("signature") === "on",
    residential: formData.get("residential") === "on"
  };
}

function buildRates(input) {
  const zoneSpread = Math.abs(Number(input.fromZip.slice(0, 3)) - Number(input.toZip.slice(0, 3)));
  const zoneFactor = Math.min(zoneSpread / 100, 8);
  const volume = input.length * input.width * input.height;
  const dimensionalWeight = volume / 139;
  const billableWeight = Math.max(input.weight, dimensionalWeight);
  const speedMultiplier = {
    economy: 0.92,
    standard: 1,
    express: 1.48
  }[input.speed];

  const accessorials =
    (input.signature ? 6.35 : 0) +
    (input.residential ? 4.9 : 0) +
    Math.max(0, (input.declaredValue - 100) * 0.012);

  const packageFactor = input.packageType === "custom" ? 1 : 0.88;
  const baseCost = (8.4 + zoneFactor + billableWeight * 1.78) * speedMultiplier * packageFactor + accessorials;

  return [
    {
      id: "ups-ground",
      carrier: "UPS",
      service: input.speed === "express" ? "UPS 2nd Day Air" : "UPS Ground",
      transit: input.speed === "express" ? "2 business days" : "3-4 business days",
      carrierCost: baseCost,
      retailPrice: baseCost + 4.55,
      counterPrice: baseCost + 12.8
    },
    {
      id: "fedex-ground",
      carrier: "FedEx",
      service: input.speed === "express" ? "FedEx Express Saver" : "FedEx Ground",
      transit: input.speed === "express" ? "3 business days" : "2-5 business days",
      carrierCost: baseCost + 0.9,
      retailPrice: baseCost + 5.1,
      counterPrice: baseCost + 13.7
    },
    {
      id: "fedex-priority",
      carrier: "FedEx",
      service: "FedEx Priority Overnight",
      transit: "Next business day",
      carrierCost: baseCost * 1.92,
      retailPrice: baseCost * 1.92 + 7.4,
      counterPrice: baseCost * 1.92 + 19.6
    }
  ].map((rate) => ({
    ...rate,
    savingsPct: Math.max(8, Math.round((1 - rate.retailPrice / rate.counterPrice) * 100)),
    margin: rate.retailPrice - rate.carrierCost
  }));
}

function renderRates(rates) {
  rateCards.innerHTML = "";

  rates.forEach((rate) => {
    const article = document.createElement("article");
    article.className = `rate-card${selectedRate?.id === rate.id ? " selected" : ""}`;
    article.innerHTML = `
      <div class="rate-top">
        <div>
          <div class="service-name">${rate.carrier} · ${rate.service}</div>
          <div class="service-meta">${rate.transit}</div>
        </div>
        <div class="price-row">
          <div>
            <div class="price">${money(rate.retailPrice)}</div>
            <div class="price-meta">Customer price</div>
          </div>
        </div>
      </div>
      <p class="service-meta">Your cost ${money(rate.carrierCost)} · Margin ${money(rate.margin)} · Customer saves ${rate.savingsPct}%</p>
      <button class="button button-secondary" type="button">Select service</button>
    `;

    article.querySelector("button").addEventListener("click", () => {
      selectedRate = rate;
      heroMargin.textContent = money(rate.margin);
      heroSavings.textContent = `${rate.savingsPct}%`;
      renderRates(rates);
      renderSelectedRate();
    });

    rateCards.appendChild(article);
  });
}

function renderSelectedRate() {
  if (!selectedRate) {
    selectedSummary.innerHTML = "<p>Select a rate to preview checkout, label creation, and fulfillment.</p>";
    purchaseButton.disabled = true;
    return;
  }

  selectedSummary.innerHTML = `
    <strong>${selectedRate.carrier} · ${selectedRate.service}</strong>
    <p>Transit: ${selectedRate.transit}</p>
    <p>Customer charge: ${money(selectedRate.retailPrice)}</p>
    <p>Your carrier cost: ${money(selectedRate.carrierCost)}</p>
    <p>Gross margin: ${money(selectedRate.margin)}</p>
  `;
  purchaseButton.disabled = false;
}

function refreshQuote() {
  const input = readFormData();
  const rates = buildRates(input);
  selectedRate = rates[0];
  heroMargin.textContent = money(selectedRate.margin);
  heroSavings.textContent = `${selectedRate.savingsPct}%`;
  renderRates(rates);
  renderSelectedRate();
}

quoteForm.addEventListener("submit", (event) => {
  event.preventDefault();
  refreshQuote();
});

purchaseButton.addEventListener("click", () => {
  if (!selectedRate) {
    return;
  }

  dialogText.textContent =
    `In production, this step would charge ${money(selectedRate.retailPrice)}, then call your server to ` +
    `purchase the ${selectedRate.carrier} label, store the PDF, and email the tracking number to the customer.`;
  purchaseDialog.showModal();
});

closeDialog.addEventListener("click", () => {
  purchaseDialog.close();
});

resetButton.addEventListener("click", () => {
  quoteForm.reset();
  quoteForm.querySelector('[name="fromZip"]').value = "91710";
  quoteForm.querySelector('[name="toZip"]').value = "10001";
  quoteForm.querySelector('[name="weight"]').value = "4";
  quoteForm.querySelector('[name="declaredValue"]').value = "120";
  quoteForm.querySelector('[name="length"]').value = "12";
  quoteForm.querySelector('[name="width"]').value = "10";
  quoteForm.querySelector('[name="height"]').value = "8";
  quoteForm.querySelector('[name="speed"]').value = "standard";
  quoteForm.querySelector('[name="packageType"]').value = "custom";
  refreshQuote();
});

refreshQuote();
