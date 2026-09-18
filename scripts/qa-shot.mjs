// Hero capture at a given charge, through the dev QA hook. usage: node scripts/qa-shot.mjs 82 [name]
import { launch, sleep } from "./cdp.mjs";
const pct = Number(process.argv[2] ?? 82);
const name = process.argv[3] ?? `hero-${pct}`;
const b = await launch({ width: 1440, height: 900 });
try {
  await b.navigate("http://localhost:3629/?intro=0");
  await b.waitFor(`!!document.querySelector('#battery canvas') && !!window.__volt`, "hero");
  await sleep(2500);
  await b.evaluate(`window.__volt.qa.fill(${pct})`);
  await sleep(3500);
  await b.evaluate(`window.__volt.qa.fee(18.42)`);
  await sleep(500);
  console.log("shot", await b.shot(name));
} finally {
  b.close();
}
