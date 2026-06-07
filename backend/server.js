'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const app  = require('./app');
const port = process.env.API_PORT || 3001; // Dùng API_PORT để tránh xung đột với PORT=3000 của EJS app

app.listen(port, () => {
  console.log(`Kizuna Nihongo API running at http://localhost:${port}`);
});
