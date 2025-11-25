// ================= CONFIG =================
// Replace this only if you have a different API Gateway URL.
// You gave: a1i1yi2zgvdh8u-ats.iot.ap-southeast-1.amazonaws.com/prod/predict
// If your Lambda is fronted by API Gateway use its full URL (https://xxxxx.execute-api...)
// For now we will attempt a POST to the provided endpoint.
const API_URL = "https://a1i1yi2zgvdh8u-ats.iot.ap-southeast-1.amazonaws.com/prod/predict";
// =========================================

const predictBtn = document.getElementById("predictBtn");
const batteryRange = document.getElementById("batteryRange");
const batteryValue = document.getElementById("batteryValue");

batteryRange.addEventListener("input", () => {
  batteryValue.textContent = batteryRange.value;
});

predictBtn.addEventListener("click", async () => {
  await doPredict();
});

function readInputs() {
  const car = document.getElementById("carSelect").value;
  const battery_level_percent = Number(document.getElementById("batteryRange").value) || 100;

  // Use user inputs if provided; otherwise let Lambda use defaults
  const body = {
    Car_name: car,
    "Battery_Level(%)": battery_level_percent
  };

  const maybe = [
    ["Battery_kWh", "battery_kwh"],
    ["Efficiency_km_kWh", "efficiency"],
    ["Fast_charge_kW", "fast_charge"],
    ["Top_speed_kmh", "top_speed"],
    ["Acceleration_s", "acceleration"]
  ];

  maybe.forEach(([k, id]) => {
    const el = document.getElementById(id);
    if (el && el.value !== "") {
      const v = Number(el.value);
      if (!isNaN(v)) body[k] = v;
    }
  });

  return body;
}

async function doPredict() {
  const resultBox = document.getElementById("predictionText");
  const rawBox = document.getElementById("rawResponse");
  resultBox.textContent = "Loading...";
  rawBox.textContent = "-";

  const payload = readInputs();

  try {
    const resp = await fetch(API_URL, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // If your endpoint requires auth, this will fail. See notes below.
    });

    // handle non-200
    if (!resp.ok) {
      const text = await resp.text();
      rawBox.textContent = `HTTP ${resp.status}\n\n${text}`;
      resultBox.textContent = `Request failed: HTTP ${resp.status}`;
      return;
    }

    // Try parse as JSON — handle two common patterns:
    // 1) API Gateway -> returns { statusCode:200, body: "..." }
    // 2) Direct lambda or endpoint -> returns the body directly
    const contentType = resp.headers.get("content-type") || "";
    let j;
    if (contentType.includes("application/json")) {
      j = await resp.json();
    } else {
      const t = await resp.text();
      try { j = JSON.parse(t); } catch(e) { j = t; }
    }

    rawBox.textContent = JSON.stringify(j, null, 2);

    // If API Gateway style (statusCode + body string)
    let payloadObj = j;
    if (j && typeof j === "object" && j.statusCode && j.body) {
      try {
        payloadObj = typeof j.body === "string" ? JSON.parse(j.body) : j.body;
      } catch(e) {
        payloadObj = j.body;
      }
    }

    // Look for common keys your Lambda returns:
    const predicted = payloadObj.predicted_range_km ?? payloadObj.prediction ?? payloadObj.predicted_range ?? null;
    const battery_out = payloadObj.battery_level_percent ?? payloadObj.battery_level ?? null;

    if (predicted !== null && predicted !== undefined) {
      resultBox.innerHTML = `Predicted range: <strong>${predicted}</strong> km` +
        (battery_out ? `<br>Battery: ${battery_out}%` : "");
    } else {
      resultBox.textContent = "No prediction key found in response — check raw output.";
    }

  } catch (err) {
    rawBox.textContent = String(err);
    resultBox.textContent = "Request failed (see debug).";
  }
}
