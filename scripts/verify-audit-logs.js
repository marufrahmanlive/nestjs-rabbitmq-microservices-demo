const { MongoClient } = require("mongodb");

async function main() {
  const client = await MongoClient.connect(
    "mongodb://localhost:27017/microservices-demo"
  );
  const db = client.db();

  // 1. Total audit logs
  const total = await db.collection("audit_logs").countDocuments();
  console.log("============================================");
  console.log("AUDIT LOG VERIFICATION REPORT");
  console.log("============================================");
  console.log("Total audit logs:", total);

  // 2. By service
  const byService = await db
    .collection("audit_logs")
    .aggregate([
      { $group: { _id: "$serviceName", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ])
    .toArray();
  console.log("\nBy Service:");
  byService.forEach(s => console.log("  ", s._id, ":", s.count));

  // 3. By level
  const byLevel = await db
    .collection("audit_logs")
    .aggregate([
      { $group: { _id: "$level", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ])
    .toArray();
  console.log("\nBy Level:");
  byLevel.forEach(l => console.log("  ", l._id, ":", l.count));

  // 4. By handler (pattern/endpoint)
  const byHandler = await db
    .collection("audit_logs")
    .aggregate([
      { $group: { _id: "$handler", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
    .toArray();
  console.log("\nBy Handler / Pattern:");
  byHandler.forEach(h => console.log("  ", h._id, ":", h.count));

  // 5. Latest 5 logs
  const latest = await db
    .collection("audit_logs")
    .find()
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();
  console.log("\nLatest 5 audit logs:");
  latest.forEach(l => {
    console.log("\n  ---");
    console.log("  serviceName:", l.serviceName);
    console.log("  level:", l.level);
    console.log("  handler:", l.handler);
    console.log("  method:", l.method);
    console.log("  url:", l.url);
    console.log("  statusCode:", l.statusCode);
    console.log("  durationMs:", l.durationMs);
    console.log("  message:", l.message);
    if (l.errorStack)
      console.log("  errorStack:", l.errorStack.substring(0, 100) + "...");
    if (l.metadata)
      console.log("  metadata:", JSON.stringify(l.metadata).substring(0, 150));
    console.log("  createdAt:", l.createdAt);
  });

  // 6. Verify common format: check all required fields exist
  const sampleCheck = await db.collection("audit_logs").findOne({});
  if (sampleCheck) {
    const requiredFields = [
      "instanceId",
      "serviceName",
      "level",
      "message",
      "handler",
      "method",
      "url",
      "createdAt"
    ];
    console.log("\n============================================");
    console.log("SCHEMA FORMAT VERIFICATION (sample)");
    console.log("============================================");
    let allPresent = true;
    for (const field of requiredFields) {
      const present = field in sampleCheck;
      if (!present) allPresent = false;
      console.log("  ", field, ":", present ? "✓" : "✗ MISSING!");
    }
    console.log(
      "\nAll required fields present:",
      allPresent ? "✓ YES" : "✗ NO"
    );
  }

  // 7. Check for audit logs from the latest order we created
  const testLogs = await db
    .collection("audit_logs")
    .find({
      $or: [
        { "requestData.notes": "e2e-audit-test" },
        { "requestData.payload.notes": "e2e-audit-test" }
      ]
    })
    .sort({ createdAt: 1 })
    .toArray();

  if (testLogs.length > 0) {
    console.log("\n============================================");
    console.log("E2E TRACE: 'e2e-audit-test' order flow");
    console.log("============================================");
    for (const log of testLogs) {
      console.log(
        `  [${log.serviceName}] ${log.handler} | ${log.method} | ${log.url} | ${log.level} | ${log.message?.substring(0, 80)}`
      );
    }
  }

  await client.close();
}

main().catch(console.error);
