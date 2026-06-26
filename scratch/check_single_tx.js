async function test() {
  const hash = '231181888f47a46c011cab15cb4df488f9492ab597ea268628762edbb53b184d';
  const apiKey = 'b570a667-729f-4b98-9804-a182c851647d';
  
  try {
    const headers = { 'TRON-PRO-API-KEY': apiKey, 'Accept': 'application/json' };
    const url = `https://apilist.tronscanapi.com/api/transaction-info?hash=${hash}`;
    const res = await fetch(url, { headers });
    const data = await res.json();
    console.log("Tronscan Tx Result:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}

test();
