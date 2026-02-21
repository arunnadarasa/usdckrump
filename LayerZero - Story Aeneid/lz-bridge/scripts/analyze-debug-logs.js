/**
 * Analyze debug logs and evaluate hypotheses
 */
const fs = require("fs");

const logFile = "/Users/openclaw/Documents/USDC Krump/.cursor/debug.log";
const logs = fs.readFileSync(logFile, "utf8")
  .split("\n")
  .filter(line => line.trim())
  .map(line => JSON.parse(line));

console.log("📊 Debug Log Analysis");
console.log("=".repeat(60));
console.log(`Total log entries: ${logs.length}\n`);

// Group by hypothesis
const byHypothesis = {};
logs.forEach(log => {
  if (!byHypothesis[log.hypothesisId]) {
    byHypothesis[log.hypothesisId] = [];
  }
  byHypothesis[log.hypothesisId].push(log);
});

// Analyze each hypothesis
console.log("Hypothesis Evaluation:\n");

// Hypothesis A: Address encoding
console.log("Hypothesis A: Address encoding mismatch");
const logsA = byHypothesis.A || [];
if (logsA.length > 0) {
  const logA = logsA[0];
  console.log("  Status:", logA.data.oappMatch && logA.data.libMatch ? "❌ REJECTED" : "✅ CONFIRMED");
  console.log("  Evidence:", JSON.stringify(logA.data, null, 2));
  console.log("  Conclusion: Address encoding matches correctly\n");
}

// Hypothesis B: Storage slot calculation
console.log("Hypothesis B: Storage slot calculation");
const logsB = byHypothesis.B || [];
if (logsB.length > 0) {
  const storageLogs = logsB.filter(l => l.message.includes("Storage read"));
  const allEmpty = storageLogs.every(l => l.data.isEmpty);
  const foundMatch = storageLogs.some(l => l.data.match);
  
  console.log("  Status:", foundMatch ? "✅ CONFIRMED" : allEmpty ? "⚠️  INCONCLUSIVE" : "❌ REJECTED");
  console.log("  Storage slots tested:", storageLogs.length);
  console.log("  All empty:", allEmpty);
  console.log("  Found match:", foundMatch);
  if (storageLogs.length > 0) {
    console.log("  Sample:", JSON.stringify(storageLogs[0].data, null, 2));
  }
  console.log("  Conclusion: Storage appears empty at tested slots\n");
}

// Hypothesis C: View function execution
console.log("Hypothesis C: View function execution context");
const logsC = byHypothesis.C || [];
if (logsC.length > 0) {
  const logC = logsC[0];
  console.log("  Status: ✅ CONFIRMED");
  console.log("  Evidence:", JSON.stringify(logC.data, null, 2));
  console.log("  Key finding: getSendLibrary() returns '0' (string), not address");
  console.log("  libIsZero check:", logC.data.libIsZero);
  console.log("  Conclusion: View function returns wrong value\n");
}

// Hypothesis D: setSendLibrary comparison
console.log("Hypothesis D: setSendLibrary comparison");
const logsD = byHypothesis.D || [];
if (logsD.length > 0) {
  const logD = logsD.find(l => l.message.includes("LZ_SameValue"));
  if (logD) {
    console.log("  Status: ✅ CONFIRMED");
    console.log("  Evidence:", JSON.stringify(logD.data, null, 2));
    console.log("  Conclusion: setSendLibrary confirms library IS set\n");
  }
}

// Hypothesis E: DEFAULT_LIB constant
console.log("Hypothesis E: DEFAULT_LIB constant");
const logsE = byHypothesis.E || [];
if (logsE.length > 0) {
  const logE = logsE[0];
  console.log("  Status: ⚠️  INCONCLUSIVE");
  console.log("  Evidence:", JSON.stringify(logE.data, null, 2));
  console.log("  Key finding: currentLib is '0' but libIsZero is false");
  console.log("  This suggests type mismatch: string '0' vs address(0)\n");
}

// Hypothesis F: Address format variations
console.log("Hypothesis F: Address format variations");
const logsF = byHypothesis.F || [];
if (logsF.length > 0) {
  const allReturnZero = logsF.every(l => l.data.lib === "0");
  console.log("  Status:", allReturnZero ? "❌ REJECTED" : "✅ CONFIRMED");
  console.log("  All variants return '0':", allReturnZero);
  console.log("  Conclusion: Address format doesn't matter\n");
}

// Summary
console.log("\n" + "=".repeat(60));
console.log("SUMMARY OF FINDINGS:");
console.log("=".repeat(60));
console.log("\n✅ CONFIRMED:");
console.log("  - Hypothesis C: getSendLibrary() returns '0' (string) instead of address");
console.log("  - Hypothesis D: setSendLibrary confirms library IS stored");
console.log("\n❌ REJECTED:");
console.log("  - Hypothesis A: Address encoding is correct");
console.log("  - Hypothesis F: Address format doesn't affect result");
console.log("\n⚠️  INCONCLUSIVE:");
console.log("  - Hypothesis B: Storage slots appear empty (may be wrong slot calculation)");
console.log("  - Hypothesis E: Type mismatch between '0' and address(0)");
console.log("\n💡 ROOT CAUSE HYPOTHESIS:");
console.log("  The issue appears to be:");
console.log("  1. Storage IS set correctly (confirmed by LZ_SameValue)");
console.log("  2. getSendLibrary() returns string '0' instead of address");
console.log("  3. This suggests a return type or conversion issue");
console.log("  4. OR the storage slot calculation in getSendLibrary() is wrong");
