const apiURL = "/.netlify/functions/addExpense";

// ---- startup ----
window.addEventListener("load", () => {
  const today = new Date().toISOString().split("T")[0];
  const dateInput = document.getElementById("dateInput");
  if (dateInput) dateInput.value = today;

  // preload for offline search
  preloadAllEntries();
  // load today's expenses
  loadDailyData(today);
});

// sync offline queue when back online
window.addEventListener("online", () => {
  syncOfflineEntries().then(() => {
    preloadAllEntries();
    const today = new Date().toISOString().split("T")[0];
    loadDailyData(today);
  });
});

// ---- submit form ----
document.getElementById("dataForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const formData = new FormData(this);
  const data = Object.fromEntries(formData.entries());

  if (!navigator.onLine) {
    queueOffline(data);
    alert("📴 Offline: saved locally, will sync when online.");
    return;
  }

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

    // update today panel instantly
    await loadDailyData(today);
    // refresh offline cache
    await preloadAllEntries();
  } catch (err) {
    console.error("❌ Submit error:", err);
    alert("❌ " + err.message);
  }
});

// ---- daily panel ----
async function loadDailyData(dateISO) {
  try {
    const res = await fetch(`${apiURL}?daily=true&date=${dateISO}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to load daily data");

    const rows = json.data || [];
    renderDaily(rows);
  } catch (err) {
    console.error("❌ Daily load error:", err);
    document.getElementById("dailyData").innerHTML = `<p class="text-red-400">Error: ${err.message}</p>`;
  }
}
function renderDaily(rows) {
  if (!rows.length) {
    document.getElementById("dailyData").innerHTML = "<p class='text-gray-400'>No data for today</p>";
    return;
  }
  let total = 0;
  const body = rows.map(r => {
    const debit = parseFloat(r[3] || 0) || 0;
    total += debit;
    return `
      <tr>
        <td class="p-2 border border-gray-700">${r[1] || ""}</td>
        <td class="p-2 border border-gray-700">${r[4] || ""}</td>
        <td class="p-2 border border-gray-700">${r[3] || ""}</td>
        <td class="p-2 border border-gray-700">${r[5] || ""}</td>
        <td class="p-2 border border-gray-700">${r[6] || ""}</td>
        <td class="p-2 border border-gray-700">${r[7] || ""}</td>
        <td class="p-2 border border-gray-700">${r[8] || ""}</td>
      </tr>`;
  }).join("");

  document.getElementById("dailyData").innerHTML = `
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
}

// ---- search ----
async function searchProduct() {
  const q = (document.getElementById("searchInput").value || "").trim();
  const startDate = document.getElementById("startDate").value || "";
  const endDate = document.getElementById("endDate").value || "";

  // Offline search from cache
  if (!navigator.onLine) {
    const cache = JSON.parse(localStorage.getItem("entriesCache") || "[]");
    let rows = cache.slice(1); // assume first row header if cached from ALL
    rows = filterRows(rows, q, startDate, endDate);
    renderSearch(rows);
    return;
  }

  // Online search
  let url = `${apiURL}?search=${encodeURIComponent(q)}`;
  if (startDate && endDate) url += `&startDate=${startDate}&endDate=${endDate}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Search failed");

    renderSearch(json.data || [], json.totalDebit || 0);
  } catch (err) {
    console.error("❌ Search error:", err);
    document.getElementById("searchResults").innerHTML = `<p class="text-red-400">Error: ${err.message}</p>`;
  }
}
function filterRows(rows, q, s, e) {
  let filtered = rows;
  if (q) filtered = filtered.filter(r => (r[4] || "").toLowerCase().includes(q.toLowerCase()));
  if (s && e) {
    const S = new Date(s), E = new Date(e);
    filtered = filtered.filter(r => { try { const d = new Date(r[1]); return d >= S && d <= E; } catch { return false; }});
  }
  return filtered;
}
function renderSearch(rows, totalFromAPI = null) {
  if (!rows.length) {
    document.getElementById("searchResults").innerHTML = "<p class='text-red-400 mt-4'>No records found</p>";
    return;
  }
  const body = rows.map(r => `
    <tr>
      <td class="p-2 border border-gray-700">${r[1] || ""}</td>
      <td class="p-2 border border-gray-700">${r[4] || ""}</td>
      <td class="p-2 border border-gray-700">${r[3] || ""}</td>
      <td class="p-2 border border-gray-700">${r[5] || ""}</td>
      <td class="p-2 border border-gray-700">${r[6] || ""}</td>
      <td class="p-2 border border-gray-700">${r[7] || ""}</td>
      <td class="p-2 border border-gray-700">${r[8] || ""}</td>
    </tr>`).join("");

  const totalDebit = totalFromAPI ?? rows.reduce((s, r) => s + (parseFloat(r[3] || 0) || 0), 0);

  document.getElementById("searchResults").innerHTML = `
    <table class="w-full text-left border border-gray-600 mt-4">
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
    <p class="mt-3 font-bold text-green-400">Total Debit: ${totalDebit}</p>
  `;
}

// ---- offline support: queue + preload ALL ----
function queueOffline(entry) {
  const q = JSON.parse(localStorage.getItem("pendingEntries") || "[]");
  q.push(entry);
  localStorage.setItem("pendingEntries", JSON.stringify(q));
}
async function syncOfflineEntries() {
  const q = JSON.parse(localStorage.getItem("pendingEntries") || "[]");
  if (!q.length) return;
  for (const entry of q) {
    await fetch(apiURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(entry)
    }).catch(() => { throw new Error("Sync failed"); });
  }
  localStorage.removeItem("pendingEntries");
}
async function preloadAllEntries() {
  if (!navigator.onLine) return;
  try {
    const res = await fetch(`${apiURL}?all=true`, { cache: "no-store" });
    const json = await res.json();
    if (res.ok && json.data) {
      localStorage.setItem("entriesCache", JSON.stringify(json.data));
    }
  } catch (e) {
    console.warn("Preload failed:", e.message);
  }
}
