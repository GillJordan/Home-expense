const apiURL = "/.netlify/functions/addExpense";

// ✅ Form submit
document.getElementById("dataForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  const formData = new FormData(this);
  const data = Object.fromEntries(formData.entries());

  if (!navigator.onLine) {
    let offlineData = JSON.parse(localStorage.getItem("offlineData") || "[]");
    offlineData.push(data);
    localStorage.setItem("offlineData", JSON.stringify(offlineData));
    alert("📴 Saved offline, will sync later");
    return;
  }

  try {
    const res = await fetch(apiURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.message) {
      alert("✅ Data added");
      this.reset();
      loadDailyData(new Date().toISOString().split("T")[0]);
    }
  } catch (err) {
    alert("❌ Error: " + err.message);
  }
});

// ✅ Sync offline data
async function syncOfflineData() {
  if (!navigator.onLine) return;
  let offlineData = JSON.parse(localStorage.getItem("offlineData") || "[]");
  if (offlineData.length === 0) return;

  for (let entry of offlineData) {
    await fetch(apiURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry)
    });
  }
  localStorage.removeItem("offlineData");
}
window.addEventListener("online", syncOfflineData);

// ✅ Load today's expenses
async function loadDailyData(date) {
  try {
    const res = await fetch(`${apiURL}?daily=true&date=${date}`);
    const result = await res.json();
    if (!result.data) return;

    let rows = result.data;
    let html = `<table class="w-full text-left border border-gray-600">
      <thead><tr class="bg-gray-800">
      <th class="p-2 border border-gray-700">Date</th>
      <th class="p-2 border border-gray-700">Product</th>
      <th class="p-2 border border-gray-700">Debit</th>
      <th class="p-2 border border-gray-700">For</th>
      <th class="p-2 border border-gray-700">Qty</th>
      <th class="p-2 border border-gray-700">By</th>
      <th class="p-2 border border-gray-700">From</th>
      </tr></thead><tbody>`;

    rows.forEach(r => {
      html += `<tr>
        <td class="p-2 border border-gray-700">${r[1]}</td>
        <td class="p-2 border border-gray-700">${r[4]}</td>
        <td class="p-2 border border-gray-700">${r[3]}</td>
        <td class="p-2 border border-gray-700">${r[5]}</td>
        <td class="p-2 border border-gray-700">${r[6]}</td>
        <td class="p-2 border border-gray-700">${r[7]}</td>
        <td class="p-2 border border-gray-700">${r[8]}</td>
      </tr>`;
    });
    html += "</tbody></table>";

    document.getElementById("dailyData").innerHTML = html;
  } catch (err) {
    console.error("❌ Daily fetch error:", err);
  }
}

// ✅ Search
async function searchProduct() {
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;

  let url = `${apiURL}?search=${encodeURIComponent(query)}`;
  if (startDate && endDate) url += `&startDate=${startDate}&endDate=${endDate}`;

  try {
    const res = await fetch(url);
    const result = await res.json();
    let rows = result.data || [];

    let html = `<table class="w-full text-left border border-gray-600 mt-4">
      <thead><tr class="bg-gray-800">
      <th class="p-2 border border-gray-700">Date</th>
      <th class="p-2 border border-gray-700">Product</th>
      <th class="p-2 border border-gray-700">Debit</th>
      <th class="p-2 border border-gray-700">For</th>
      <th class="p-2 border border-gray-700">Qty</th>
      <th class="p-2 border border-gray-700">By</th>
      <th class="p-2 border border-gray-700">From</th>
      </tr></thead><tbody>`;

    rows.forEach(r => {
      html += `<tr>
        <td class="p-2 border border-gray-700">${r[1]}</td>
        <td class="p-2 border border-gray-700">${r[4]}</td>
        <td class="p-2 border border-gray-700">${r[3]}</td>
        <td class="p-2 border border-gray-700">${r[5]}</td>
        <td class="p-2 border border-gray-700">${r[6]}</td>
        <td class="p-2 border border-gray-700">${r[7]}</td>
        <td class="p-2 border border-gray-700">${r[8]}</td>
      </tr>`;
    });
    html += "</tbody></table>";
    html += `<p class="mt-2">Total Debit: ${result.totalDebit || 0}</p>`;

    document.getElementById("searchResults").innerHTML = html;
  } catch (err) {
    console.error("❌ Search error:", err);
  }
}
