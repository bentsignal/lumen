const fs = require("fs"),
  crypto = require("crypto");
const ws = new WebSocket("ws://192.0.2.10:8090/");
const frames = [],
  leds = [];
let started = 0;
const end = () => {
  const span = (Date.now() - started) / 1000;
  console.log(
    JSON.stringify({
      seconds: span,
      frames: frames.length,
      uniqueFrames: new Set(frames.map((x) => x.hash)).size,
      ledUpdates: leds.length,
      firstFrames: frames.slice(0, 10),
      lastFrames: frames.slice(-10),
      leds: leds.slice(0, 5),
    }),
  );
  ws.close();
};
setTimeout(end, 6000);
ws.addEventListener("open", () =>
  ws.send(
    JSON.stringify({
      command: "authorize",
      subcommand: "login",
      password: "hyperion",
      tan: 900,
    }),
  ),
);
ws.addEventListener("message", (e) => {
  let m = JSON.parse(e.data);
  if (m.tan === 900) {
    started = Date.now();
    ws.send(
      JSON.stringify({
        command: "ledcolors",
        subcommand: "imagestream-start",
        tan: 901,
      }),
    );
    ws.send(
      JSON.stringify({
        command: "ledcolors",
        subcommand: "ledstream-start",
        interval: 50,
        tan: 902,
      }),
    );
  } else if (m.result?.image) {
    const s = m.result.image;
    frames.push({
      t: Date.now() - started,
      hash: crypto.createHash("sha256").update(s).digest("hex").slice(0, 12),
    });
  } else if (m.result?.leds)
    leds.push({ t: Date.now() - started, colors: m.result.leds });
});
