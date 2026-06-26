async function checkAccount() {
  const address = 'TD2vA4e994Ki6VBfYUKGmKobXPry3NHf8J';
  const apiKey = 'b570a667-729f-4b98-9804-a182c851647d';
  
  try {
    const headers = { 'TRON-PRO-API-KEY': apiKey, 'Accept': 'application/json' };
    const url = `https://apilist.tronscanapi.com/api/account?address=${address}`;
    const res = await fetch(url, { headers });
    const data = await res.json();
    console.log("Account Info balance:", data?.balance);
    console.log("Account Info trc20token_balances:", JSON.stringify(data?.trc20token_balances, null, 2));
  } catch (err) {
    console.error(err);
  }
}

checkAccount();
