const apiURL = "/.netlify/functions/addExpense";

// ✅ Save pending entries offline
function savePendingEntry(data) {
  let pending = JSON.parse(localStorage.getItem("pendingEntries") || "[]");
  pending.push(data);
  localStorage.setItem("pendingEntries", JSON.stringify(pending));
  alert("📴 Offline: Entry saved locally, will sync when online!");
}

// ✅ Sync pending entries when online
async function syncPendingEntries() {
  let pending = JSON.parse(localStorage.getItem("pendingEntries") || "[]");
  if (pending.length === 0) return;

  for (let entry of pending) {
    try {
      await fetch(apiURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
    } catch (err) {
      console.error("❌ Sync failed for:", entry, err);
      return; // stop sync if any fails
    }
  }
  localStorage.removeItem("pendingEntries");
  alert("🌐 Back online: Pending entries synced!");
}

// ✅ Form Submit
document.getElementById("dataForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const formData = new FormData(this);
  const data = Object.fromEntries(formData.entries());

  if (!navigator.onLine) {
    savePendingEntry(data);
    return;
  }

  try {
    const res = await fetch(apiURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (result.message) {
      alert("✅ Data submitted successfully!");
      this.reset();
      document.getElementById("dateInput").value = new Date().toISOString().split("T")[0];

      // 🔹 Update cache
      let cache = JSON.parse(localStorage.getItem("entriesCache") || "[]");
      cache.push(result.row);
      localStorage.setItem("entriesCache", JSON.stringify(cache));
    }
  } catch (err) {
    console.error("❌ Submit error:", err);
  }
});

// ✅ Offline + Online Search
async function searchProduct() {
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;

  if (!navigator.onLine) {
    console.warn("📴 Offline search running on cache");
    const cache = JSON.parse(localStorage.getItem("entriesCache") || "[]");
    let filtered = cache.filter(r => (query === "" || (r[5] || "").toLowerCase().includes(query)));

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      filtered = filtered.filter(r => {
        try {
          const rowDate = new Date(r[1]); // row[1] = formatted date
          return rowDate >= start && rowDate <= end;
        } catch {
          return false;
        }
      });
    }

    renderSearchResults({ data: filtered, totalDebit: calcTotalDebit(filtered) });
    return;
  }

  // Online search
  let url = `/.netlify/functions/addExpense?search=${encodeURIComponent(query)}`;
  if (startDate && endDate) {
    url += `&startDate=${startDate}&endDate=${endDate}`;
  }

  try {
    const res = await fetch(url);
    const result = await res.json();

    // 🔹 Save to cache
    if (result.data) {
      localStorage.setItem("entriesCache", JSON.stringify(result.data));
    }

    renderSearchResults(result);
  } catch (err) {
    console.error("❌ Search error:", err);
  }
}

// ✅ Render search results
function renderSearchResults(result) {
  let html = "";
  if (result.data && result.data.length > 0) {
    html = `
      <table class="w-full text-left border border-gray-600 mt-4">
        <thead>
          <tr class="bg-gray-800">
            <th class="p-2 border">Date</th>
            <th class="p-2 border">Product</th>
            <th class="p-2 border">Debit</th>
            <th class="p-2 border">For</th>
            <th class="p-2 border">Quantity</th>
            <th class="p-2 border">By</th>
            <th class="p-2 border">From</th>
          </tr>
        </thead>
        <tbody>
          ${result.data.map(r => `
            <tr>
              <td class="p-2 border">${r[1] || ""}</td>
              <td class="p-2 border">${r[5] || ""}</td>
              <td class="p-2 border">${r[4] || ""}</td>
              <td class="p-2 border">${r[6] || ""}</td>
              <td class="p-2 border">${r[7] || ""}</td>
              <td class="p-2 border">${r[8] || ""}</td>
              <td class="p-2 border">${r[9] || ""}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <p class="mt-4 font-bold text-green-400">Total Debit: ${result.totalDebit}</p>
    `;
  } else {
    html = "<p class='mt-4 text-red-400'>No records found</p>";
  }

  document.getElementById("searchResults").innerHTML = html;
}

// ✅ Helper to calculate total debit
function calcTotalDebit(rows) {
  return rows.reduce((sum, r) => sum + (parseFloat(r[4] || 0) || 0), 0);
}

// ✅ Sync when back online
window.addEventListener("online", syncPendingEntries);
