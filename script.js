const apiURL = "/.netlify/functions/addExpense";

// Auto set today's date + load today's panel
window.addEventListener("load", () => {
  const d = document.getElementById("dateInput");
  if (d && !d.value) d.value = new Date().toISOString().split("T")[0];
  loadDailyData(new Date().toISOString().split("T")[0]);
});

// Submit handler
document.getElementById("dataForm")?.addEventListener("submit", async function (e) {
  e.preventDefault();
  const formData = new FormData(this);
  const data = Object.fromEntries(formData.entries());

  try {
    const res = await fetch(apiURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Server error");

    alert("✅ Data added");
    this.reset();
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("dateInput").value = today;
    loadDailyData(today);
  } catch (err) {
    alert("❌ " + err.message);
    console.error(err);
  }
});

// ---- Daily panel ----
// Column mapping (A–M): 0 Day | 1 Date | 2 Credit | 3 LeftBal | 4 Debit | 5 Product | 6 For | 7 Qty | 8 By | 9 From
async function loadDailyData(dateISO) {
  const box = document.getElementById("dailyData");
  try {
    const res = await fetch(`${apiURL}?daily=true&date=${dateISO}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Daily load failed");

    const rows = json.data || [];
    if (!rows.length) {
      box.innerHTML = "<p class='text-gray-400'>No data for today</p>";
      return;
    }

    let total = 0;
    const body = rows.map(r => {
      const debit = parseFloat(r[4] || 0) || 0; // E = Debit
      total += debit;
      return `
        <tr>
          <td class="p-2 border border-gray-700">${r[1] || ""}</td>  <!-- B Date -->
          <td class="p-2 border border-gray-700">${r[5] || ""}</td>  <!-- F Product -->
          <td class="p-2 border border-gray-700">${r[4] || ""}</td>  <!-- E Debit -->
          <td class="p-2 border border-gray-700">${r[6] || ""}</td>  <!-- G For -->
          <td class="p-2 border border-gray-700">${r[7] || ""}</td>  <!-- H Qty -->
          <td class="p-2 border border-gray-700">${r[8] || ""}</td>  <!-- I By -->
          <td class="p-2 border border-gray-700">${r[9] || ""}</td>  <!-- J From -->
        </tr>
      `;
    }).join("");

    box.innerHTML = `
      <table class="w-full text-left border border-gray-600">
        <thead>
          <tr class="bg-gray-800">
            <th class="p-2 border border-gray-700">Date</th>
            <th class="p-2 border border-gray-700">Product</th>
            <th class="p-2 border border-gray-700">Debit</th>
            <th class="p-2 border border-gray-700">For</th>
            <th class="p-2 border border-gray-700">Qty</th>
            <th class="p-2 border border-gray-700">By</th>
            <th class="p-2 border border-gray-700">From</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
      <p class="mt-3 font-bold text-green-400">Total Debit Today: ${total}</p>
    `;
  } catch (e) {
    box.innerHTML = `<p class="text-red-400">Error: ${e.message}</p>`;
  }
}

// ---- Search ----
window.searchProduct = async function () {
  const q = (document.getElementById("searchInput").value || "").trim();
  const s = document.getElementById("startDate").value || "";
  const e = document.getElementById("endDate").value || "";

  let url = `${apiURL}?search=${encodeURIComponent(q)}`;
  if (s && e) url += `&startDate=${s}&endDate=${e}`;

  const target = document.getElementById("searchResults");
  try {
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Search failed");

    const rows = json.data || [];
    if (!rows.length) {
      target.innerHTML = "<p class='text-red-400'>No records found</p>";
      return;
    }

    const total = rows.reduce((sum, r) => sum + (parseFloat(r[4] || 0) || 0), 0); // E = Debit

    const body = rows.map(r => `
      <tr>
        <td class="p-2 border border-gray-700">${r[1] || ""}</td>  <!-- B Date -->
        <td class="p-2 border border-gray-700">${r[5] || ""}</td>  <!-- F Product -->
        <td class="p-2 border border-gray-700">${r[4] || ""}</td>  <!-- E Debit -->
        <td class="p-2 border border-gray-700">${r[6] || ""}</td>  <!-- G For -->
        <td class="p-2 border border-gray-700">${r[7] || ""}</td>  <!-- H Qty -->
        <td class="p-2 border border-gray-700">${r[8] || ""}</td>  <!-- I By -->
        <td class="p-2 border border-gray-700">${r[9] || ""}</td>  <!-- J From -->
      </tr>
    `).join("");

    target.innerHTML = `
      <table class="w-full text-left border border-gray-600">
        <thead>
          <tr class="bg-gray-800">
            <th class="p-2 border border-gray-700">Date</th>
            <th class="p-2 border border-gray-700">Product</th>
            <th class="p-2 border border-gray-700">Debit</th>
            <th class="p-2 border border-gray-700">For</th>
            <th class="p-2 border border-gray-700">Qty</th>
            <th class="p-2 border border-gray-700">By</th>
            <th class="p-2 border border-gray-700">From</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
      <p class="mt-3 font-bold text-green-400">Total Debit: ${total}</p>
    `;
  } catch (err) {
    target.innerHTML = `<p class="text-red-400">Error: ${err.message}</p>`;
    console.error(err);
  }
};
