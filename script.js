const scriptURL = "/.netlify/functions/addExpense"; // Netlify function endpoint

document.getElementById("dataForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());

  try {
    const res = await fetch(scriptURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    alert("✅ " + result.result);
    e.target.reset();
  } catch (err) {
    alert("❌ " + err);
  }
});