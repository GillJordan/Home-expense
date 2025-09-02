const apiURL = "/.netlify/functions/addExpense";

// ✅ Form Submit
document.getElementById("dataForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const formData = new FormData(this);
  const data = Object.fromEntries(formData.entries());

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
      // Reset date after submit
      document.getElementById("dateInput").value = new Date().toISOString().split("T")[0];
      loadSuggestions();
      loadDailyData(data.date);
    } else {
      alert("❌ Error: " + JSON.stringify(result));
    }
  } catch (err) {
    console.error("❌ Submit error:", err);
    alert("Error submitting data!");
  }
});

// ✅ Suggestions Loader
async function loadSuggestions() {
  try {
    const res = await fetch(`${apiURL}?suggestions=true`);
    const result = await res.json();
    if (result.data) {
      localStorage.setItem("suggestions", JSON.stringify(result.data));
      fillSuggestions(result.data);
    }
  } catch (err) {
    console.warn("⚠️ Offline mode, using cached suggestions");
    const cached = localStorage.getItem("suggestions");
    if (cached) fillSuggestions(JSON.parse(cached));
  }
}

function fillSuggestions(data) {
  const fillList = (id, arr) => {
    const unique = [...new Set(arr)].filter(Boolean);
    document.getElementById(id).innerHTML = unique.map(val => `<option value="${val}">`).join("");
  };
  fillList("productList", data.products || []);
  fillList("forList", data.forList || []);
  fillList("byList", data.byList || []);
  fillList("fromList", data.fromList || []);
}

window.addEventListener("load", loadSuggestions);

// ✅ Daily Data Loader
async function loadDailyData(date) {
  try {
    const res = await fetch(`${apiURL}?daily=true&date=${date}`);
    const result = await res.json();

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
              <th class="p-2 border">By</th>
            </tr>
          </thead>
          <tbody>
            ${result.data.map(row => `
              <tr>
                <td class="p-2 border">${row[1]}</td>
                <td class="p-2 border">${row[5]}</td>
                <td class="p-2 border">${row[4]}</td>
                <td class="p-2 border">${row[6]}</td>
                <td class="p-2 border">${row[8]}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`;
    } else {
      html = "<p class='text-gray-400'>No data for today</p>";
    }
    document.getElementById("dailyData").innerHTML = html;
  } catch (err) {
    console.error("❌ Daily data error:", err);
  }
}

// ✅ Search
async function searchProduct() {
  const query = document.getElementById("searchInput").value.trim();
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;
  if (!query) return alert("Please enter a product name!");

  try {
    let url = `${apiURL}?search=${encodeURIComponent(query)}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    const res = await fetch(url);
    const result = await res.json();

    let html = "";
    if (result.data && result.data.length > 0) {
      let totalDebit = 0;
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
            ${result.data.map(row => {
              let debit = parseFloat(row[4] || 0);
              totalDebit += isNaN(debit) ? 0 : debit;
              return `
                <tr>
                  <td class="p-2 border">${row[1] || ""}</td>
                  <td class="p-2 border">${row[5] || ""}</td>
                  <td class="p-2 border">${row[4] || ""}</td>
                  <td class="p-2 border">${row[6] || ""}</td>
                  <td class="p-2 border">${row[7] || ""}</td>
                  <td class="p-2 border">${row[8] || ""}</td>
                  <td class="p-2 border">${row[9] || ""}</td>
                </tr>`;
            }).join("")}
          </tbody>
        </table>
        <p class="mt-4 font-bold text-green-400">Total Debit: ${totalDebit}</p>`;
    } else {
      html = "<p class='mt-4 text-red-400'>No records found</p>";
    }
    document.getElementById("searchResults").innerHTML = html;
  } catch (err) {
    console.error("❌ Search error:", err);
  }
}
