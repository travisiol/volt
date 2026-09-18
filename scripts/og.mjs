// The share image: the hero at 82 % through the QA hook, 1200 × 630. → public/og.png
import { copyFileSync } from "node:fs";
import path from "node:path";
import { launch, sleep } from "./cdp.mjs";

const b = await launch({ width: 1200, height: 630 });
try {
  await b.navigate("http://localhost:3629/?intro=0");
  await b.waitFor(`!!document.querySelector('#battery canvas') && !!window.__volt`, "hero");
  await sleep(3000);
  await b.evaluate(`window.__volt.qa.fill(82)`);
  await sleep(3500);
  const file = await b.shot("og-source");
  copyFileSync(file, path.resolve("public/og.png"));
  console.log("public/og.png written");
} finally {
  b.close();
}
