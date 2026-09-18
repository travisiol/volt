// Scroll tour of the landing in real time: one capture per section.
// usage: node scripts/tour.mjs [baseUrl]  → docs/captures/tour-*.png
import { launch, sleep } from "./cdp.mjs";

const base = process.argv[2] ?? "http://localhost:3629";
const b = await launch({ width: 1440, height: 900 });
try {
  await b.navigate(`${base}/?intro=0`);
  await b.waitFor(`!!document.querySelector('#battery canvas')`, "hero canvas");
  await sleep(2500);
  await b.evaluate(`document.documentElement.style.scrollBehavior = 'auto'`);
  const sections = ["how", "reserve", "activity", "transparency"];
  for (const id of sections) {
    await b.evaluate(`document.getElementById('${id}').scrollIntoView({ block: 'start' }); window.scrollBy(0, -40);`);
    await sleep(id === "reserve" ? 3500 : 2200);
    console.log("shot", await b.shot(`tour-${id}`));
  }
  await b.evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
  await sleep(1500);
  console.log("shot", await b.shot("tour-end"));
} finally {
  b.close();
}
