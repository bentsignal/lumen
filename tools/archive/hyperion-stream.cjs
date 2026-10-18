const fs = require("fs");
const path = require("path");
const action = JSON.parse(fs.readFileSync(0, "utf8"));
const ws = new WebSocket("ws://192.0.2.10:8090/");
let records = [];
const finish = () => {
  fs.writeFileSync(
    path.join(__dirname, "logs", action.command + "-stream.json"),
    JSON.stringify(records, null, 2),
  );
  ws.close();
};
const timer = setTimeout(finish, 4000);
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
  const r = JSON.parse(event.data);
  if (r.tan === 900) {
    if (!r.success) {
      console.log(r);
      process.exit(1);
    }
    ws.send(JSON.stringify({ ...action, tan: 901 }));
  } else records.push(r);
});
