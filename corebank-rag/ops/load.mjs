// Sends N requests through the router and reports where they went.
const N = Number(process.argv[2] ?? 300);
const queries = ["daily transfer limit","overdraft policy","dispute a transaction","savings interest","premium account fee","account types","kyc requirements","frozen account"];
const byVersion = {}, byStatus = {};
for (let i = 0; i < N; i++) {
  const q = queries[i % queries.length] + (i % 3 === 0 ? "" : " " + (i % 5));
  const r = await fetch(`http://localhost:8080/retrieve?query=${encodeURIComponent(q)}&userTier=public`);
  const v = r.headers.get("x-service-version");
  byVersion[v] = (byVersion[v] ?? 0) + 1;
  byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  await r.text();
}
console.log("requests by version served:", JSON.stringify(byVersion));
console.log("requests by HTTP status   :", JSON.stringify(byStatus));
const s = await (await fetch("http://localhost:8080/__deploy")).json();
console.log("deploy status:", s.status, "| traffic weight to canary:", s.weight + "%");
