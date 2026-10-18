const fs = require("fs");

const action = JSON.parse(fs.readFileSync(0, "utf8"));
const ws = new WebSocket("ws://192.0.2.10:8090/");
const timer = setTimeout(() => {
  console.error("Hyperion API timeout");
  process.exit(1);
}, 15000);
ws.addEventListener("error", (e) => {
  console.error(e.message);
  process.exit(1);
});
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
ws.addEventListener("message", (event) => {
  const raw = event.data;
  const r = JSON.parse(raw);
  if (r.tan === 900) {
    if (!r.success) {
      console.log(JSON.stringify(r));
      process.exit(1);
    }
    ws.send(JSON.stringify({ ...action, tan: 901 }));
  } else if (r.tan === 901) {
    console.log(JSON.stringify(r));
    clearTimeout(timer);
    ws.close();
  }
});
