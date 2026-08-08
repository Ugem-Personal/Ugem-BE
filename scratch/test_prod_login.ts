async function testProdLogin() {
  const url = "https://ugem-be.onrender.com/api/v1/auth/login";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@uat.ugem.local",
        password: "UGemUat12345!"
      })
    });

    console.log("Status:", res.status, res.statusText);
    const data = await res.json();
    console.log("Response Body:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

testProdLogin();
