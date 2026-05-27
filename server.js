const app = require('./app');
const { port, appName } = require('./config/site');

app.listen(port, () => {
  console.log(`${appName} running at http://localhost:${port}`);
});
