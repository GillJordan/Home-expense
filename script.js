const scriptURL = "/.netlify/functions/addExpense";

/* ---------------------------
   🔹 Suggestions Handling
--------------------------- */
async function fetchSuggestions() {
  try {
    const sheet = document.getElementById("sheetSelect").value;
    const res = await fetch(`${scriptURL}?suggestions=true&sheet=${sheet}`);
    const result = await res.json();

    if (result.result === "success") {
      const data = result.data;

      loadSuggestionsFromSet(new Set(data.products), "productList");
      loadSuggestionsFromSet(new Set(data.forList), "forList");
      loadSuggestionsFromSet(new Set(data.byList), "byList");
      loadSuggestionsFromSet(new Set(data.fromList), "fromList");

      localStorage.setItem("productSuggestions", JSON.stringify(data.products));
      localStorage.setItem("forSuggestions", JSON.stringify(data.forList));
      localStorage.setItem("bySuggestions", JSON.stringify(data.byList));
      localStorage.setItem("fromSuggestions", JSON.stringify(data.fromList));
    }
  } catch (err) {
    console.error("❌ Suggestion fetch error:", err);
  }
}

function loadSuggestionsFromLocal() {
  loadSuggestionsFromKey("productSuggestions", "productList");
  loadSuggestionsFromKey("forSuggestions", "forList");
  loadSuggestionsFromKey("bySuggestions", "byList");
  loadSuggestionsFromKey("fromSuggestions", "fromList");
}

function loadSuggestionsFromKey(key, datalistId) {
  let suggestions = JSON.parse(localStorage.getItem(key)) || [];
  let datalist = document.getElementById(datalistId);
  datalist.innerHTML = "";
  suggestions.forEach(item => {
    let option = document.createElement("option");
    option.value = item;
    datalist.appendChild(option);
  });
}

function loadSuggestionsFromSet(set, datalistId) {
  let datalist = document.getElementById(datalistId);
  datalist.innerHTML = "";
  set.forEach(item => {
    let option = document.createElement("option");
    option.value = item;
    datalist.appendChild(option);
  });
}

/* ---------------------------
   🔹 Offline Save & Sync
--------------------------- */
function saveOffline(data) {
  let pending = JSON.parse(localStorage.getItem("pendingEntries")) || [];
  pending.push(data);
  localStorage.setItem("pendingEntries", JSON.stringify(pending));
  alert("📌 Internet nahi hai, data offline save ho gaya. Net aate hi sync ho jaayega.");
}

function saveEntryLocal(data) {
  let all = JSON.parse(localStorage.getItem("allEntries")) || [];
  all.push(data);
  localStorage.setItem("allEntries", JSON.stringify(all));
}

async function syncOfflineData() {
  let pending = JSON.parse(localStorage.getItem("pendingEntries")) || [];
  if (pending.length === 0) return;

  for (let i = 0; i < pending.length; i++) {
    try {
      const res = await fetch(scriptURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending[i])
      });
      const result = await res.json();

      if (result.result === "success") {
        console.log("✅ Synced:", pending[i]);
        saveEntryLocal(pending[i]);
        pending.splice(i, 1);
        i--;
      }
    } catch (err) {
      console.warn("❌ Sync failed, retry later:", err);
      break;
    }
  }

  localStorage.setItem("pendingEntries", JSON.stringify(pending));
}

/* ---------------------------
   🔹 Form Submit
--------------------------- */
document.getElementById("dataForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const formData = new FormData(this);
  const data = Object.fromEntries(formData.entries());

  data.sheetName = document.getElementById("sheetSelect").value;

  try {
    const res = await fetch(scriptURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const result = await res.json();

    if (result.result === "success") {
      alert("✅ Data submitted successfully!");
      this.reset();
      saveEntryLocal(data);
      await fetchSuggestions();
    } else {
      throw new Error(result.message);
    }
  } catch (err) {
    saveOffline(data);
  }
});

/* ---------------------------
   🔹 Search (Online + Offline)
--------------------------- */
async function searchProduct() {
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  const sheet = document.getElementById("sheetSelect").value;
  if (!query) return alert("Please enter a product name!");

  if (!navigator.onLine) {
    let all = JSON.parse(localStorage.getItem("allEntries")) || [];
    let filtered = all.filter(entry => entry.product && entry.product.toLowerCase().includes(query));
    return showResults(filtered);
  }

  try {
    const res = await fetch(`${scriptURL}?search=${encodeURIComponent(query)}&sheet=${sheet}`);
    const result = await res.json();
    showResults(result.data || []);
  } catch (err) {
    console.error("❌ Search error:", err);
    alert("Error fetching search results!");
  }
}

function showResults(data) {
  let html = "";
  if (data && data.length > 0) {
    // 🔹 Total Debit calculate
    let totalDebit = data.reduce((sum, row) => {
      let debitVal = row.debit || row[4];
      let num = parseFloat(debitVal) || 0;
      return sum + num;
    }, 0);

    html = `
      <table class="w-full text-left border border-gray-600 mt-4">
        <thead>
          <tr class="bg-gray-800">
            <th class="p-2 border border-gray-700">Date</th>
            <th class="p-2 border border-gray-700">Product</th>
            <th class="p-2 border border-gray-700">Debit</th>
            <th class="p-2 border border-gray-700">For</th>
            <th class="p-2 border border-gray-700">Quantity</th>
            <th class="p-2 border border-gray-700">By</th>
            <th class="p-2 border border-gray-700">From</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              <td class="p-2 border border-gray-700">${row.date || row[1] || ""}</td>
              <td class="p-2 border border-gray-700">${row.product || row[5] || ""}</td>
              <td class="p-2 border border-gray-700">${row.debit || row[4] || ""}</td>
              <td class="p-2 border border-gray-700">${row.for || row[6] || ""}</td>
              <td class="p-2 border border-gray-700">${row.quantity || row[7] || ""}</td>
              <td class="p-2 border border-gray-700">${row.by || row[8] || ""}</td>
              <td class="p-2 border border-gray-700">${row.from || row[9] || ""}</td>
            </tr>
          `).join("")}
          <tr class="bg-gray-900 font-bold text-green-400">
            <td colspan="2" class="p-2 border border-gray-700 text-right">Total Debit:</td>
            <td class="p-2 border border-gray-700">${totalDebit}</td>
            <td colspan="4"></td>
          </tr>
        </tbody>
      </table>
    `;
  } else {
    html = "<p class='mt-4 text-red-400'>No records found</p>";
  }
  document.getElementById("searchResults").innerHTML = html;
}

/* ---------------------------
   🔹 Init
--------------------------- */
window.addEventListener("load", async () => {
  loadSuggestionsFromLocal();
  syncOfflineData();

  if (navigator.onLine) {
    await fetchSuggestions();
  }

  const today = new Date().toISOString().split("T")[0];
  document.getElementById("dateInput").value = today;
});

window.addEventListener("online", async () => {
  await syncOfflineData();
  await fetchSuggestions();
});
